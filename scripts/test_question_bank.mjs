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
const { validateBankEdit, applyBankOverrides } = load('src/lib/questionBank.ts');
const { repairQuestionText, getLocalQuestionsForExam } = load('src/lib/localQuestions.ts');
const source = JSON.parse(fs.readFileSync(path.join(root,'src/data/enfermeriaIntegralSeptiembreQuestions.json')));
const q = { ...repairQuestionText(source.find(q => q.id.endsWith('actualizado-011'))), revision: null };
const teacher = { id: 'teacher-id', role: 'teacher', career: 'Enfermería' };
function api(profile = teacher, result = { data: { updated_at: 'new-version' }, error: null }, bank = [q]) {
  const calls = [];
  const chain = {};
  for (const method of ['insert','update','eq','select']) chain[method] = (...args) => { calls.push([method,...args]); return chain; };
  chain.maybeSingle = async () => result;
  const route = loader({
    '@/lib/auth': { getCurrentAuthContext: async () => profile ? { profile } : null },
    '@/lib/questionBankServer': { getSharedBank: async career => { calls.push(['load', career]); return bank; } },
    '@/lib/supabaseAdmin': { getSupabaseAdminClient: () => ({ from: () => chain }) },
  })('src/app/api/teacher/question-bank/route.ts');
  return { route, calls };
}
const request = (body = q, origin = 'https://test.local') => new Request('https://test.local/api/teacher/question-bank', { method:'PATCH', headers:{'Content-Type':'application/json',origin},body:JSON.stringify(body) });
test('correcciones clínicas se aplican sin cambiar la fuente original', () => {
  assert.equal(q.correct_option,'B');
  assert.equal(repairQuestionText(source.find(q=>q.id.endsWith('actualizado-013'))).correct_option,'A');
  assert.equal(source.find(q=>q.id.endsWith('actualizado-011')).correct_option,'C');
});
test('API niega anónimos, estudiantes y origen externo antes de consultar el banco', async () => {
  for (const [profile,status] of [[null,401],[{...teacher,role:'student'},403]]) {
    const {route,calls}=api(profile); assert.equal((await route.PATCH(request())).status,status); assert.deepEqual(calls,[]);
  }
  const {route,calls}=api(); assert.equal((await route.PATCH(request(q,'https://foreign.test'))).status,403); assert.deepEqual(calls,[]);
});
test('API valida carrera, clave y edición concurrente sin mutar',async()=>{
  for(const [body,bank,status] of [[{...q,id:'foreign'},[q],404],[{...q,revision:'stale'},[q],409],[{...q,correct_option:'Z'},[q],400]]) {
    const {route,calls}=api(teacher,undefined,bank); assert.equal((await route.PATCH(request(body))).status,status); assert.ok(!calls.some(c=>['update','insert'].includes(c[0])));
  }
});
test('guarda atribución de sesión y conserva identidad y componente frente a inyección',async()=>{
  const {route,calls}=api(); const response=await route.PATCH(request({...q,updated_by:'other',phase:'fase-3',career_slug:'psicologia'}));
  assert.equal(response.status,200); const saved=calls.find(c=>c[0]==='insert')[1]; assert.equal(saved.updated_by,teacher.id); assert.equal(saved.career_slug,'enfermeria'); assert.equal(saved.question.phase,q.phase);
});
test('control optimista resuelve carreras de escritura y no informa éxitos falsos',async()=>{
  for(const [result,status] of [[{data:null,error:{code:'23505'}},409],[{data:null,error:null},409],[{data:null,error:{code:'failure'}},500]]) assert.equal((await api(teacher,result).route.PATCH(request())).status,status);
  const revised={...q,revision:'v1'};const {route,calls}=api(teacher,undefined,[revised]);assert.equal((await route.PATCH(request(revised))).status,200);assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='updated_at'&&c[2]==='v1'));
});
test('valida formatos parciales, respuesta escrita y quinta alternativa',()=>{
  const partial=source.find(q=>q.source_format==='partial-options'); assert.doesNotThrow(()=>validateBankEdit(partial,partial));
  assert.throws(()=>validateBankEdit({...q,option_b:''},q)); assert.throws(()=>validateBankEdit({...q,option_c:q.option_a},q));
  assert.doesNotThrow(()=>validateBankEdit({...q,option_e:'Quinta alternativa',correct_option:'E'},q));
  const written={...q,source_format:'answer-only',option_b:'',option_c:'',option_d:'',correct_option:'A'};assert.doesNotThrow(()=>validateBankEdit(written,written));
});
test('corrección persistida prevalece al generar nuevos intentos y no muta snapshots',async()=>{
  const active = { ...q, id: 'local-manual-active', phase: 'fase-1', category: 'Enfermería - Cuidado y Procedimientos Clínicos de Enfermería', component: 'Cuidado y procedimientos clínicos' };
  const before=structuredClone(q);const overrides=[{question_id:active.id,question:{...active,explanation:'Nueva explicación documentada',correct_option:'D'},updated_at:'v2'}];
  const {getDefaultSimulatorSettings}=load('src/lib/simulatorSettingsCatalog.ts');
  const questions=await getLocalQuestionsForExam('enfermeria','test-bank',{...getDefaultSimulatorSettings('enfermeria'),enabledPhases:['fase-1']},[active],pool=>applyBankOverrides(pool.filter(item=>item.id===active.id),overrides));
  assert.equal(questions.find(item=>item.id===active.id).correct_option,'D');assert.deepEqual(q,before);
});
