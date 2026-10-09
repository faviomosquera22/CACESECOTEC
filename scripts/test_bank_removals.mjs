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
const {filterActiveBank, removedComponentIds} = load('src/lib/bankRemovals.ts');
const {getSimulatorSettingsCatalog, sanitizeSimulatorSettings, getDefaultSimulatorSettings} = load('src/lib/simulatorSettingsCatalog.ts');
const {getLocalQuestionsForExam} = load('src/lib/localQuestions.ts');
const q = {id:'local-pdf-test', question_text:'Seleccione una opción de verificación', option_a:'Primera opción', option_b:'Segunda opción', option_c:'Tercera opción', option_d:'Cuarta opción', correct_option:'B', phase:'fase-1', category:'Enfermería - Cuidado y procedimientos clínicos', difficulty:'Media', revision:null};
const teacher = {id:'teacher-one',role:'teacher',career:'Enfermería'};
const removal = (kind='question', id=q.id, removed=true) => ({career_slug:'enfermeria',kind,target_id:id,label:'Prueba',owner_id:null,removed,updated_by:teacher.id,updated_at:'version-1'});
const request=(body,origin='https://test.local') => new Request('https://test.local/api/teacher/bank-removals',{method:'PATCH',headers:{'Content-Type':'application/json',origin},body:JSON.stringify(body)});
const body={kind:'question',id:q.id,remove:true,version:null,revision:null};
function api({profile=teacher,previous=null,bank=[q],manual=[],custom=[],result,readError=null}={}) {
 const calls=[]; let mutation=false;
 const query={select(){return this},eq(...args){calls.push(['eq',...args]);return this},insert(value){mutation=true;calls.push(['insert',value]);return this},update(value){mutation=true;calls.push(['update',value]);return this},async maybeSingle(){return mutation ? result??{data:removal(),error:null} : {data:previous,error:readError};}};
 const route=loader({
  '@/lib/auth':{getCurrentAuthContext:async()=>profile?{profile,supabase:{}}:null},
  '@/lib/supabaseAdmin':{getSupabaseAdminClient:()=>({from:table=>{calls.push(['table',table]);return query}})},
  '@/lib/questionBankServer':{getSharedBank:async(career,all)=>{calls.push(['bank',career,all]);return bank;}},
  '@/lib/customComponentsServer':{getCustomComponents:async()=>custom},
  '@/lib/manualQuestionsServer':{getManualQuestions:async(_,teacherId,career)=>{calls.push(['manual',teacherId,career]);return manual;}}
 })('src/app/api/teacher/bank-removals/route.ts');
 return {route,calls};
}
test('eliminación/restauración exige sesión docente y mismo origen antes de leer la base',async()=>{
 for(const [profile,origin,status] of [[null,'https://test.local',401],[{...teacher,role:'student'},'https://test.local',403],[teacher,'https://foreign.test',403]]) {
  const {route,calls}=api({profile}); assert.equal((await route.PATCH(request(body,origin))).status,status);assert.equal(calls.length,0);
 }
});
test('la baja comparte solo la carrera autenticada y atribuye el cambio a la sesión',async()=>{
 const {route,calls}=api();assert.equal((await route.PATCH(request({...body,career_slug:'psicologia',updated_by:'other'}))).status,200);
 const inserted=calls.find(c=>c[0]==='insert')[1];assert.equal(inserted.career_slug,'enfermeria');assert.equal(inserted.updated_by,teacher.id);assert.equal(inserted.removed,true);
 assert.ok(calls.some(c=>c[0]==='bank'&&c[2]===true));
});
test('no elimina preguntas ajenas, componentes inexistentes ni el Integral histórico',async()=>{
 for(const [change,config] of [[{id:'foreign'},{}],[{kind:'component',id:'componente-integral'},{}],[{kind:'component',id:'custom-foreign'},{}],[{id:'local-manual-foreign'},{}]]) {
  const {route,calls}=api(config);assert.equal((await route.PATCH(request({...body,...change}))).status,404);assert.ok(!calls.some(c=>c[0]==='insert'||c[0]==='update'));
 }
});
test('manuales: solo el propietario elimina/restaura y queda registrada la propiedad',async()=>{
 const own={id:'own',question_text:'Pregunta privada'};const {route,calls}=api({manual:[own]});
 assert.equal((await route.PATCH(request({...body,id:'local-manual-own'}))).status,200);
 assert.equal(calls.find(c=>c[0]==='insert')[1].owner_id,teacher.id);
 assert.ok(calls.some(c=>c[0]==='manual'&&c[1]===teacher.id&&c[2]==='enfermeria'));
 const foreign=api({previous:{...removal(),owner_id:'other'}});assert.equal((await foreign.route.PATCH(request({...body,remove:false,version:'version-1'}))).status,404);
});
test('control de versiones evita eliminar correcciones nuevas o sobrescribir restauraciones',async()=>{
 for(const config of [{previous:removal()},{bank:[{...q,revision:'new-revision'}]}]) {
  const {route,calls}=api(config);assert.equal((await route.PATCH(request(body))).status,409);assert.ok(!calls.some(c=>c[0]==='insert'||c[0]==='update'));
 }
 for(const [result,status] of [[{data:null,error:{code:'23505'}},409],[{data:null,error:null},409],[{data:null,error:{code:'failure'}},500]])assert.equal((await api({result}).route.PATCH(request(body))).status,status);
 assert.equal((await api({readError:{code:'failure'}}).route.PATCH(request(body))).status,500);
});
test('restaurar cambia el marcador sin borrar fuentes y preserva su versión',async()=>{
 const {route,calls}=api({previous:removal()});assert.equal((await route.PATCH(request({...body,remove:false,version:'version-1'}))).status,200);
 assert.equal(calls.find(c=>c[0]==='update')[1].removed,false);assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='updated_at'&&c[2]==='version-1'));
});
test('componente eliminado oculta base y PDF; restaurarlo no revive preguntas borradas individualmente',()=>{
 const questions=[q,{...q,id:'local-pdf-other'},{...q,id:'local-manual-own',phase:'fase-2'}];const original=structuredClone(questions);
 for(const career of ['enfermeria','psicologia']){
  const removals=[removal('component','fase-1'),removal('question',q.id)];assert.deepEqual(filterActiveBank(career,questions,removals).map(q=>q.id),['local-manual-own']);
  removals[0].removed=false;assert.deepEqual(filterActiveBank(career,questions,removals).map(q=>q.id),['local-pdf-other','local-manual-own']);
 }
 assert.deepEqual(questions,original);
});
test('catálogo y ajustes no reintroducen componentes eliminados ni activan otros en su lugar',()=>{
 const custom=[{key:'custom-one',label:'Nuevo',description:''}];const removed=['fase-1','custom-one'];
 assert.ok(!getSimulatorSettingsCatalog('enfermeria',custom,removed).phases.some(p=>removed.includes(p.key)));
 assert.deepEqual(sanitizeSimulatorSettings('enfermeria',{enabledPhases:['custom-one']},custom,removed).enabledPhases,[]);
 const all=getSimulatorSettingsCatalog('enfermeria').phases.map(p=>p.key);assert.deepEqual(sanitizeSimulatorSettings('enfermeria',null,[],all).enabledPhases,[]);
 assert.deepEqual(removedComponentIds([removal('component','fase-2'),removal('question',q.id)]),['fase-2']);
});
test('las eliminaciones se aplican antes de escoger nuevos intentos, sin alterar snapshots',async()=>{
 const settings=getDefaultSimulatorSettings('enfermeria'); const before=await getLocalQuestionsForExam('enfermeria','stable',settings,[q]);const snapshot=structuredClone(before);
 const removals=before.map(q=>removal('question',q.id));
 const after=await getLocalQuestionsForExam('enfermeria','stable',settings,[q],pool=>filterActiveBank('enfermeria',pool,removals));
 assert.ok(after.length>0);assert.ok(after.every(q=>!before.some(old=>old.id===q.id)));assert.deepEqual(before,snapshot);
});
