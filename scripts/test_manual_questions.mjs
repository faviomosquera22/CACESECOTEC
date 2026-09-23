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
    if (file.endsWith('.json')) return JSON.parse(fs.readFileSync(file, 'utf8'));
    const compiled = { exports: {} }; cache.set(file, compiled.exports);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
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
const { validateManualQuestion, manualQuestionForSimulator } = load('src/lib/manualQuestions.ts');
const { getLocalQuestionsForExam, selectQuestionsForExam, isLocalQuestionSet } = load('src/lib/localQuestions.ts');
const { getDefaultSimulatorSettings, filterQuestionsForSimulatorSettings } = load('src/lib/simulatorSettingsCatalog.ts');
const valid = { question_text: '¿Cuál de las siguientes opciones corresponde al caso descrito?', option_a: 'Primera alternativa', option_b: 'Segunda alternativa', option_c: 'Tercera alternativa', option_d: 'Cuarta alternativa', correct_option: 'C', explanation: 'La tercera alternativa es la respuesta marcada en el documento.', phase: 'componente-integral', difficulty: 'Media', published: true };
const row = (values = {}) => ({ ...valid, id: '00000000-0000-4000-8000-000000000001', teacher_id: 'teacher-one', career_slug: 'enfermeria', created_at: '2026-09-22T00:00:00Z', updated_at: '2026-09-22T00:00:00Z', ...values });

test('valida pregunta completa y elimina campos de propiedad inyectados', () => {
  const result = validateManualQuestion({ ...valid, teacher_id: 'another', career_slug: 'psicologia' }, 'enfermeria');
  assert.deepEqual(result, valid);
});
test('rechaza claves ausentes, opciones repetidas, textos vacíos y componente ajeno', () => {
  for (const values of [{ correct_option: '' }, { option_d: '  PRIMERA alternativa. ' }, { explanation: ' ' }, { published: 'true' }, { question_text: 'x'.repeat(12001) }]) assert.throws(() => validateManualQuestion({ ...valid, ...values }, 'enfermeria'));
  assert.throws(() => validateManualQuestion(valid, 'psicologia'));
});
test('conserva letra y texto correctos al transformar la pregunta', () => {
  const question = manualQuestionForSimulator(row());
  assert.equal(question.correct_option, 'C'); assert.equal(question.option_c, valid.option_c);
  assert.equal(isLocalQuestionSet([question]), true);
});
test('integral incluye todas las manuales, supera 100 y mantiene exclusividad', async () => {
  const settings = { ...getDefaultSimulatorSettings('enfermeria'), enabledPhases: ['componente-integral', 'fase-2'] };
  const additions = Array.from({ length: 80 }, (_, i) => manualQuestionForSimulator(row({ id: String(i) })));
  additions.push(manualQuestionForSimulator(row({ id: 'other', phase: 'fase-2' })));
  const first = await getLocalQuestionsForExam('enfermeria', 'seed-a', settings, additions);
  const second = await getLocalQuestionsForExam('enfermeria', 'seed-b', settings, additions);
  assert.equal(first.length, 123); assert.equal(first.every(q => q.phase === 'componente-integral'), true);
  assert.notDeepEqual(first.map(q => q.id), second.map(q => q.id));
  for (const question of first.filter(q => q.id.startsWith('local-manual-'))) { assert.equal(question.correct_option, 'C'); assert.equal(question.option_c, valid.option_c); }
});
test('filtra manuales por componente elegido en ambas carreras', () => {
  for (const career of ['enfermeria', 'psicologia']) {
    const question = manualQuestionForSimulator(row({ career_slug: career, phase: 'fase-2' }));
    const settings = { ...getDefaultSimulatorSettings(career), enabledPhases: ['fase-1'] };
    assert.equal(filterQuestionsForSimulatorSettings(career, [question], settings).length, 0);
    settings.enabledPhases = ['fase-2'];
    assert.equal(selectQuestionsForExam(career, [question], 'seed', settings).length, 1);
  }
});

function api(context, response = { data: row(), error: null }) {
  const calls = [];
  const query = { select: () => query, eq: (key, value) => { calls.push(['eq', key, value]); return query; }, maybeSingle: async () => response };
  const supabase = { from: table => { calls.push(['table', table]); return { insert: input => { calls.push(['insert', input]); return query; }, update: input => { calls.push(['update', input]); return query; } }; } };
  return { calls, routes: loader({ '@/lib/auth': { getCurrentAuthContext: async () => context ? { profile: context, supabase } : null } })('src/app/api/teacher/questions/route.ts') };
}
const request = (data, method = 'POST', origin = 'https://example.test') => new Request('https://example.test/api/teacher/questions', { method, headers: { 'Content-Type': 'application/json', origin }, body: JSON.stringify(data) });
test('API rechaza sesiones ausentes y estudiantes', async () => {
  for (const [profile, code] of [[null, 401], [{ id: 'student', role: 'student', career: 'Enfermería' }, 403]]) {
    const { routes, calls } = api(profile); assert.equal((await routes.POST(request(valid))).status, code); assert.deepEqual(calls, []);
  }
});
test('API no admite origen externo ni opción correcta vacía', async () => {
  const { routes, calls } = api({ id: 'teacher', role: 'teacher', career: 'Enfermería' });
  assert.equal((await routes.POST(request(valid, 'POST', 'https://foreign.test'))).status, 403);
  assert.equal((await routes.POST(request({ ...valid, correct_option: '' }))).status, 400); assert.deepEqual(calls, []);
});
test('API asigna propietario desde sesión y acota ediciones a docente y carrera', async () => {
  const { routes, calls } = api({ id: 'teacher', role: 'teacher', career: 'Enfermería' });
  assert.equal((await routes.POST(request({ ...valid, teacher_id: 'attacker', career_slug: 'psicologia' }))).status, 201);
  const insert = calls.find(call => call[0] === 'insert')[1]; assert.equal(insert.teacher_id, 'teacher'); assert.equal(insert.career_slug, 'enfermeria');
  assert.equal((await routes.PATCH(request({ ...valid, id: row().id }, 'PATCH'))).status, 200);
  assert.ok(calls.some(call => call[1] === 'teacher_id' && call[2] === 'teacher')); assert.ok(calls.some(call => call[1] === 'career_slug' && call[2] === 'enfermeria'));
});
test('API no informa éxito al editar pregunta inexistente ni al fallar el guardado', async () => {
  const profile = { id: 'teacher', role: 'teacher', career: 'Enfermería' };
  assert.equal((await api(profile, { data: null, error: null }).routes.PATCH(request({ ...valid, id: row().id }, 'PATCH'))).status, 404);
  assert.equal((await api(profile, { data: null, error: { message: 'db failure' } }).routes.POST(request(valid))).status, 500);
});

test('PDF octubre: las 30 preguntas completas conservan claves y entran al banco remoto', () => {
  const bank = JSON.parse(fs.readFileSync(path.join(root, 'src/data/enfermeriaOctubreDocumentoQuestions.json'), 'utf8'));
  const { withNursingOctoberQuestions, isUsableQuestion } = load('src/lib/localQuestions.ts');
  assert.equal(bank.length, 30);
  assert.deepEqual(bank.filter(q => !isUsableQuestion(q)).map(q => ({id:q.id,prompt:q.question_text})), []);
  const pool = withNursingOctoberQuestions([]);
  assert.equal(withNursingOctoberQuestions(pool).length, 30);
  for (const [phase, count] of [['fase-1', 8], ['fase-3', 22], ['fase-2', 0], ['componente-integral', 0]]) {
    const settings = { ...getDefaultSimulatorSettings('enfermeria'), enabledPhases: [phase] };
    const selected = selectQuestionsForExam('enfermeria', pool, 'octubre-source', settings);
    assert.equal(selected.length, count);
    for (const question of selected) {
      const original = bank.find(q => q.id === question.id);
      assert.equal(question.correct_option, original.correct_option);
      assert.equal(question['option_' + question.correct_option.toLowerCase()], original['option_' + original.correct_option.toLowerCase()]);
    }
  }
});

test('cuadro clínico no requiere imagen; una referencia a una tabla sí', () => {
  const { isUsableQuestion } = load('src/lib/localQuestions.ts');
  const question = manualQuestionForSimulator(row());
  assert.equal(isUsableQuestion({ ...question, question_text: 'Un paciente presenta tos. ¿Qué intervención corresponde según el cuadro clínico?' }), true);
  assert.equal(isUsableQuestion({ ...question, question_text: 'Según el cuadro siguiente, ¿qué resultado corresponde?' }), false);
  assert.equal(isUsableQuestion({ ...question, question_text: 'Según la tabla, ¿qué resultado corresponde?' }), false);
});
