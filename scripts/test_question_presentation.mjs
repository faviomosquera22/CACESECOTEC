import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
function load(relative) {
  const file = path.join(root, relative);
  const compiledModule = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: file })((name) => {
    return name.startsWith('@/') ? JSON.parse(fs.readFileSync(path.join(root, 'src', name.slice(2)), 'utf8')) : require(name);
  }, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}
const { getQuestionPresentation: present } = load('src/lib/questionPresentation.ts');
const relation = JSON.parse(fs.readFileSync(path.join(root, 'src/data/questionRelationPresentation.json'), 'utf8'));
const overrides = JSON.parse(fs.readFileSync(path.join(root, 'src/data/questionPresentationOverrides.json'), 'utf8'));

test('separates two relationship lists without pairing items or changing their text', () => {
  const result = present('Relacione: 1. Primer elemento. 2. Segundo elemento. a) Primera descripción. b) Segunda descripción.');
  assert.equal(result.introduction, 'Relacione:');
  assert.deepEqual(result.groups.map(group => group.items), [
    [{ label: '1', text: 'Primer elemento.' }, { label: '2', text: 'Segundo elemento.' }],
    [{ label: 'a', text: 'Primera descripción.' }, { label: 'b', text: 'Segunda descripción.' }],
  ]);
});

test('keeps clinical decimals, dosage and trailing question intact within enumerated text', () => {
  const result = present('Seleccione: 1. Administrar 1.5 mg cada 2.5 horas. 2. Medir 3.5 ml. ¿Cuál corresponde?');
  assert.equal(result.groups[0].items[0].text, 'Administrar 1.5 mg cada 2.5 horas.');
  assert.equal(result.groups[0].items[1].text, 'Medir 3.5 ml. ¿Cuál corresponde?');
});

test('leaves ambiguous sequences and clinical prose as plain text', () => {
  for (const text of [
    'Paciente de 1.5 años con temperatura de 38.5 grados.',
    'Paciente grado 1. Dolor grado 2. ¿Qué corresponde?',
    'Seleccione: 1. Primero. 3. Tercero.',
    'Seleccione: 1. Primero. 1. Repetido.',
    'Relacione: 1. Fragmento a) Mezclado 2. Fragmento b) Mezclado.',
  ]) assert.equal(present(text), null, text);
});

test('reconstructs only the exact imported table and preserves its source vocabulary', () => {
  const result = present(relation.sourceText);
  assert.deepEqual(result.groups.map(group => group.items.map(item => item.label)), [['1', '2', '3', '4'], ['a', 'b', 'd', 'c']]);
  const tokens = text => text.replace(/\b(?:[1-4]\.|[a-d]\))/g, '').toLowerCase().match(/[\p{L}\p{N}]+/gu).sort();
  const originalBody = relation.sourceText.split('Componente Característica ')[1];
  const renderedBody = result.groups.flatMap(group => group.items.map(item => item.text)).join(' ');
  assert.deepEqual(tokens(renderedBody), tokens(originalBody));
  assert.equal(present(relation.sourceText.replace('homologación', 'EDICIÓN DOCENTE')), null);
});

test('recognizes instructions ending in a period and keeps vaccine letters inside numbered items', () => {
  const bank = JSON.parse(fs.readFileSync(path.join(root, 'src/data/enfermeriaIntegral18And19Questions.json'), 'utf8'));
  const vaccine = present(bank.find(question => question.id.endsWith('18-094')).question_text);
  assert.equal(vaccine.groups.length, 1);
  assert.deepEqual(vaccine.groups[0].items.map(item => item.label), ['1', '2', '3', '4', '5', '6']);
  assert.equal(vaccine.groups[0].items[3].text, 'Tétanos neonatal - Hepatitis B.');
  assert.equal(vaccine.groups[0].items[4].text, 'Varicela, Rotavirus.');
  const symptoms = present(bank.find(question => question.id.endsWith('19-032')).question_text);
  assert.deepEqual(symptoms.groups[0].items.map(item => item.label), ['a', 'b', 'c', 'd', 'e', 'f']);
});

test('each reviewed table preserves every source word and label, including unequal column lengths', () => {
  const bank = JSON.parse(fs.readFileSync(path.join(root, 'src/data/enfermeriaIntegral18And19Questions.json'), 'utf8'));
  const tokens = text => text.toLowerCase().match(/[\p{L}\p{N}]+/gu).sort();
  for (const override of overrides) {
    assert.equal(bank.find(question => question.id === override.sourceId).question_text, override.sourceText);
    const result = present(override.sourceText);
    const start = override.sourceText.search(/(?:^|\s)([1-9]\d?|[a-zA-Z])[.)](?=\s)/);
    const body = override.sourceText.slice(start);
    const sourceMarkers = [...body.matchAll(/(?:^|\s)([1-9]\d?|[a-zA-Z])[.)](?=\s)/g)].map(marker => marker[1]).sort();
    const displayedMarkers = result.groups.flatMap(group => group.items.map(item => item.label)).sort();
    assert.deepEqual(displayedMarkers, sourceMarkers, override.sourceId);
    const words = body.replace(/(?:^|\s)([1-9]\d?|[a-zA-Z])[.)](?=\s)/g, ' ');
    assert.deepEqual(tokens(result.groups.flatMap(group => group.items.map(item => item.text)).join(' ')), tokens(words), override.sourceId);
    assert.equal(present(override.sourceText.replace(/\bRelacione\b/, 'EDICIÓN DOCENTE')), null, override.sourceId);
  }
  assert.deepEqual(present(overrides[0].sourceText).groups.map(group => group.items.length), [3, 6]);
});

test('supports parenthesized and dashed markers without splitting decimals, ranges or initials', () => {
  for (const text of ['Seleccione: 1) Uno. 2) Dos.', 'Seleccione. a- Uno. b- Dos.', 'Ordene. 1– Uno. 2– Dos.']) {
    assert.deepEqual(present(text).groups[0].items.map(item => item.text), ['Uno.', 'Dos.']);
  }
  for (const text of [
    'Paciente con dosis 1.5 mg y 2.5 mg. ¿Qué corresponde?',
    'Paciente con 1-2 episodios y 2-3 días de fiebre.',
    'El caso tiene grados 1. Hay dolor de grado 2. Revise.',
    'Relacione: 1. Uno. 3. Tres. a. Primero. b. Segundo.',
  ]) assert.equal(present(text), null, text);
});

test('the complete local bank has no unreviewed enumeration candidates', () => {
  const audit = JSON.parse(fs.readFileSync(path.join(root, 'docs/question-presentation-audit.json'), 'utf8'));
  assert.deepEqual(audit.needsReview, []);
  const nonLists = new Set(audit.reviewedNonLists.map(question => question.question_text));
  let scanned = 0;
  let formatted = 0;
  for (const source of fs.readdirSync(path.join(root, 'src/data')).filter(file => file.endsWith('Questions.json'))) {
    const questions = JSON.parse(fs.readFileSync(path.join(root, 'src/data', source), 'utf8'));
    for (const question of questions) {
      scanned++;
      const result = present(question.question_text);
      if (result) {
        formatted++;
        // Automatic layouts only separate existing contiguous text. PDF table
        // reconstructions have separate vocabulary-conservation tests above.
        if (![relation, ...overrides].some(override => override.sourceText === question.question_text)) {
          assert.ok(question.question_text.startsWith(result.introduction));
          for (const group of result.groups) for (const item of group.items) {
            assert.ok(question.question_text.includes(item.text), question.id);
          }
        }
      } else {
        const markers = [...question.question_text.matchAll(/(?:^|\s)([1-9]\d?|[a-zA-Z])(?:[.)]|[-–])(?=\s)/g)];
        if (markers.length >= 2 || /\b(?:relacione|relacionar|empareje|asocie)\b/i.test(question.question_text)) {
          assert.ok(nonLists.has(question.question_text), `Unreviewed enumeration in ${source}: ${question.id}`);
        }
      }
    }
  }
  assert.equal(scanned, audit.sources.filter(source => !source.source.startsWith('database:')).reduce((sum, source) => sum + source.scanned, 0));
  assert.equal(formatted, audit.formattedQuestions.filter(question => !question.source.startsWith('database:')).length);
  for (const entry of audit.formattedQuestions) {
    if (entry.source.startsWith('database:')) continue;
    const questions = JSON.parse(fs.readFileSync(path.join(root, 'src/data', entry.source), 'utf8'));
    assert.ok(present(questions.find(question => question.id === entry.id).question_text), entry.id);
  }
});
