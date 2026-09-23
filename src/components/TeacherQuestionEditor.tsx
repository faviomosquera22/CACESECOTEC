"use client";

import { useState, type FormEvent } from "react";
import { getSimulatorSettingsCatalog } from "@/lib/simulatorSettingsCatalog";
import { validateManualQuestion, type ManualQuestionInput, type ManualQuestionRow } from "@/lib/manualQuestions";
import type { StudentCareerSlug } from "@/lib/studentCareer";

type Form = Omit<ManualQuestionInput, "correct_option"> & { correct_option: ManualQuestionInput["correct_option"] | "" };
const inputClass = "mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-950 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100";

export function TeacherQuestionEditor({ initialQuestions, career }: { initialQuestions: ManualQuestionRow[]; career: StudentCareerSlug }) {
  const catalog = getSimulatorSettingsCatalog(career);
  const blank = (): Form => ({ question_text: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_option: "", explanation: "", phase: career === "enfermeria" ? "componente-integral" : "fase-1", difficulty: "Media", published: false });
  const [questions, setQuestions] = useState(initialQuestions);
  const [form, setForm] = useState<Form>(blank);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");

  function reset() { setForm(blank()); setEditingId(null); setError(""); }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice("");
    let input: ManualQuestionInput;
    try { input = validateManualQuestion(form, career); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Revisa los campos."); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/teacher/questions", { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, id: editingId }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "No se pudo guardar.");
      const saved = payload.question as ManualQuestionRow;
      setQuestions(current => [saved, ...current.filter(item => item.id !== saved.id)]);
      reset();
      setNotice(saved.published ? "Pregunta publicada. Se incluirá en los próximos intentos de su componente." : "Borrador guardado. Todavía no aparece a tus estudiantes.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo guardar. Reintenta."); }
    finally { setBusy(false); }
  }
  const visible = questions.filter(question => question.question_text.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es")));
  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
    <form onSubmit={save} className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-xl font-semibold">{editingId ? "Editar pregunta" : "Agregar pregunta manual"}</h3>
      <fieldset disabled={busy} className="space-y-5 disabled:opacity-60">
        <label className="block text-sm font-semibold">Componente
          <select className={inputClass} value={form.phase} onChange={e => setForm({ ...form, phase: e.target.value as Form["phase"] })}>
            {catalog.phases.map(phase => <option key={phase.key} value={phase.key}>{phase.label}</option>)}
          </select>
        </label>
        <label className="block text-sm font-semibold">Enunciado o caso
          <textarea required rows={5} maxLength={12000} className={inputClass} value={form.question_text} onChange={e => setForm({ ...form, question_text: e.target.value })} />
        </label>
        <div className="space-y-3">
          <p className="text-sm font-semibold">Opciones de respuesta</p>
          {(["a", "b", "c", "d"] as const).map(letter => <label key={letter} className="block text-sm">Opción {letter.toUpperCase()}
            <textarea required rows={2} maxLength={3000} className={inputClass} value={form[`option_${letter}`]} onChange={e => setForm({ ...form, [`option_${letter}`]: e.target.value })} />
          </label>)}
        </div>
        <label className="block text-sm font-semibold">Respuesta correcta
          <select required className={inputClass} value={form.correct_option} onChange={e => setForm({ ...form, correct_option: e.target.value as Form["correct_option"] })}>
            <option value="">Selecciona la opción correcta</option>
            {["A", "B", "C", "D"].map(letter => <option key={letter} value={letter}>{letter}</option>)}
          </select>
        </label>
        {form.correct_option && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900"><strong>Se calificará como correcta: {form.correct_option}.</strong> {form[`option_${form.correct_option.toLowerCase()}` as "option_a"]}</p>}
        <label className="block text-sm font-semibold">Explicación de la respuesta correcta
          <textarea required rows={4} maxLength={12000} className={inputClass} value={form.explanation} onChange={e => setForm({ ...form, explanation: e.target.value })} />
        </label>
        <label className="block text-sm font-semibold">Dificultad
          <select className={inputClass} value={form.difficulty} onChange={e => setForm({ ...form, difficulty: e.target.value as Form["difficulty"] })}>
            {["Fácil", "Media", "Difícil"].map(value => <option key={value}>{value}</option>)}
          </select>
        </label>
        <label className="flex items-start gap-3 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm">
          <input type="checkbox" checked={form.published} onChange={e => setForm({ ...form, published: e.target.checked })} className="mt-1" />
          <span><strong>Publicar para mis estudiantes</strong><br />Si está desmarcado, se guarda como borrador. Puedes retirar una pregunta desmarcando esta opción.</span>
        </label>
        <div className="flex flex-wrap gap-3">
          <button className="rounded-lg bg-sky-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50" type="submit">{busy ? "Guardando…" : form.published ? "Guardar y publicar" : "Guardar borrador"}</button>
          {editingId && <button type="button" onClick={reset} className="rounded-lg border border-slate-300 px-4 py-3 text-sm">Cancelar edición</button>}
        </div>
      </fieldset>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}
    </form>
    <section className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-xl font-semibold">Mis preguntas ({questions.length})</h3>
        <p className="mt-2 text-sm text-slate-600">{questions.filter(q => q.published).length} publicadas · {questions.filter(q => !q.published).length} borradores</p>
        <label className="mt-4 block text-sm">Buscar por enunciado<input type="search" className={inputClass} value={search} onChange={e => setSearch(e.target.value)} /></label>
      </div>
      {visible.length === 0 && <p className="rounded-lg border border-dashed p-5 text-sm text-slate-500">{questions.length ? "No hay coincidencias." : "Todavía no has agregado preguntas. Completa el formulario para crear la primera."}</p>}
      {visible.map(question => <article key={question.id} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${question.published ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{question.published ? "Publicada" : "Borrador"}</span>
          <button type="button" disabled={busy} className="text-sm font-semibold text-sky-700" onClick={() => { setForm(question); setEditingId(question.id); setError(""); setNotice(""); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Editar</button>
        </div>
        <p className="text-xs text-slate-500">{catalog.phases.find(phase => phase.key === question.phase)?.label} · {question.difficulty}</p>
        <p className="whitespace-pre-wrap text-sm font-medium">{question.question_text}</p>
        <details className="text-sm"><summary className="cursor-pointer text-sky-700">Ver opciones y explicación</summary>
          <ul className="mt-3 space-y-2">{(["a", "b", "c", "d"] as const).map(letter => <li key={letter} className={question.correct_option === letter.toUpperCase() ? "font-semibold text-emerald-700" : "text-slate-600"}>{letter.toUpperCase()}. {question[`option_${letter}`]}{question.correct_option === letter.toUpperCase() ? " ✓ Correcta" : ""}</li>)}</ul>
          <p className="mt-3 whitespace-pre-wrap border-t pt-3">{question.explanation}</p>
        </details>
      </article>)}
    </section>
  </div>;
}
