import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
function loader(mocks = {}) {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const module = { exports: {} };
    cache.set(file, module.exports);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const resolve = name => {
      if (name in mocks) return mocks[name];
      if (name === 'server-only') return {};
      if (name.startsWith('@/')) {
        let full = path.join(root, 'src', name.slice(2));
        if (!path.extname(full)) full += fs.existsSync(full + '.ts') ? '.ts' : '.tsx';
        return load(full);
      }
      return require(name);
    };
    vm.runInThisContext('(function(require,module,exports){' + code + '\n})', { filename: file })(resolve, module, module.exports);
    return module.exports;
  }
  return relative => load(path.join(root, relative));
}
const { getDefaultSimulatorSettings, sanitizeSimulatorSettings } = loader()('src/lib/simulatorSettingsCatalog.ts');

test('valores predeterminados y opciones de duración por carrera', () => {
  assert.equal(getDefaultSimulatorSettings('psicologia').durationMinutes, 140);
  assert.equal(getDefaultSimulatorSettings('enfermeria').durationMinutes, 90);
  for (const minutes of [60,70,80,90,100,110,120,130,140,150]) {
    assert.equal(sanitizeSimulatorSettings('psicologia', { durationMinutes: minutes }).durationMinutes, minutes);
    assert.equal(sanitizeSimulatorSettings('enfermeria', { durationMinutes: minutes }).durationMinutes, 90);
  }
  for (const minutes of [null, undefined, 0, 59, 65, 151, '140', NaN, Infinity]) {
    assert.equal(sanitizeSimulatorSettings('psicologia', { durationMinutes: minutes }).durationMinutes, 140);
  }
});

function harness({ profile = { id: 'teacher-one', role: 'teacher', career: 'Psicología' }, existingDuration = null, readError = null } = {}) {
  const mutations = [], filters = [];
  const admin = { from(table) {
    assert.equal(table, 'teacher_simulator_settings');
    const query = {
      select: () => query,
      eq: (key, value) => { filters.push([key, value]); return query; },
      maybeSingle: async () => ({ data: { duration_minutes: existingDuration }, error: readError }),
      upsert: async (row, options) => { mutations.push({ row, options }); return { error: null }; },
    };
    return query;
  } };
  const load = loader({
    '@/lib/auth': { getCurrentAuthContext: async () => profile ? { profile } : null },
    '@/lib/supabaseAdmin': { getSupabaseAdminClient: () => admin },
    '@/lib/customComponentsServer': { getCustomComponents: async () => [] },
    '@/lib/bankRemovalsServer': { getBankRemovals: async () => [] },
    '@/lib/bankRemovals': { removedComponentIds: () => [] },
  });
  return { mutations, filters, admin, load, PATCH: load('src/app/api/teacher/simulator-settings/route.ts').PATCH };
}
function request(body) {
  return new Request('https://example.test/api/teacher/simulator-settings', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

test('guarda cada duración en la cuenta del docente autenticado', async () => {
  for (const durationMinutes of [60,70,80,90,100,110,120,130,140,150]) {
    const h = harness();
    const result = await h.PATCH(request({ enabledPhases: ['fase-1'], durationMinutes, teacher_id: 'another-teacher' }));
    assert.equal(result.status, 200);
    assert.equal((await result.json()).settings.durationMinutes, durationMinutes);
    assert.equal(h.mutations[0].row.duration_minutes, durationMinutes);
    assert.equal(h.mutations[0].row.teacher_id, 'teacher-one');
    assert.equal(h.mutations[0].row.career_slug, 'psicologia');
    assert.deepEqual(h.mutations[0].options, { onConflict: 'teacher_id,career_slug' });
  }
});

test('rechaza duraciones inválidas sin escribir en la base de datos', async () => {
  for (const durationMinutes of [null, 0, 59, 65, 151, '140']) {
    const h = harness();
    assert.equal((await h.PATCH(request({ enabledPhases: ['fase-1'], durationMinutes }))).status, 400);
    assert.equal(h.mutations.length, 0);
  }
});

test('sesiones inválidas y estudiantes no pueden configurar el tiempo', async () => {
  for (const profile of [null, { id: 'student', role: 'student', career: 'Psicología' }]) {
    const h = harness({ profile });
    assert.ok([401,403].includes((await h.PATCH(request({ enabledPhases: ['fase-1'], durationMinutes: 150 }))).status));
    assert.equal(h.mutations.length, 0);
  }
});

test('clientes anteriores conservan la duración al guardar solo componentes', async () => {
  const h = harness({ existingDuration: 120 });
  const result = await h.PATCH(request({ enabledPhases: ['fase-2'] }));
  assert.equal(result.status, 200);
  assert.equal((await result.json()).settings.durationMinutes, 120);
  assert.deepEqual(h.filters, [['teacher_id', 'teacher-one'], ['career_slug', 'psicologia']]);
  const failed = harness({ readError: { message: 'unavailable' } });
  assert.equal((await failed.PATCH(request({ enabledPhases: ['fase-2'] }))).status, 500);
  assert.equal(failed.mutations.length, 0);
});

test('Enfermería conserva 90 minutos al guardar componentes', async () => {
  const h = harness({ profile: { id: 'nursing-teacher', role: 'teacher', career: 'Enfermería' } });
  const result = await h.PATCH(request({ enabledPhases: ['fase-1'], durationMinutes: 150 }));
  assert.equal(result.status, 200);
  assert.equal((await result.json()).settings.durationMinutes, 90);
  assert.equal(h.mutations[0].row.duration_minutes, 90);
});


test('el simulador lee la duración guardada para el docente del estudiante', async () => {
  for (const existingDuration of [60, 100, 140, 150, null]) {
    const h = harness({ existingDuration });
    const settings = await h.load('src/lib/simulatorSettings.ts').getCareerSimulatorSettings(h.admin, 'psicologia', 'teacher-one');
    assert.equal(settings.durationMinutes, existingDuration ?? 140);
    assert.deepEqual(h.filters, [['career_slug', 'psicologia'], ['teacher_id', 'teacher-one']]);
  }
});

test('el selector docente muestra todas las opciones y permite guardar un cambio solo de tiempo', async () => {
  const React = require('react');
  const hooks = []; let cursor = 0, savedBody;
  const renderLoad = loader({
    react: { ...React, useMemo: fn => fn(), useState: initial => {
      const index = cursor++; hooks[index] ??= { value: initial };
      return [hooks[index].value, value => { hooks[index].value = value; }];
    } },
  });
  const { TeacherSimulatorSettings } = renderLoad('src/components/TeacherSimulatorSettings.tsx');
  const props = { career: 'psicologia', initialSettings: getDefaultSimulatorSettings('psicologia'), totalQuestionCount: 264 };
  const render = () => { cursor = 0; return TeacherSimulatorSettings(props); };
  const find = (node, predicate) => {
    if (!node || typeof node !== 'object') return null;
    if (predicate(node)) return node;
    for (const child of [node.props?.children].flat(Infinity)) { const found = find(child, predicate); if (found) return found; }
    return null;
  };
  let tree = render();
  const select = find(tree, node => node.type === 'select');
  assert.equal(select.props.value, 140);
  assert.deepEqual(select.props.children.map(option => option.props.value), [60,70,80,90,100,110,120,130,140,150]);
  select.props.onChange({ target: { value: '150' } });
  tree = render();
  const button = find(tree, node => node.type === 'button');
  assert.equal(button.props.disabled, false);
  const previousFetch = global.fetch;
  global.fetch = async (_, options) => {
    savedBody = JSON.parse(options.body);
    return { ok: true, json: async () => ({ settings: { ...props.initialSettings, durationMinutes: savedBody.durationMinutes } }) };
  };
  try { button.props.onClick(); await new Promise(resolve => setImmediate(resolve)); }
  finally { global.fetch = previousFetch; }
  assert.equal(savedBody.durationMinutes, 150);
  tree = render();
  assert.equal(find(tree, node => node.type === 'select').props.value, 150);
  assert.equal(find(tree, node => node.type === 'button').props.disabled, true);
});
