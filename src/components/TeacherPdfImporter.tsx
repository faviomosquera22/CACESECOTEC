"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSimulatorSettingsCatalog } from "@/lib/simulatorSettingsCatalog";
import type { CustomComponent } from "@/lib/customComponents";
import type { StudentCareerSlug } from "@/lib/studentCareer";
import { optionLetters, validateImportedQuestion, type PdfCandidate } from "@/lib/pdfQuestionImport";
const field="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-950";
type Candidate=PdfCandidate & { selected:boolean; reviewed:boolean };
type Preview={importId:string;filename:string;pages:number;warnings:string[];candidates:Candidate[]};
export function TeacherPdfImporter({career,initialComponents,removedComponents=[]}:{removedComponents?:string[];career:StudentCareerSlug;initialComponents:CustomComponent[]}) {
  const router=useRouter();
  const [custom,setCustom]=useState(initialComponents);
  const [phase,setPhase]=useState("");
  const [name,setName]=useState("");
  const [file,setFile]=useState<File|null>(null);
  const [preview,setPreview]=useState<Preview|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const catalog=getSimulatorSettingsCatalog(career,custom,removedComponents);
  const selected=preview?.candidates.filter(q=>q.selected)??[];
  function edit(index:number,patch:Partial<Candidate>) {setPreview(current=>current?{...current,candidates:current.candidates.map(q=>q.index===index?{...q,...patch}:q)}:null);}
  async function createComponent(event:FormEvent) {
    event.preventDefault();setBusy(true);setError("");setNotice("");
    try {
      const response=await fetch("/api/teacher/components",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({label:name})});const data=await response.json();
      if(!response.ok)throw new Error(data.error||"No se pudo crear el componente.");
      setCustom(current=>[...current,data.component]);setPhase(data.component.key);setName("");setNotice(`Componente «${data.component.label}» creado. Después de importar, actívalo en tu Dashboard para usarlo con tus estudiantes.`);router.refresh();
    }catch(reason){setError(reason instanceof Error?reason.message:"No se pudo crear el componente.");}finally{setBusy(false);}
  }
  async function analyze(event:FormEvent) {
    event.preventDefault();if(!file)return;setBusy(true);setError("");setNotice("");setPreview(null);
    try {
      if(file.size>4*1024*1024)throw new Error("El PDF debe pesar como máximo 4 MB.");
      const form=new FormData();form.set("file",file);
      const response=await fetch("/api/teacher/pdf-imports",{method:"POST",body:form});const data=await response.json().catch(()=>null);
      if(!response.ok||!data)throw new Error(data?.error||"No se pudo analizar el PDF. Verifica que no supere 4 MB e inténtalo nuevamente.");
      setPreview({...data,candidates:data.candidates.map((q:PdfCandidate)=>({...q,selected:!q.duplicate&&!q.issues.length,reviewed:false}))});
    }catch(reason){setError(reason instanceof Error?reason.message:"No se pudo analizar el PDF.");}finally{setBusy(false);}
  }
  async function confirm() {
    if(!preview)return;setError("");setNotice("");
    if(!phase){setError("Selecciona el componente de destino.");return;}
    if(!selected.length){setError("Selecciona al menos una pregunta válida.");return;}
    for(const q of selected) {
      try{validateImportedQuestion(q);}catch(reason){setError(`Pregunta ${q.number}: ${(reason as Error).message}`);return;}
      if(q.issues.length&&!q.reviewed){setError(`Confirma la revisión de la pregunta ${q.number}.`);return;}
    }
    setBusy(true);
    try{
      const response=await fetch("/api/teacher/pdf-imports/confirm",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({importId:preview.importId,phase,questions:selected})});const data=await response.json();
      if(!response.ok)throw new Error(data.error||"No se pudo completar la importación.");
      setNotice(`${data.result.inserted} preguntas agregadas a «${catalog.phases.find(item=>item.key===data.result.phase)?.label??"componente seleccionado"}». ${(data.result.duplicates??0)+(data.skippedDuplicates??0)} duplicadas omitidas. Verifica que el componente esté habilitado en tu Dashboard.`);setPreview(null);router.refresh();
    }catch(reason){setError(reason instanceof Error?reason.message:"No se pudo importar. Puedes reintentar sin duplicar preguntas.");}finally{setBusy(false);}
  }
  return <section className="space-y-5 rounded-xl border border-sky-200 bg-white p-5 shadow-sm">
    <div><h3 className="text-xl font-semibold">Subir PDF e importar preguntas</h3><p className="mt-2 text-sm leading-6 text-slate-600">Solo docentes. Las preguntas y componentes se comparten en tu carrera; la activación para tus estudiantes se configura en tu Dashboard.</p><p className="mt-2 text-sm text-slate-600">PDF con texto seleccionable, hasta 4 MB y 80 páginas. Preguntas numeradas y opciones A–E en líneas separadas. Detecta negrita, subrayado, resaltado y claves escritas. Los escaneos necesitan OCR previo.</p></div>
    <div className="grid gap-5 lg:grid-cols-2">
      <label className="block text-sm font-semibold">Componente de destino<select disabled={busy} className={field} value={phase} onChange={e=>setPhase(e.target.value)}><option value="">Selecciona un componente</option>{catalog.phases.map(item=><option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
      <form onSubmit={createComponent}><label className="block text-sm font-semibold">Crear un componente nuevo<input disabled={busy} required minLength={3} maxLength={120} className={field} value={name} onChange={e=>setName(e.target.value)} placeholder="Ej.: Cuidados intensivos"/></label><button disabled={busy||name.trim().length<3} className="mt-2 rounded-lg border border-sky-300 px-4 py-2 text-sm font-semibold text-sky-800 disabled:opacity-50">Crear componente</button></form>
    </div>
    <form onSubmit={analyze} className="flex flex-wrap items-end gap-4 rounded-lg bg-slate-50 p-4"><label className="min-w-0 flex-1 text-sm font-semibold">Archivo PDF<input disabled={busy} required type="file" accept="application/pdf,.pdf" className={field} onChange={e=>{setFile(e.target.files?.[0]??null);setPreview(null);setError("");setNotice("");}}/></label><button disabled={busy||!file} className="rounded-lg bg-sky-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy?"Procesando…":"Analizar PDF"}</button></form>
    {error&&<p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {notice&&<div role="status" className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-900">{notice} <Link href="/teacher/dashboard" className="font-semibold underline">Ir al Dashboard</Link></div>}
    {preview&&<div className="space-y-4">
      <div className="rounded-lg bg-sky-50 p-4"><h4 className="font-semibold">Revisión de {preview.filename}</h4><p className="mt-2 text-sm">{preview.pages} páginas · {preview.candidates.length} preguntas detectadas · {selected.length} seleccionadas · {preview.candidates.filter(q=>q.duplicate).length} duplicadas · {preview.candidates.filter(q=>q.issues.length).length} por revisar</p><p className="mt-2 text-sm">Las preguntas sin clave segura o incompletas no se seleccionan automáticamente. Abre cada pregunta para revisarla. El PDF no se publica en el sitio.</p></div>
      {preview.warnings.length>0&&<ul className="list-inside list-disc rounded-lg bg-amber-50 p-4 text-sm text-amber-900">{preview.warnings.map((warning,i)=><li key={i}>{warning}</li>)}</ul>}
      <fieldset disabled={busy} className="space-y-3">
        {preview.candidates.map(q=><article key={q.index} className="rounded-lg border border-slate-200 p-4">
          <label className="flex items-start gap-3 text-sm font-semibold"><input type="checkbox" checked={q.selected} onChange={e=>edit(q.index,{selected:e.target.checked})} className="mt-1"/><span>Pregunta {q.number} · Página {q.page}{q.duplicate?" · Duplicada":""}{q.issues.length?" · Revisión necesaria":` · ${q.evidence}`}<span className="mt-2 block font-normal">{q.question_text}</span></span></label>
          <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold text-sky-800">Revisar y corregir esta pregunta</summary>
            {!!q.issues.length&&<ul className="mt-3 list-inside list-disc rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{q.issues.map((issue,i)=><li key={i}>{issue}</li>)}</ul>}
            <label className="mt-3 block text-sm font-semibold">Enunciado<textarea rows={4} maxLength={12000} className={field} value={q.question_text} onChange={e=>edit(q.index,{question_text:e.target.value,reviewed:false})}/></label>
            {optionLetters.map(letter=><label key={letter} className="mt-3 block text-sm">Opción {letter}<textarea rows={2} maxLength={3000} className={field} value={q[`option_${letter.toLowerCase()}` as "option_a"]} onChange={e=>edit(q.index,{[`option_${letter.toLowerCase()}`]:e.target.value,reviewed:false})}/></label>)}
            <label className="mt-3 block text-sm font-semibold">Respuesta correcta<select className={field} value={q.correct_option} onChange={e=>edit(q.index,{correct_option:e.target.value as Candidate["correct_option"],reviewed:false})}><option value="">Selecciona la respuesta correcta</option>{optionLetters.filter(letter=>q[`option_${letter.toLowerCase()}` as "option_a"].trim()).map(letter=><option key={letter} value={letter}>{letter}. {q[`option_${letter.toLowerCase()}` as "option_a"]}</option>)}</select></label>
            <label className="mt-3 block text-sm">Explicación (opcional)<textarea rows={3} maxLength={12000} className={field} value={q.explanation} onChange={e=>edit(q.index,{explanation:e.target.value})}/></label>
            {!!q.issues.length&&<label className="mt-4 flex gap-3 rounded-lg bg-amber-50 p-3 text-sm"><input type="checkbox" checked={q.reviewed} onChange={e=>edit(q.index,{reviewed:e.target.checked})}/><span>Revisé el enunciado, las opciones y la clave de esta pregunta. Está completa y puede importarse.</span></label>}
          </details>
        </article>)}
        <button type="button" onClick={confirm} disabled={!selected.length||!phase||busy} className="rounded-lg bg-emerald-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy?"Guardando…":`Agregar ${selected.length} preguntas al componente`}</button>
      </fieldset>
    </div>}
  </section>;
}
