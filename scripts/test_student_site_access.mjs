import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
function loader(mocks = {}, globals = {}) {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    if (file.endsWith('.json')) return JSON.parse(fs.readFileSync(file, 'utf8'));
    const compiled = { exports: {} };
    cache.set(file, compiled.exports);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    const resolve = name => {
      if (name in mocks) return mocks[name];
      if (name === 'server-only') return {};
      if (name.startsWith('@/components/')) return new Proxy({}, { get: () => () => null });
      if (name.startsWith('@/')) {
        let full = path.join(root, 'src', name.slice(2));
        if (!path.extname(full)) full += fs.existsSync(full + '.ts') ? '.ts' : '.tsx';
        return load(full);
      }
      return require(name);
    };
    vm.runInNewContext('(function(require,module,exports){' + code + '\n})', {
      Response, Request, URL, AbortController, AbortSignal, console, ...globals,
    }, { filename: file })(resolve, compiled, compiled.exports);
    return compiled.exports;
  }
  return relative => load(path.join(root, relative));
}
const student = { id: 'student-one', role: 'student', full_name: 'Estudiante', career: 'Enfermería' };
function context({ profile = student, enabled = true, error = null, signedIn = true } = {}) {
  const queried = [];
  const supabase = {
    auth: { getUser: async () => ({ data: { user: signedIn ? { id: profile?.id ?? 'missing' } : null }, error: null }), signOut: async () => {} },
    from(table) {
      queried.push(table);
      assert.ok(['profiles', 'student_simulator_access'].includes(table), 'Must authorize before accessing ' + table);
      const query = { select: () => query, eq: () => query, maybeSingle: async () => table === 'profiles' ? { data: profile } : { data: enabled === null ? null : { enabled }, error } };
      return query;
    },
  };
  const load = loader({
    react: { ...require('react'), cache: fn => fn },
    'next/navigation': { redirect: location => { throw new Error('REDIRECT:' + location); } },
    '@/lib/supabaseServer': { createSupabaseServerClient: async () => supabase },
  });
  return { load, queried };
}

test('cuenta bloqueada, sin habilitación o con error se rechaza antes de revisar el perfil', async () => {
  for (const state of [{ enabled: false }, { enabled: null }, { error: { message: 'db unavailable' } }]) {
    const { load } = context({ ...state, profile: { ...student, full_name: null } });
    await assert.rejects(load('src/lib/auth.ts').requireCompletedStudentProfile(), /REDIRECT:\/access-blocked$/);
  }
});

test('cuentas habilitadas conservan acceso; perfiles incompletos van al perfil; docentes no dependen del interruptor', async () => {
  assert.equal((await context().load('src/lib/auth.ts').requireCompletedStudentProfile()).profile.id, student.id);
  await assert.rejects(context({ profile: { ...student, full_name: null } }).load('src/lib/auth.ts').requireCompletedStudentProfile(), /REDIRECT:\/student\/profile\?firstTime=1$/);
  const teacher = context({ profile: { ...student, role: 'teacher' }, enabled: false });
  assert.equal((await teacher.load('src/lib/auth.ts').requireProfile(['teacher'])).profile.role, 'teacher');
  assert.deepEqual(teacher.queried, ['profiles']);
  await assert.rejects(context({ signedIn: false }).load('src/lib/auth.ts').requireProfile(), /REDIRECT:\/login$/);
});

test('todas las páginas privadas y ambas clases de reporte rechazan al estudiante bloqueado sin consultar contenido', async () => {
  const cases = [
    ['src/app/student/dashboard/page.tsx', {}],
    ['src/app/student/history/page.tsx', {}],
    ['src/app/student/profile/page.tsx', {}],
    ['src/app/student/simulator/page.tsx', {}],
    ['src/app/student/simulator/[examType]/page.tsx', { params: Promise.resolve({ examType: 'enfermeria' }) }],
    ['src/app/student/results/[simulationId]/page.tsx', { params: Promise.resolve({ simulationId: 'remote-attempt' }) }],
    ['src/app/student/results/[simulationId]/page.tsx', { params: Promise.resolve({ simulationId: 'local-attempt' }) }],
    ['src/app/login/page.tsx', {}],
    ['src/app/page.tsx', {}],
    ['src/app/student/layout.tsx', { children: 'private' }],
  ];
  for (const [file, props] of cases) {
    const { load } = context({ enabled: false });
    await assert.rejects(load(file).default(props), /REDIRECT:\/access-blocked$/, file);
  }
});

test('pantalla bloqueada no redirige en bucle y recupera el acceso cuando el docente habilita', async () => {
  assert.ok(await context({ enabled: false }).load('src/app/access-blocked/page.tsx').default());
  await assert.rejects(context().load('src/app/access-blocked/page.tsx').default(), /REDIRECT:\/student\/dashboard$/);
  await assert.rejects(context({ profile: { ...student, role: 'teacher' } }).load('src/app/access-blocked/page.tsx').default(), /REDIRECT:\/teacher\/dashboard$/);
});

test('API de acceso devuelve 403 sin caché a bloqueados; 200 a habilitados y 401 sin sesión', async () => {
  for (const [state, status, enabled] of [[{ enabled: false }, 403, false], [{ enabled: true }, 200, true], [{ enabled: null }, 403, false]]) {
    const response = await context(state).load('src/app/api/student/simulator-access/route.ts').GET();
    assert.equal(response.status, status);
    assert.equal((await response.json()).enabled, enabled);
    assert.match(response.headers.get('cache-control'), /no-store/);
  }
  assert.equal((await context({ signedIn: false }).load('src/app/api/student/simulator-access/route.ts').GET()).status, 401);
});

function guardHarness() {
  let pathname = '/student/history';
  let verifiedPath = null;
  let effect;
  let interval;
  let fetchResponse = () => Response.json({ enabled: true });
  const destinations = [];
  const events = new Map();
  const load = loader({
    react: { useState: () => [verifiedPath, value => { verifiedPath = value; }], useEffect: callback => { effect = callback; } },
    'next/navigation': { usePathname: () => pathname },
  }, {
    fetch: async () => fetchResponse(),
    window: {
      location: { replace: url => destinations.push(url) },
      setInterval: (fn, ms) => { assert.equal(ms, 15000); interval = fn; return 1; },
      clearInterval: () => {},
      addEventListener: (name, callback) => events.set(name, callback),
      removeEventListener: name => events.delete(name),
    },
    document: { visibilityState: 'visible', addEventListener: (name, callback) => events.set(name, callback), removeEventListener: name => events.delete(name) },
  });
  const { StudentAccessGuard } = load('src/components/StudentAccessGuard.tsx');
  return {
    render: () => StudentAccessGuard({ children: 'PRIVATE REPORT' }),
    mount: () => effect(),
    tick: () => interval(),
    respond: fn => { fetchResponse = fn; },
    navigate: value => { pathname = value; },
    destinations, events,
  };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('pestaña abierta oculta el reporte y sale al detectar bloqueo; limpia eventos al desmontar', async () => {
  const guard = guardHarness();
  assert.notEqual(guard.render(), 'PRIVATE REPORT');
  const cleanup = guard.mount();
  await flush();
  assert.equal(guard.render(), 'PRIVATE REPORT');
  guard.respond(() => Response.json({ enabled: false }, { status: 403 }));
  guard.tick();
  await flush();
  assert.notEqual(guard.render(), 'PRIVATE REPORT');
  assert.deepEqual(guard.destinations, ['/access-blocked']);
  cleanup();
  assert.equal(guard.events.size, 0);
});

test('restaurar pestaña revalida; sesión vencida sale al login; error de red no deja el reporte disponible', async () => {
  for (const status of [401, 500]) {
    const guard = guardHarness();
    guard.render();
    const cleanup = guard.mount();
    await flush();
    guard.respond(() => new Response('', { status }));
    guard.events.get('pageshow')();
    await flush();
    assert.notEqual(guard.render(), 'PRIVATE REPORT');
    assert.deepEqual(guard.destinations, status === 401 ? ['/login'] : []);
    if (status === 500) {
      guard.respond(() => Response.json({ enabled: true }));
      guard.tick();
      await flush();
      assert.equal(guard.render(), 'PRIVATE REPORT');
      guard.navigate('/student/results/local-attempt');
      assert.notEqual(guard.render(), 'PRIVATE REPORT');
    }
    cleanup();
  }
});

test('login de estudiante bloqueado cierra sesión y muestra el motivo; estudiante habilitado y docente entran', async () => {
  for (const [role, enabled, blocked] of [['student', false, true], ['student', true, false], ['teacher', false, false]]) {
    const actions = [];
    let index = 0;
    const states = ['', '', '', false];
    const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: { enabled }, error: null }) };
    const profileQuery = { select: () => profileQuery, eq: () => profileQuery, maybeSingle: async () => ({ data: { ...student, role }, error: null }) };
    const supabase = {
      auth: {
        signInWithPassword: async () => ({ data: { user: { id: student.id } }, error: null }),
        signOut: async () => actions.push('signOut'),
        updateUser: async () => actions.push('updateUser'),
        refreshSession: async () => actions.push('refreshSession'),
      },
      from: table => table === 'profiles' ? profileQuery : query,
    };
    const load = loader({
      react: { useState: initial => { const position = index++; return [initial, value => { states[position] = value; }]; } },
      'next/navigation': { useRouter: () => ({ replace: url => actions.push(url), refresh: () => actions.push('refresh') }) },
      '@/lib/supabaseClient': { getSupabaseBrowserClient: () => supabase },
    });
    const form = load('src/components/LoginForm.tsx').LoginForm({});
    await form.props.onSubmit({ preventDefault() {} });
    if (blocked) {
      assert.deepEqual(actions, ['signOut']);
      assert.match(states[2], /Tu cuenta está bloqueada/);
    } else {
      assert.ok(actions.includes(role === 'student' ? '/student/dashboard' : '/teacher/dashboard'));
      assert.ok(!actions.includes('signOut'));
    }
  }
});
