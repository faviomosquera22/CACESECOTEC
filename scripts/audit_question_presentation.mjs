import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const argument = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const databaseFile = argument('--database');
const outputFile = argument('--output');
const compiledModule = { exports: {} };
const code = ts.transpileModule(fs.readFileSync(path.join(root, 'src/lib/questionPresentation.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText;
vm.runInThisContext(`(function(require,module,exports){${code}\n})`)(name => {
  if (!name.startsWith('@/data/') || !name.endsWith('.json')) throw new Error(`Unexpected import: ${name}`);
  return JSON.parse(fs.readFileSync(path.join(root, 'src', name.slice(2)), 'utf8'));
}, compiledModule, compiledModule.exports);
const { getQuestionPresentation } = compiledModule.exports;

const sources = fs.readdirSync(path.join(root, 'src/data')).filter(file => file.endsWith('Questions.json')).sort();
const rows = sources.flatMap(source => JSON.parse(fs.readFileSync(path.join(root, 'src/data', source), 'utf8')).map(question => ({ source, ...question })));
if (databaseFile) {
  rows.push(...JSON.parse(fs.readFileSync(path.resolve(databaseFile), 'utf8')).map(question => ({ ...question, source: `database:${question.source}` })));
}
const reviewedNonLists = {
  'local-enfermeria-0247-411b8e3b80a2': 'Las cifras 10 y 5 son puntuaciones de dolor dentro del caso, no elementos de una lista.',
  'local-enfermeria-1931-1b67e4d8516c': 'H. influenzae tipo b. es el nombre del microorganismo, no una lista de literales.',
  'local-enfermeria-gpc-ivu-embarazo-052-3d206bd779ef': 'Se asocie forma parte de la pregunta clínica; no hay elementos para emparejar.',
  '78cee290-8bf5-5e33-a5d8-9aa60855bb6c': 'Copia en base de datos del caso de cistitis: se asocie no es una instrucción de emparejamiento.',
  'local-psicologia-componente-2-0114-82c2083e00': 'Se relacione con las tareas describe la validez de una prueba; no introduce una lista.',
};
const summary = new Map();
const formatted = [];
const nonLists = [];
const needsReview = [];
for (const question of rows) {
  const { source, id, question_text: text } = question;
  const count = summary.get(source) ?? { source, scanned: 0, formatted: 0 };
  count.scanned++;
  const presentation = getQuestionPresentation(text);
  if (presentation) {
    count.formatted++;
    formatted.push({ source, id, layout: presentation.groups.length === 2 ? 'two-columns' : 'list', introduction: presentation.introduction });
  } else {
    const markers = [...text.matchAll(/(?:^|\s)([1-9]\d?|[a-zA-Z])(?:[.)]|[-–])(?=\s)/g)];
    if (markers.length >= 2 || /\b(?:relacione|relacionar|empareje|asocie)\b/i.test(text)) {
      const entry = { source, id, question_text: text };
      if (reviewedNonLists[id]) nonLists.push({ ...entry, reason: reviewedNonLists[id] });
      else needsReview.push(entry);
    }
  }
  summary.set(source, count);
}
const report = {
  reviewedOn: argument('--review-date') ?? null,
  scope: 'Se revisan todas las filas de los siete bancos JSON, incluidos bancos anteriores. Las filas de base de datos son una instantánea opcional de solo lectura. Los totales incluyen copias entre fuentes y correcciones; no representan preguntas únicas ni solo preguntas activas.',
  databaseSnapshotIncluded: Boolean(databaseFile),
  totalRecordsScanned: rows.length,
  sources: [...summary.values()],
  formattedQuestions: formatted,
  reviewedNonLists: nonLists,
  needsReview,
};
if (outputFile) {
  const output = path.resolve(outputFile);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify({ scanned: rows.length, formatted: formatted.length, reviewedNonLists: nonLists.length, needsReview: needsReview.length, sources: report.sources }, null, 2));
if (needsReview.length) process.exitCode = 1;
