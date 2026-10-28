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
const bank = JSON.parse(fs.readFileSync(path.join(root, 'src/data/enfermeriaTeoriasDocenteQuestions.json')));
const { getLocalQuestionPoolForExam, isUsableQuestion, repairQuestionText, selectQuestionsForExam } = load('src/lib/localQuestions.ts');
const { getDefaultSimulatorSettings, getPhaseKey, isRetiredQuestion } = load('src/lib/simulatorSettingsCatalog.ts');
const settings = { ...getDefaultSimulatorSettings('enfermeria'), enabledPhases: ['fase-1'] };
test('306 preguntas completas conservan clave, distractores y componente 1', () => {
  assert.equal(bank.length, 306);
  assert.equal(new Set(bank.map(q => q.id)).size, 306);
  for (const q of bank) {
    assert.ok(isUsableQuestion(q), q.id);
    assert.equal(getPhaseKey('enfermeria', q), 'fase-1');
    assert.equal(isRetiredQuestion(q), false);
    assert.deepEqual(repairQuestionText(q), q);
    assert.deepEqual(Object.keys(q.option_explanations).sort(), ['A', 'B', 'C', 'D']);
    assert.ok(q.explanation.startsWith(`Justificación: ${q.option_explanations[q.correct_option]}`));
  }
});
test('el banco local y el compartido incluyen las 306 preguntas sin alterar respuestas', async () => {
  const pool = await getLocalQuestionPoolForExam('enfermeria');
  assert.deepEqual(pool.filter(q => q.id.startsWith('local-enfermeria-teorias-docente-')), bank);
  const query = { select() { return this; }, or() { return this; }, eq() { return this; }, order() { return this; }, async range() { return { data: [], error: null }; } };
  const shared = loader({
    '@/lib/supabaseAdmin': { getSupabaseAdminClient: () => ({ from: () => query }) },
    '@/lib/customComponentsServer': { getImportedQuestions: async () => [] },
  })('src/lib/questionBankServer.ts');
  const questions = await shared.getSharedBank('enfermeria');
  assert.deepEqual(questions.filter(q => q.id.startsWith('local-enfermeria-teorias-docente-')), bank.map(q => ({ ...q, revision: null })));
});
test('cada reactivo puede seleccionarse y calificarse en el componente 1', () => {
  for (const q of bank) {
    const result = selectQuestionsForExam('enfermeria', [q], 'teorias-check', settings);
    assert.equal(result.length, 1, q.id);
    assert.equal(result[0].correct_option, q.correct_option);
    assert.equal(result[0][`option_${q.correct_option.toLowerCase()}`], q[`option_${q.correct_option.toLowerCase()}`]);
    assert.equal(selectQuestionsForExam('enfermeria', [q], 'other-component', { ...settings, enabledPhases: ['fase-2'] }).length, 0);
  }
  const attempt = selectQuestionsForExam('enfermeria', bank, 'teorias-100', settings);
  assert.equal(attempt.length, 100);
  assert.equal(new Set(attempt.map(q => q.id)).size, 100);
});
