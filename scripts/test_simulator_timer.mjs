import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = fs.readFileSync(new URL('../src/components/SimulatorClient.tsx', import.meta.url), 'utf8');
const draft = (values = {}) => ({ version: 4, simulationSeconds: 5400, timeLeft: 4800,
  startedAt: '2026-11-03T12:00:00Z', updatedAt: '2026-11-03T12:10:00Z',
  answers: { q1: 'A' }, comments: {}, attemptSeed: 'attempt-one', ...values });

// Exercise the component's effects with a controlled clock and persistence, without a database.
function session({ remote = null, local = null, legacy = null, deferSave = false } = {}) {
  let now = Date.parse('2026-11-04T12:00:00Z');
  let cursor = 0, dirty = true, tree, nextTimer = 0, releaseSave;
  const hooks = [], effects = [], jobs = [], timers = new Map(), events = [];
  const storage = new Map(local ? [['test-draft', JSON.stringify(local)]] : []);
  const props = { studentId: 'student', examSlug: 'enfermeria', attemptSeed: 'attempt-one',
    persistenceMode: 'local', draftStorageKey: 'test-draft',
    questions: [{ id: 'q1', correct_option: 'A' }, { id: 'q2', correct_option: 'B' }] };
  const react = {
    useState(initial) {
      const index = cursor++;
      hooks[index] ??= { value: initial };
      return [hooks[index].value, value => {
        const next = typeof value === 'function' ? value(hooks[index].value) : value;
        if (!Object.is(next, hooks[index].value)) { hooks[index].value = next; dirty = true; }
      }];
    },
    useRef(initial) { const index = cursor++; hooks[index] ??= { current: initial }; return hooks[index]; },
    useMemo: fn => fn(), useCallback: fn => fn,
    useEffect(fn, deps) {
      const index = cursor++, previous = hooks[index];
      if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
        hooks[index] = { deps, cleanup: previous?.cleanup };
        effects.push(() => { hooks[index].cleanup?.(); hooks[index].cleanup = fn(); });
      }
    },
  };
  class Clock extends Date {
    constructor(value) { super(arguments.length ? value : now); }
    static now() { return now; }
  }
  const supabase = { from(table) {
    let operation;
    const query = {
      select: () => query, eq: () => query, like: () => query, or: () => query,
      order: () => query, limit: () => query,
      maybeSingle: async () => ({ data: table === 'simulation_drafts' && remote ? { draft: remote } : null }),
      single: async () => ({ data: { id: 'result' }, error: null }),
      insert(value) { events.push(['insert', table, value]); return query; },
      delete() { operation = 'delete'; return query; },
      async upsert(value) {
        events.push(['save-start', value]);
        if (deferSave) await new Promise(resolve => { releaseSave = resolve; });
        events.push(['save-end', value]); remote = value.draft;
        return { error: null };
      },
      then(resolve, reject) {
        if (operation === 'delete') { events.push(['delete', table]); remote = null; }
        return Promise.resolve({ data: legacy ? [{ status: 'draft:enfermeria:' + Buffer.from(JSON.stringify(legacy)).toString('base64'), created_at: legacy.updatedAt }] : [], error: null }).then(resolve, reject);
      },
    };
    return query;
  } };
  const mocks = {
    react, 'next/navigation': { useRouter: () => ({ push: url => events.push(['navigate', url]), refresh() {} }) },
    '@/lib/supabaseClient': { getSupabaseBrowserClient: () => supabase },
    '@/lib/writtenAnswers': { parseWrittenAnswers: value => value ?? {} },
    '@/lib/supabaseSimulationAttempts': { buildSimulationAttemptInsert: value => value },
    '@/lib/localSimulationStorage': { writeLocalSimulationSummary() {} },
    '@/components/SimulationQuestion': { SimulationQuestion: 'question' },
  };
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const compiledModule = { exports: {} };
  vm.runInNewContext('(function(require,module,exports){' + compiled + '\n})', {
    Date: Clock, console, TextEncoder, TextDecoder,
    queueMicrotask: fn => jobs.push(fn),
    window: {
      localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
      setTimeout: fn => { timers.set(++nextTimer, { fn, interval: false }); return nextTimer; },
      clearTimeout: id => timers.delete(id),
      setInterval: fn => { timers.set(++nextTimer, { fn, interval: true }); return nextTimer; },
      clearInterval: id => timers.delete(id),
      btoa: value => Buffer.from(value, 'binary').toString('base64'),
      atob: value => Buffer.from(value, 'base64').toString('binary'),
    },
  })(name => mocks[name] ?? require(name), compiledModule, compiledModule.exports);
  async function flush() {
    for (let i = 0; i < 40; i++) {
      if (dirty) { dirty = false; cursor = 0; tree = compiledModule.exports.SimulatorClient(props); }
      while (effects.length) effects.shift()();
      while (jobs.length) jobs.shift()();
      await Promise.resolve();
    }
  }
  return {
    events, flush,
    saved: () => JSON.parse(storage.get('test-draft') ?? 'null'),
    release: () => releaseSave(),
    async tick(seconds) { now += seconds * 1000; for (const timer of timers.values()) if (timer.interval) timer.fn(); await flush(); },
    async save() { for (const [id, timer] of [...timers]) if (!timer.interval) { timers.delete(id); timer.fn(); } await flush(); },
    async click(label) {
      function find(node) {
        if (!node || typeof node !== 'object') return null;
        if (node.type === 'button' && JSON.stringify(node.props.children).includes(label)) return node;
        for (const child of [node.props?.children].flat(Infinity)) { const found = find(child); if (found) return found; }
        return null;
      }
      const button = find(tree); assert.ok(button, label); button.props.onClick(); await flush();
    },
  };
}

test('recupera borrador remoto de ayer con su tiempo disponible y respuestas', async () => {
  const app = session({ remote: draft() }); await app.flush();
  assert.equal(app.saved().timeLeft, 4800); assert.equal(app.saved().answers.q1, 'A');
  await app.tick(12); assert.equal(app.saved().timeLeft, 4788);
  await app.save(); assert.equal(app.events.findLast(e => e[0] === 'save-end')[1].draft.timeLeft, 4788);
  assert.ok(!app.events.some(e => e[0] === 'navigate'));
});

test('Keilly: borrador vacío vencido empieza con 90 minutos y no se cierra', async () => {
  const app = session({ remote: draft({ answers: {}, timeLeft: 0 }) }); await app.flush();
  assert.equal(app.saved().timeLeft, 5400);
  await app.tick(1); assert.equal(app.saved().timeLeft, 5399);
  assert.ok(!app.events.some(e => e[0] === 'navigate'));
});

test('recargar conserva el guardado local más reciente que el remoto', async () => {
  const app = session({ remote: draft(), local: draft({ timeLeft: 4770, updatedAt: '2026-11-03T12:10:30Z', answers: { q1: 'A', q2: 'B' } }) });
  await app.flush(); assert.equal(app.saved().timeLeft, 4770); assert.equal(app.saved().answers.q2, 'B');
});

test('recupera borrador local y vuelve a guardar el mismo reloj', async () => {
  const app = session({ local: draft() }); await app.flush(); await app.tick(30); await app.save();
  assert.equal(app.saved().timeLeft, 4770);
  assert.equal(app.events.findLast(e => e[0] === 'save-end')[1].draft.timeLeft, 4770);
});

test('migra duración antigua conservando tiempo utilizado', async () => {
  const app = session({ remote: draft({ version: 2, simulationSeconds: 7200, timeLeft: 6600 }) });
  await app.flush(); assert.equal(app.saved().timeLeft, 4800);
});

test('sin timeLeft usa la última actualización, sin cobrar horas fuera del test', async () => {
  const app = session({ remote: draft({ timeLeft: undefined }) }); await app.flush();
  assert.equal(app.saved().timeLeft, 4800);
});

test('rechaza borradores de otro intento', async () => {
  const app = session({ remote: draft({ attemptSeed: 'other', timeLeft: 1 }) }); await app.flush();
  assert.equal(app.saved().timeLeft, 5400); assert.deepEqual(app.saved().answers, {});
});

test('el reloj vence normalmente después de consumir todo el tiempo disponible', async () => {
  const app = session({ remote: draft({ timeLeft: 2 }) }); await app.flush(); await app.tick(2);
  assert.ok(app.events.some(e => e[0] === 'navigate'));
});

test('finalizar espera al guardado pendiente antes de eliminar el borrador', async () => {
  const app = session({ remote: draft(), deferSave: true }); await app.flush(); await app.save();
  await app.click('Finalizar simulación'); await app.click('Confirmar finalización');
  assert.ok(!app.events.some(e => e[0] === 'delete'));
  app.release(); await app.flush(); await app.save();
  assert.ok(app.events.findIndex(e => e[0] === 'delete') > app.events.findIndex(e => e[0] === 'save-end'));
  assert.equal(app.events.filter(e => e[0] === 'save-start').length, 1);
  assert.ok(app.events.some(e => e[0] === 'navigate'));
});
