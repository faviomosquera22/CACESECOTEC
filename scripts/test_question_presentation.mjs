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
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: file })((name) => {
    return name.startsWith('@/') ? JSON.parse(fs.readFileSync(path.join(root, 'src', name.slice(2)), 'utf8')) : require(name);
  }, module, module.exports);
  return module.exports;
}
const { getQuestionPresentation: present } = load('src/lib/questionPresentation.ts');
const relation = JSON.parse(fs.readFileSync(path.join(root, 'src/data/questionRelationPresentation.json'), 'utf8'));

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
