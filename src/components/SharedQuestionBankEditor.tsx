"use client";
import type { CustomComponent } from "@/lib/customComponents";
import { useState, type FormEvent } from "react";
import { getPhaseKey, getSimulatorSettingsCatalog } from "@/lib/simulatorSettingsCatalog";
import { validateBankEdit, type BankQuestion } from "@/lib/questionBank";
import type { StudentCareerSlug } from "@/lib/studentCareer";
const field = "mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-950";
const letters = ["a", "b", "c", "d", "e"] as const;
export function SharedQuestionBankEditor({ initialQuestions, career, customComponents = [] }: { initialQuestions: BankQuestion[]; career: StudentCareerSlug; customComponents?: CustomComponent[] }) {
  const [questions, setQuestions] = useState(initialQuestions);
  const [search, setSearch] = useState("");
  const [phase, setPhase] = useState("");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<BankQuestion | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const catalog = getSimulatorSettingsCatalog(career, customComponents);
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
  const visible = questions.filter(q => (!phase || getPhaseKey(career, q) === phase) && normalize(`${q.question_text} ${q.id}`).includes(normalize(search)));
  async function save(event: FormEvent) {
    event.preventDefault(); if (!editing) return;
    setError(""); setNotice("");
    try { validateBankEdit(editing, questions.find(q => q.id === editing.id)!); }
    catch (reason) { setError((reason as Error).message); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/teacher/question-bank", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editing) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo guardar.");
      setQuestions(current => current.map(q => q.id === data.question.id ? data.question : q));
      setEditing(null); setNotice("Corrección guardada en la base de datos. Se aplicará a los nuevos intentos de todos los docentes de esta carrera.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo guardar."); }
    finally { setBusy(false); }
  }
  return <section className="space-y-5">
    <div className="rounded-xl border border-sky-200 bg-sky-50 p-5">
      <h3 className="text-xl font-semibold">Banco compartido por componentes</h3>
      <p className="mt-2 text-sm text-slate-700">Consulta y corrige el banco de tu carrera. Los cambios se guardan para todos los docentes y se aplican en nuevos intentos. Los resultados de intentos anteriores conservan su versión original.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="text-sm font-semibold">Componente<select className={field} value={phase} disabled={busy} onChange={e => { setPhase(e.target.value); setPage(0); }}><option value="">Todos los componentes</option>{catalog.phases.map(item => <option key={item.key} value={item.key}>{item.label} ({questions.filter(q => getPhaseKey(career, q) === item.key).length})</option>)}</select></label>
        <label className="text-sm font-semibold">Buscar pregunta<input type="search" className={field} value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="Texto del enunciado o identificador" /></label>
      </div>
      <p className="mt-3 text-sm">{visible.length} de {questions.length} preguntas</p>
    </div>
    {notice && <p role="status" className="rounded-lg bg-emerald-50 p-4 text-emerald-800">{notice}</p>}
    {editing && <form onSubmit={save} className="rounded-xl border-2 border-sky-600 bg-white p-5" id="bank-question-edit">
      <h3 className="text-xl font-semibold">Corregir pregunta</h3>
      <p className="mt-1 break-all text-xs text-slate-500">{editing.id}</p>
      <fieldset disabled={busy} className="mt-4 space-y-4">
        <label className="block text-sm font-semibold">Enunciado<textarea required rows={5} maxLength={12000} className={field} value={editing.question_text} onChange={e => setEditing({ ...editing, question_text: e.target.value })} /></label>
        {letters.map(letter => <label key={letter} className="block text-sm font-semibold">Opción {letter.toUpperCase()}{letter === "e" ? " (opcional)" : ""}<textarea rows={2} maxLength={3000} className={field} value={editing[`option_${letter}`] || ""} onChange={e => setEditing({ ...editing, [`option_${letter}`]: e.target.value })} /></label>)}
        <p className="text-xs text-slate-500">Si el documento original contiene menos opciones, conserva ese formato sin inventar alternativas.</p>
        <label className="block text-sm font-semibold">Respuesta correcta<select className={field} value={editing.correct_option} onChange={e => setEditing({ ...editing, correct_option: e.target.value as BankQuestion["correct_option"] })}>{letters.filter(letter => editing[`option_${letter}`]?.trim()).map(letter => <option key={letter} value={letter.toUpperCase()}>{letter.toUpperCase()}. {editing[`option_${letter}`]}</option>)}</select></label>
        <label className="block text-sm font-semibold">Explicación y fuente de la corrección<textarea required rows={5} maxLength={12000} className={field} value={editing.explanation || ""} onChange={e => setEditing({ ...editing, explanation: e.target.value })} /></label>
        <div className="flex gap-3"><button type="submit" className="rounded-lg bg-sky-700 px-5 py-3 font-semibold text-white">{busy ? "Guardando…" : "Guardar corrección en el banco"}</button><button type="button" className="rounded-lg border px-4 py-3" onClick={() => { setEditing(null); setError(""); }}>Cancelar</button></div>
      </fieldset>
      {error && <p role="alert" className="mt-4 text-red-700">{error}</p>}
    </form>}
    {visible.slice(page * 30, (page + 1) * 30).map(q => <article key={q.id} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3"><p className="text-xs text-slate-500">{catalog.phases.find(item => item.key === getPhaseKey(career, q))?.label} · {q.revision ? "Corregida por docente" : "Banco base"}</p><button disabled={busy} className="font-semibold text-sky-700" onClick={() => { setEditing({ ...q }); setError(""); setNotice(""); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Corregir</button></div>
      <p className="whitespace-pre-wrap text-sm font-medium">{q.question_text}</p>
      <details><summary className="cursor-pointer text-sm text-sky-700">Ver opciones, respuesta y explicación</summary><ul className="mt-3 space-y-2 text-sm">{letters.filter(letter => q[`option_${letter}`]).map(letter => <li key={letter} className={q.correct_option === letter.toUpperCase() ? "font-semibold text-emerald-700" : "text-slate-600"}>{letter.toUpperCase()}. {q[`option_${letter}`]}{q.correct_option === letter.toUpperCase() ? " ✓ Correcta" : ""}</li>)}</ul><p className="mt-3 whitespace-pre-wrap text-sm">{q.explanation || "Sin explicación en el banco original."}</p><p className="mt-3 break-all text-xs text-slate-500">{q.id}</p></details>
    </article>)}
    {!visible.length && <p className="p-5 text-slate-500">No hay preguntas con estos filtros.</p>}
    <div className="flex items-center justify-between gap-4"><button className="rounded-lg border px-4 py-2 disabled:opacity-40" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</button><span className="text-sm">Página {page + 1} de {Math.max(1, Math.ceil(visible.length / 30))}</span><button className="rounded-lg border px-4 py-2 disabled:opacity-40" disabled={(page + 1) * 30 >= visible.length} onClick={() => setPage(page + 1)}>Siguiente</button></div>
  </section>;
}
