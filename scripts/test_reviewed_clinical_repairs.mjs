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
  mocks = { "@/lib/bankRemovalsServer": { getBankRemovals: async () => [] }, ...mocks };
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    if (file.endsWith('.json')) return JSON.parse(fs.readFileSync(file, 'utf8'));
    const compiled = { exports: {} }; cache.set(file, compiled.exports);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    const resolve = name => {
      if (name in mocks) return mocks[name];
      if (name === 'server-only') return {};
      if (name.startsWith('@/')) { let full = path.join(root, 'src', name.slice(2)); if (!path.extname(full)) full += '.ts'; return load(full); }
      return require(name);
    };
    vm.runInThisContext('(function(require,module,exports){' + code + '\n})', { filename: file })(resolve, compiled, compiled.exports);
    return compiled.exports;
  }
  return relative => load(path.join(root, relative));
}
const load = loader();
const repairs = JSON.parse(fs.readFileSync(path.join(root, 'src/data/reviewedClinicalQuestionRepairs.json')));
const sourceFiles = fs.readdirSync(path.join(root, 'src/data')).filter(f => /^enfermeria.*Questions\.json$/.test(f));
const originals = sourceFiles.flatMap(f => JSON.parse(fs.readFileSync(path.join(root, 'src/data', f))));
const { repairQuestionText, isUsableQuestion, selectQuestionsForExam } = load('src/lib/localQuestions.ts');
const { getDefaultSimulatorSettings } = load('src/lib/simulatorSettingsCatalog.ts');
const byId = id => originals.find(q => q.id === id);
const fix = id => repairQuestionText(byId(id));
const answer = q => q[`option_${q.correct_option.toLowerCase()}`];

test('12 correcciones trazables producen alternativas utilizables y conservan las fuentes', () => {
  assert.equal(repairs.length, 12);
  const snapshot = structuredClone(originals);
  for (const row of repairs) {
    const source = byId(row.id);
    assert.equal(source.question_text, row.original_text);
    const repaired = repairQuestionText(source);
    assert.equal(repaired.id, source.id);
    assert.ok(isUsableQuestion(repaired), row.id);
    assert.ok(row.sources.every(url => url.startsWith('https://')));
    assert.ok(repaired.explanation.includes(row.sources[0]));
    assert.equal(repaired.option_explanations, undefined);
    assert.deepEqual(repairQuestionText(repaired), repaired);
  }
  assert.deepEqual(originals, snapshot);
});
test('Aldrete: ambas versiones tienen puntuación inequívoca 7 y opciones numéricas', () => {
  for (const id of ['local-enfermeria-0916-6e0459779de3', 'local-enfermeria-1322-c43b47b68eb5']) {
    const q = fix(id);
    assert.equal(answer(q), `${1 + 2 + 1 + 2 + 1} puntos.`);
    assert.ok(q.question_text.includes('30 %'));
    assert.ok(q.question_text.includes('oxígeno suplementario'));
    assert.ok(q.explanation.includes('No se atribuye el puntaje 7 al enunciado original'));
    assert.ok(!Object.values(q).some(v => typeof v === 'string' && v.startsWith('Integralidad')));
  }
  const q = fix('local-enfermeria-0360-f3d1766a31ae');
  assert.ok(answer(q).startsWith(`${2 + 2 + 2 + 1 + 2} puntos`));
  assert.ok(q.question_text.includes('igual a la preanestésica'));
  assert.ok(q.explanation.includes('no autoriza por sí solo el alta'));
  assert.equal(answer(fix('local-enfermeria-1416-10aa0dc6d2ab')), '5 puntos.');
});
test('vía aérea: las tres versiones priorizan apertura y no solo monitorización', () => {
  for (const id of ['local-enfermeria-1924-d4103f781288', 'local-enfermeria-2091-f02fc026d64f', 'local-enfermeria-integral-18-19-19-047']) {
    assert.ok(answer(fix(id)).startsWith('Abrir la vía aérea'));
  }
  assert.equal(byId('local-enfermeria-integral-18-19-19-047').correct_option, 'D');
});
test('transfusión y educación: las copias coinciden en la respuesta clínica, aunque cambie la letra', () => {
  assert.equal(answer(fix('local-enfermeria-1967-54906d3d1be6')), answer(fix('local-enfermeria-2045-ebb8b5ff0f4e')));
  for (const id of ['local-enfermeria-1999-c1e17c260e40', 'local-enfermeria-2060-b809f105138a']) {
    assert.match(answer(fix(id)), /^Técnicas de expresión/);
  }
});
test('vacunas: los enunciados contienen la característica que faltaba', () => {
  for (const id of ['local-enfermeria-0211-f0f3e5a320e9', 'local-enfermeria-1178-17346d7ce229']) {
    const q = fix(id);
    assert.ok(q.question_text.includes('bacteriana viva atenuada'));
    assert.equal(answer(q), 'BCG.');
  }
  const q = fix('local-enfermeria-1176-2da4819747ee');
  assert.ok(q.question_text.includes('virales vivas atenuadas'));
  assert.equal(answer(q), 'SRP, varicela, fiebre amarilla.');
});
test('copias remotas se corrigen; otras fuentes y revisiones docentes conservan su contenido', () => {
  for (const row of repairs) {
    const source = byId(row.id);
    assert.equal(answer(repairQuestionText({ ...source, id: 'remote-uuid' })), answer(fix(row.id)));
    const teacher = { ...source, bank_revision: 'teacher-revision' };
    assert.strictEqual(repairQuestionText(teacher), teacher);
    const other = { ...source, id: 'unrelated-id', difficulty: 'unrelated-source' };
    assert.equal(repairQuestionText(other).correct_option, source.correct_option);
  }
});
test('nuevos intentos usan la corrección y mantienen aislado el Componente Integral', () => {
  const originalsForCases = repairs.map(row => byId(row.id));
  for (const phase of ['fase-1', 'componente-integral']) {
    const settings = { ...getDefaultSimulatorSettings('enfermeria'), enabledPhases: [phase] };
    const selected = selectQuestionsForExam('enfermeria', originalsForCases, `review-${phase}`, settings);
    assert.ok(selected.length > 0);
    for (const q of selected) {
      assert.equal(q.correct_option, fix(q.id).correct_option);
      assert.equal(q.question_text, fix(q.id).question_text);
      assert.equal(q.phase === 'componente-integral', phase === 'componente-integral');
    }
  }
});
test('el banco compartido corrige UUID remoto y conserva una edición docente posterior', async () => {
  const remote = { ...byId('local-enfermeria-0916-6e0459779de3'), id: 'database-copy-id' };
  let overrides = [];
  const shared = loader({
    '@/lib/supabaseAdmin': { getSupabaseAdminClient: () => ({ from: table => ({
      select() { return this; }, or() { return this; }, eq() { return this; }, order() { return this; },
      async range() { return { data: table === 'questions' ? [remote] : overrides, error: null }; },
    }) }) },
    '@/lib/customComponentsServer': { getImportedQuestions: async () => [] },
  })('src/lib/questionBankServer.ts');
  let bank = await shared.getSharedBank('enfermeria');
  assert.equal(answer(bank.find(q => q.id === remote.id)), '7 puntos.');
  overrides = [{ question_id: remote.id, updated_at: 'teacher-edit', question: { ...remote, question_text: 'Caso validado por el docente.', option_a: 'Respuesta docente.', correct_option: 'A' } }];
  bank = await shared.getSharedBank('enfermeria');
  const revised = bank.find(q => q.id === remote.id);
  assert.equal(revised.question_text, 'Caso validado por el docente.');
  assert.equal(revised.bank_revision, 'teacher-edit');
  assert.strictEqual(repairQuestionText(revised), revised);
});
