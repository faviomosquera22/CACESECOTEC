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
const bank = JSON.parse(fs.readFileSync(path.join(root, 'src/data/enfermeriaIntegral18And19Questions.json')));
const audit = JSON.parse(fs.readFileSync(path.join(root, 'src/data/enfermeriaIntegral18And19Audit.json')));
const { getLocalQuestionsForExam, getIntegral18And19Questions, isUsableQuestion, repairQuestionText, selectQuestionsForExam } = load('src/lib/localQuestions.ts');
const { getDefaultSimulatorSettings, getSimulatorSettingsCatalog, isRetiredQuestion } = load('src/lib/simulatorSettingsCatalog.ts');
const settings = { ...getDefaultSimulatorSettings('enfermeria'), enabledPhases: ['componente-integral'] };

test('200 reactivos originales: 199 únicos, cuatro opciones y todas las claves explícitas', () => {
  assert.equal(bank.length, 199);
  assert.equal(audit.items.length, 200);
  assert.equal(audit.duplicates, 1);
  assert.equal(new Set(bank.map(q => q.id)).size, 199);
  for (const q of bank) {
    assert.equal(q.phase, 'componente-integral');
    assert.equal(q.component, 'Componente Integral');
    assert.ok(isUsableQuestion(q), q.id);
    if (q.id === 'local-enfermeria-integral-18-19-19-047') {
      // Keep the explicit PDF key as provenance, with the reviewed clinical
      // correction applied only to new attempts (the original omits opening
      // the airway and prioritizes monitoring an obstructed airway).
      assert.equal(q.correct_option, 'D');
      assert.equal(repairQuestionText(q).correct_option, 'A');
      assert.ok(repairQuestionText(q).option_a.startsWith('Abrir la vía aérea'));
    } else {
      assert.deepEqual(repairQuestionText(q), q);
    }
    const source = audit.items.find(item => item.id === q.id);
    assert.equal(source.status, 'imported');
    assert.equal(source.correct_option, q.correct_option);
    assert.ok(q.explanation.endsWith(source.explicit_answer));
    assert.equal(isRetiredQuestion(q), false);
  }
  assert.equal(audit.items.filter(q => q.selected_option !== q.correct_option).length, 11);
  assert.equal(bank.find(q => q.id.endsWith('19-098')).correct_option, 'D');
  assert.equal(bank.find(q => q.id.endsWith('19-099')).correct_option, 'C');
});
test('Integral selecciona solo CACES 18/19 y mantiene retirados todos los bancos anteriores', async () => {
  const retired = ['enfermeriaComponenteIntegralQuestions', 'enfermeriaIntegralSeptiembreQuestions', 'enfermeriaOctubreDocumentoQuestions', 'enfermeriaFundamentosDocumentoQuestions'].flatMap(name => JSON.parse(fs.readFileSync(path.join(root, `src/data/${name}.json`))));
  assert.ok(retired.every(isRetiredQuestion));
  const selected = await getLocalQuestionsForExam('enfermeria', 'integral-18-19', settings, retired);
  assert.equal(selected.length, 100);
  assert.ok(selected.every(q => bank.some(item => item.id === q.id)));
  assert.equal(new Set(selected.map(q => q.id)).size, 100);
  const other = await getLocalQuestionsForExam('enfermeria', 'other', { ...settings, enabledPhases: ['fase-1'] });
  assert.ok(other.every(q => q.phase !== 'componente-integral'));
  assert.ok(!getSimulatorSettingsCatalog('psicologia').phases.some(p => p.key === 'componente-integral'));
});
test('el banco base con el mismo enunciado no oculta la copia del Integral', async () => {
  const ordinary = { ...bank[0], id: 'local-manual-base', phase: 'fase-1', component: 'Componente 1', category: 'Enfermería - Cuidado y Procedimientos Clínicos de Enfermería' };
  const selected = selectQuestionsForExam('enfermeria', [ordinary, bank[0], bank[0]], 'overlap', settings);
  assert.deepEqual(selected.map(q => q.id), [bank[0].id]);
  const builtin = await getIntegral18And19Questions();
  const remote = selectQuestionsForExam('enfermeria', [ordinary, ...builtin], 'remote', settings);
  assert.equal(remote.length, 100);
  assert.ok(remote.every(q => q.phase === 'componente-integral'));
});
test('el banco compartido muestra las 199 preguntas con las fuentes y permite corregirlas', async () => {
  const query = { select() { return this; }, or() { return this; }, eq() { return this; }, order() { return this; }, async range() { return { data: [], error: null }; } };
  const shared = loader({
    '@/lib/supabaseAdmin': { getSupabaseAdminClient: () => ({ from: () => query }) },
    '@/lib/customComponentsServer': { getImportedQuestions: async () => [] },
  })('src/lib/questionBankServer.ts');
  const questions = await shared.getSharedBank('enfermeria');
  assert.equal(questions.filter(q => q.phase === 'componente-integral').length, 199);
});
