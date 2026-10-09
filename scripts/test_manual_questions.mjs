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
const { validateManualQuestion, manualQuestionForSimulator } = load('src/lib/manualQuestions.ts');
const { getLocalQuestionsForExam, selectQuestionsForExam, isLocalQuestionSet } = load('src/lib/localQuestions.ts');
const { getDefaultSimulatorSettings, filterQuestionsForSimulatorSettings } = load('src/lib/simulatorSettingsCatalog.ts');
const valid = { question_text: '¿Cuál de las siguientes opciones corresponde al caso descrito?', option_a: 'Primera alternativa', option_b: 'Segunda alternativa', option_c: 'Tercera alternativa', option_d: 'Cuarta alternativa', correct_option: 'C', explanation: 'La tercera alternativa es la respuesta marcada en el documento.', phase: 'fase-3', difficulty: 'Media', published: true };
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



test('Fundamentos: las seis respuestas escritas conservan sus claves y no revelan la solución', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { SimulationQuestion } = load('src/components/SimulationQuestion.tsx');
  const { gradeWrittenAnswer } = load('src/lib/writtenAnswers.ts');
  const { isUsableQuestion } = load('src/lib/localQuestions.ts');
  const bank = JSON.parse(fs.readFileSync(path.join(root, 'src/data/enfermeriaFundamentosDocumentoQuestions.json'), 'utf8'));
  const written = bank.filter(q => q.source_format === 'answer-only');
  assert.deepEqual(written.map(q => Number(q.id.slice(-3))), [5, 14, 15, 22, 26, 36]);
  for (const question of written) {
    const answer = question['option_' + question.correct_option.toLowerCase()];
    const html = renderToStaticMarkup(React.createElement(SimulationQuestion, { question, onSelect: () => {} }));
    assert.ok(html.includes('Escribe tu respuesta') && html.includes('Confirmar respuesta'));
    assert.ok(!html.includes('data-option=') && !html.includes(answer));
    assert.equal(isUsableQuestion(question), true);
    assert.equal(gradeWrittenAnswer(question, answer), question.correct_option);
    assert.notEqual(gradeWrittenAnswer(question, 'No corresponde a la respuesta del documento'), question.correct_option);
    assert.equal(isUsableQuestion({ ...question, id: 'other-source' }), false);
    assert.equal(isUsableQuestion({ ...question, ['option_' + question.correct_option.toLowerCase()]: '' }), false);
  }
});

test('cuadro clínico no requiere imagen; una referencia a una tabla sí', () => {
  const { isUsableQuestion } = load('src/lib/localQuestions.ts');
  const question = manualQuestionForSimulator(row());
  assert.equal(isUsableQuestion({ ...question, question_text: 'Un paciente presenta tos. ¿Qué intervención corresponde según el cuadro clínico?' }), true);
  assert.equal(isUsableQuestion({ ...question, question_text: 'Según el cuadro siguiente, ¿qué resultado corresponde?' }), false);
  assert.equal(isUsableQuestion({ ...question, question_text: 'Según la tabla, ¿qué resultado corresponde?' }), false);
});

test('octubre original: solo muestra alternativas presentes y no inventa letras para la respuesta abierta', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { SimulationQuestion } = load('src/components/SimulationQuestion.tsx');
  const { isUsableQuestion } = load('src/lib/localQuestions.ts');
  const bank = JSON.parse(fs.readFileSync(path.join(root, 'src/data/enfermeriaOctubreDocumentoQuestions.json'), 'utf8'));
  for (const number of [2, 9, 26, 27, 29, 34, 37, 38]) {
    const question = bank.find(q => q.id.endsWith(String(number).padStart(3, '0')));
    const html = renderToStaticMarkup(React.createElement(SimulationQuestion, { question, onSelect: () => {} }));
    const available = (number === 29 ? [] : ['A','B','C','D']).filter(letter => question['option_' + letter.toLowerCase()]);
    assert.equal((html.match(/data-option=/g) ?? []).length, available.length);
    for (const letter of ['A','B','C','D']) assert.equal(html.includes(`data-option="${letter}"`), available.includes(letter));
    if (number === 29) {
      assert.ok(html.includes('Escribe tu respuesta'));
      assert.ok(html.includes('Confirmar respuesta'));
      assert.ok(!html.includes('Morfina'));
      assert.ok(!html.includes('Opción A'));
    }
    assert.equal(isUsableQuestion(question), true);
  }
  const incomplete = bank.find(q => q.id.endsWith('-026'));
  assert.equal(isUsableQuestion({ ...incomplete, id: 'other-source' }), false);
  assert.equal(isUsableQuestion({ ...incomplete, correct_option: 'D' }), false);
});


test('respuesta escrita: califica variantes de la clave sin aceptar otros fármacos o negaciones', () => {
  const { gradeWrittenAnswer, parseWrittenAnswers } = load('src/lib/writtenAnswers.ts');
  const question = JSON.parse(fs.readFileSync(path.join(root, 'src/data/enfermeriaOctubreDocumentoQuestions.json'), 'utf8')).find(q => q.source_format === 'answer-only');
  for (const text of ['Morfina', '  MORFINA  ', 'morfína.', '(opioide) Morfina', 'Morfina (opioide)']) assert.equal(gradeWrittenAnswer(question, text), 'A');
  for (const text of ['opioide', 'no morfina', 'Morfina o paracetamol', 'fentanilo']) assert.equal(gradeWrittenAnswer(question, text), 'B');
  assert.equal(gradeWrittenAnswer(question, '   '), undefined);
  assert.deepEqual(parseWrittenAnswers({ [question.id]: 'Morfina', other: 'x', invalid: 3 }, new Set([question.id, 'invalid'])), { [question.id]: 'Morfina' });
});

test('respuesta escrita: persiste en nube, reporte y migración local con calificación correcta', () => {
  const { gradeWrittenAnswer } = load('src/lib/writtenAnswers.ts');
  const { buildSimulationAttemptInsert, simulationAttemptToAnswers, buildSimulationAttemptInsertFromLocalPayload } = load('src/lib/supabaseSimulationAttempts.ts');
  const { ResultReviewList } = load('src/components/ResultReviewList.tsx');
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const question = JSON.parse(fs.readFileSync(path.join(root, 'src/data/enfermeriaOctubreDocumentoQuestions.json'), 'utf8')).find(q => q.source_format === 'answer-only');
  for (const text of ['MORFINA', 'fentanilo', '']) {
    const option = gradeWrittenAnswer(question, text);
    const insert = buildSimulationAttemptInsert({ studentId: 'student', examSlug: 'enfermeria', startedAt: '2026-09-23T00:00:00Z', finishedAt: '2026-09-23T01:00:00Z', totalQuestions: 1, correctAnswers: option === 'A' ? 1 : 0, incorrectAnswers: option === 'B' ? 1 : 0, score: option === 'A' ? 100 : 0, timeUsedSeconds: 60, questions: [question], selectedAnswers: { [question.id]: option }, writtenAnswers: { [question.id]: text } });
    const answers = simulationAttemptToAnswers({ id: 'attempt', answers: JSON.parse(JSON.stringify(insert.answers)) });
    assert.equal(answers[0].written_answer, text || null);
    assert.equal(answers[0].is_correct, text ? option === 'A' : null);
    assert.equal(answers[0].questions.source_format, 'answer-only');
    const html = renderToStaticMarkup(React.createElement(ResultReviewList, { answers }));
    if (text) assert.ok(html.includes(text));
    assert.ok(html.includes('(opioide) Morfina'));
    const migrated = buildSimulationAttemptInsertFromLocalPayload('student', { simulation: { ...insert, id: 'local-1' }, answers });
    assert.equal(migrated.answers[0].written_answer, text || null);
    assert.equal(migrated.answers[0].is_correct, answers[0].is_correct);
  }
});


test('respuesta escrita: confirmar requiere texto y bloquea un segundo envío', () => {
  const { SimulationQuestion } = load('src/components/SimulationQuestion.tsx');
  const question = JSON.parse(fs.readFileSync(path.join(root, 'src/data/enfermeriaOctubreDocumentoQuestions.json'), 'utf8')).find(q => q.source_format === 'answer-only');
  function findForm(element) {
    if (!element || typeof element !== 'object') return null;
    if (element.type === 'form') return element;
    for (const child of [element.props?.children].flat(Infinity)) {
      const found = findForm(child);
      if (found) return found;
    }
    return null;
  }
  let confirmed = 0;
  for (const props of [ { writtenAnswer: '' }, { writtenAnswer: '   ' }, { writtenAnswer: 'Morfina', disabled: true }, { writtenAnswer: 'Morfina', selectedOption: 'A' } ]) {
    findForm(SimulationQuestion({ question, onSelect() {}, onConfirmWritten() { confirmed++; }, ...props })).props.onSubmit({ preventDefault() {} });
  }
  assert.equal(confirmed, 0);
  findForm(SimulationQuestion({ question, writtenAnswer: 'Morfina', onSelect() {}, onConfirmWritten() { confirmed++; } })).props.onSubmit({ preventDefault() {} });
  assert.equal(confirmed, 1);
});


test('septiembre: muestra exactamente las 3-5 alternativas de cada documento', () => {
  const bank = JSON.parse(fs.readFileSync(path.join(root, 'src/data/enfermeriaIntegralSeptiembreQuestions.json'), 'utf8'));
  const { SimulationQuestion } = load('src/components/SimulationQuestion.tsx');
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  for (const question of bank) {
    const html = renderToStaticMarkup(React.createElement(SimulationQuestion, { question, onSelect: () => {} }));
    const count = 'abcde'.split('').filter(k => question['option_' + k]).length;
    assert.equal((html.match(/<button /g) ?? []).length, count, question.id);
    assert.ok(!html.includes('Escribe tu respuesta'));
  }
});

test('quinta opción: selección, calificación, historial y migración conservan E y su texto', () => {
  const bank = JSON.parse(fs.readFileSync(path.join(root, 'src/data/enfermeriaIntegralSeptiembreQuestions.json'), 'utf8'));
  const source = bank.find(q => q.option_e);
  const { buildSimulationAttemptInsert, simulationAttemptToAnswers, buildSimulationAttemptInsertFromLocalPayload } = load('src/lib/supabaseSimulationAttempts.ts');
  const { ResultReviewList } = load('src/components/ResultReviewList.tsx');
  const { SimulationQuestion } = load('src/components/SimulationQuestion.tsx');
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  for (const correct of ['C', 'E']) {
    const question = { ...source, correct_option: correct };
    const insert = buildSimulationAttemptInsert({ studentId: 'student', examSlug: 'enfermeria', startedAt: '2026-09-28T00:00:00Z', finishedAt: '2026-09-28T01:00:00Z', totalQuestions: 1, correctAnswers: correct === 'E' ? 1 : 0, incorrectAnswers: correct === 'E' ? 0 : 1, score: correct === 'E' ? 100 : 0, timeUsedSeconds: 60, questions: [question], selectedAnswers: { [question.id]: 'E' } });
    const answers = simulationAttemptToAnswers({ id: 'attempt', answers: JSON.parse(JSON.stringify(insert.answers)) });
    assert.equal(answers[0].selected_option, 'E');
    assert.equal(answers[0].is_correct, correct === 'E');
    assert.equal(answers[0].questions.option_e, question.option_e);
    const html = renderToStaticMarkup(React.createElement(ResultReviewList, { answers }));
    assert.ok(html.includes(question.option_e));
    const migrated = buildSimulationAttemptInsertFromLocalPayload('student', { simulation: { ...insert, id: 'local-1' }, answers });
    assert.equal(migrated.answers[0].selected_option, 'E');
    assert.equal(migrated.answers[0].question.option_e, question.option_e);
    const selected = [];
    const tree = SimulationQuestion({ question, onSelect: option => selected.push(option) });
    const walk = node => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) return node.forEach(walk);
      if (node.type === 'button' && node.key === 'E') node.props.onClick();
      walk(node.props?.children);
    };
    walk(tree);
    assert.deepEqual(selected, ['E']);
  }
});


test('Integral retirado: no aparece en catálogo ni acepta preguntas manuales nuevas', () => {
  const { getSimulatorSettingsCatalog, sanitizeSimulatorSettings } = load('src/lib/simulatorSettingsCatalog.ts');
  assert.equal(getSimulatorSettingsCatalog('enfermeria').phases.length, 5);
  assert.throws(() => validateManualQuestion({ ...valid, phase: 'componente-integral' }, 'enfermeria'));
  assert.deepEqual(sanitizeSimulatorSettings('enfermeria', { enabledPhases: ['componente-integral','fase-2'] }).enabledPhases, ['fase-2']);
  assert.deepEqual(sanitizeSimulatorSettings('enfermeria', { enabledPhases: ['componente-integral'] }).enabledPhases, ['fase-1','fase-2','fase-3','fase-4','fase-5']);
});
test('Integral retirado: ni ajustes antiguos ni banco remoto reintroducen sus preguntas', async () => {
  const retired = JSON.parse(fs.readFileSync(path.join(root,'src/data/enfermeriaIntegralSeptiembreQuestions.json')));
  const normal = manualQuestionForSimulator(row());
  for (const phases of [['componente-integral'],['componente-integral','fase-3'],['fase-1','fase-2','fase-3','fase-4','fase-5']]) {
    const settings = {...getDefaultSimulatorSettings('enfermeria'),enabledPhases:phases};
    const selected = await getLocalQuestionsForExam('enfermeria','retired',settings,retired);
    assert.ok(selected.every(q => q.phase !== 'componente-integral'));
    const direct = selectQuestionsForExam('enfermeria',[...retired,normal],'retired',settings);
    assert.ok(direct.every(q => q.phase !== 'componente-integral'));
  }
  assert.equal(selectQuestionsForExam('enfermeria',retired,'retired').length,0);
});
