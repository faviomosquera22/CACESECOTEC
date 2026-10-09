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
const load=loader();
const {parseQuestionLines,validateImportedQuestion,questionIdentity}=load('src/lib/pdfQuestionImport.ts');
const {getSimulatorSettingsCatalog,sanitizeSimulatorSettings,getDefaultSimulatorSettings,getPhaseKey}=load('src/lib/simulatorSettingsCatalog.ts');
const {selectQuestionsForExam}=load('src/lib/localQuestions.ts');
const lines=(options={})=>['1. ¿Cuál opción corresponde al caso de prueba?','A. Primera alternativa','B. Segunda alternativa','C. Tercera alternativa','D. Cuarta alternativa'].map((text,i)=>({text,page:1,bold:options.bold?.includes(i)??false,marked:options.marked?.includes(i)??false}));
const valid=parseQuestionLines(lines({bold:[2]}))[0];
test('detecta una única negrita, un subrayado o un resaltado y preserva el texto',()=>{
 for(const marks of [{bold:[2]},{marked:[2]}]){const [q]=parseQuestionLines(lines(marks));assert.equal(q.correct_option,'B');assert.deepEqual(q.issues,[]);assert.equal(q.option_b,'Segunda alternativa');}
});
test('rechaza claves ambiguas y no interpreta negrita común a todas las opciones como respuesta',()=>{
 for(const marks of [{},{bold:[1,2,3,4]},{bold:[1],marked:[2]},{marked:[1,2]}]){const [q]=parseQuestionLines(lines(marks));assert.equal(q.correct_option,'');assert.ok(q.issues.length);}
});
test('claves finales y escritas se validan contra las marcas; no se adivina una opción',()=>{
 const suffix=text=>({text,page:2,bold:false,marked:false});
 assert.equal(parseQuestionLines([...lines(),suffix('RESPUESTAS'),suffix('1. C')])[0].correct_option,'C');
 assert.equal(parseQuestionLines([...lines(),suffix('Respuesta correcta: Segunda alternativa')])[0].correct_option,'B');
 assert.equal(parseQuestionLines([...lines({bold:[1]}),suffix('Respuesta correcta: B')])[0].correct_option,'');
});
test('valida 3–5 opciones, no admite clave vacía, huecos ni duplicados',()=>{
 assert.doesNotThrow(()=>validateImportedQuestion({...valid,option_d:''}));
 assert.doesNotThrow(()=>validateImportedQuestion({...valid,option_e:'Quinta alternativa',correct_option:'E'}));
 for(const change of [{correct_option:''},{option_b:''},{option_b:valid.option_a},{option_a:'',option_b:''},{correct_option:'F'}])assert.throws(()=>validateImportedQuestion({...valid,...change}));
 assert.equal(questionIdentity(valid),questionIdentity({...valid,option_a:valid.option_b,option_b:valid.option_a,correct_option:'A'}));
});
test('alternativas mezcladas en una fila requieren revisión explícita',()=>{
 const input=lines({bold:[2]});input[1].text='A. Primera alternativa B. Texto de otra columna';
 assert.ok(parseQuestionLines(input)[0].issues.some(issue=>issue.includes('misma línea')));
});
test('componentes personalizados conservan selección, carrera y no reviven Integral',()=>{
 const custom=[{key:'custom-00000000-0000-4000-8000-000000000001',label:'Cuidados intensivos',description:''}];
 assert.equal(getSimulatorSettingsCatalog('enfermeria',custom).phases.length,6);
 assert.ok(!getDefaultSimulatorSettings('enfermeria').enabledPhases.includes(custom[0].key));
 const settings=sanitizeSimulatorSettings('enfermeria',{enabledPhases:[custom[0].key]},custom);assert.deepEqual(settings.enabledPhases,[custom[0].key]);
 const q={...validateImportedQuestion(valid),id:'local-pdf-test',phase:custom[0].key,component:custom[0].label};assert.equal(getPhaseKey('enfermeria',q),custom[0].key);
 assert.equal(selectQuestionsForExam('enfermeria',[q],'test',settings).length,1);
 assert.equal(selectQuestionsForExam('enfermeria',[q],'test',getDefaultSimulatorSettings('enfermeria')).length,0);
 assert.ok(!getSimulatorSettingsCatalog('enfermeria',custom).phases.some(x=>x.key==='componente-integral'));
});
test('extrae marcas de un PDF real: negrita, subrayado, fondo resaltado y conflictos',async()=>{
 const {jsPDF}=require('jspdf');const pdf=new jsPDF();
 const expected=['B','C','A','',''];
 for(let n=0;n<expected.length;n++){
   if(n)pdf.addPage();pdf.setFont('helvetica','normal');pdf.setFontSize(12);pdf.text(`${n+1}. Seleccione la alternativa del caso numero ${n+1}`,15,20);
   for(let i=0;i<4;i++){
     const y=35+i*12;
     if((n===2&&i===0)||(n===4&&i===2)){pdf.setFillColor(255,255,0);pdf.rect(14,y-5,80,7,'F');}
     pdf.setFont('helvetica',(n===0&&i===1)||(n===4&&i===1)?'bold':'normal');pdf.text(`${'ABCD'[i]}. Alternativa numero ${i+1}`,15,y);
     if(n===1&&i===2)pdf.line(15,y+1,70,y+1);
   }
 }
 const {extractPdfQuestions}=load('src/lib/pdfQuestionExtractor.ts');
 const result=await extractPdfQuestions(new Uint8Array(pdf.output('arraybuffer')));
 assert.equal(result.pages,5);assert.deepEqual(result.candidates.map(q=>q.correct_option),expected);
 assert.ok(result.candidates.slice(0,3).every(q=>q.issues.length===0));
 assert.ok(result.candidates.slice(3).every(q=>q.issues.length>0));
 await assert.rejects(()=>extractPdfQuestions(new Uint8Array([1,2,3])),/PDF válido/);
});
function routeLoader(profile, extra={}) {
 return loader({'@/lib/auth':{getCurrentAuthContext:async()=>profile?{profile}:null},...extra});
}
const teacher={id:'teacher-one',role:'teacher',career:'Enfermería'};
const request=(body={},url='https://app.test/api/teacher/components',origin='https://app.test')=>new Request(url,{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
test('las tres APIs rechazan estudiantes, sesiones ausentes y origen externo antes de usar la base',async()=>{
 const paths=['src/app/api/teacher/components/route.ts','src/app/api/teacher/pdf-imports/route.ts','src/app/api/teacher/pdf-imports/confirm/route.ts'];
 for(const p of paths)for(const [profile,origin,code]of[[null,'https://app.test',401],[{...teacher,role:'student'},'https://app.test',403],[teacher,'https://evil.test',403]]){
 const route=routeLoader(profile,{'@/lib/supabaseAdmin':{getSupabaseAdminClient:()=>{throw Error('No acceder');}}})(p);
 assert.equal((await route.POST(request({},undefined,origin))).status,code);
 }
});
test('confirmación impide importar vista previa de otro docente o carrera',async()=>{
 const calls=[];const query={select(){return this},eq(...args){calls.push(args);return this},async maybeSingle(){return {data:null,error:null}}};
 const route=routeLoader(teacher,{'@/lib/supabaseAdmin':{getSupabaseAdminClient:()=>({from:()=>query})}})('src/app/api/teacher/pdf-imports/confirm/route.ts');
 assert.equal((await route.POST(request({importId:'00000000-0000-4000-8000-000000000001',questions:[valid]}))).status,404);
 assert.ok(calls.some(([key,value])=>key==='teacher_id'&&value===teacher.id));assert.ok(calls.some(([key,value])=>key==='career_slug'&&value==='enfermeria'));
});
test('confirmación valida revisión y fase; la transacción recibe solo preguntas válidas',async()=>{
 const calls=[];let batch={id:'00000000-0000-4000-8000-000000000001',preview:{candidates:[{...valid,issues:['Revisar']} ]},filename:'prueba.pdf',created_at:new Date().toISOString(),status:'preview'};
 const query={select(){return this},eq(){return this},async maybeSingle(){return {data:batch,error:null}}};
 const route=routeLoader(teacher,{
 '@/lib/supabaseAdmin':{getSupabaseAdminClient:()=>({from:()=>query,rpc:async(...args)=>{calls.push(args);return {data:{inserted:1},error:null}}})},
 '@/lib/customComponentsServer':{getCustomComponents:async()=>[]},'@/lib/questionBankServer':{getSharedBank:async()=>[]}
 })('src/app/api/teacher/pdf-imports/confirm/route.ts');
 const body={importId:batch.id,questions:[valid],phase:'fase-1'};
 assert.equal((await route.POST(request(body))).status,400);assert.equal(calls.length,0);
 assert.equal((await route.POST(request({...body,phase:'componente-integral',questions:[{...valid,reviewed:true}]}))).status,400);
 assert.equal((await route.POST(request({...body,questions:[{...valid,reviewed:true}]}))).status,200);assert.equal(calls[0][1].p_teacher_id,teacher.id);assert.equal(calls[0][1].p_questions[0].question.correct_option,'B');
 batch={...batch,status:'completed',result:{inserted:1}};
 assert.equal((await route.POST(request(body))).status,200);assert.equal(calls.length,1);
});
