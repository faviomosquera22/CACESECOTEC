"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Loader2, X } from "lucide-react";
import type { StudentCardData } from "@/components/StudentCard";

type TeacherOption = { id: string; name: string; email: string | null };

export function StudentTransfer({ students, onTransferred }: {
  students: StudentCardData[];
  onTransferred: (ids: string[]) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [teacherId, setTeacherId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const visible = students.filter((student) =>
    `${student.fullName} ${student.email}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );

  async function loadTeachers() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/teacher/students/transfer", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudieron cargar los docentes.");
      setTeachers(data.teachers);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron cargar los docentes.");
    } finally {
      setLoading(false);
    }
  }

  async function transfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !teacherId || !selected.length) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/teacher/students/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId, studentIds: selected }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo completar el traslado.");
      onTransferred(data.studentIds);
      const teacher = teachers.find((option) => option.id === teacherId);
      setMessage(`${data.updatedCount} estudiante(s) trasladado(s) a ${teacher?.name ?? "otro docente"}.${data.updatedCount < selected.length ? " Algunos estudiantes cambiaron de asignación y no se trasladaron. Revisa la lista actualizada." : ""}`);
      dialog.current?.close();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo completar el traslado.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <button type="button" disabled={!students.length} onClick={() => {
        setSelected([]);
        setTeacherId("");
        setQuery("");
        setTeachers([]);
        setMessage("");
        dialog.current?.showModal();
        void loadTeachers();
      }} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-sky-200 bg-white px-4 text-sm font-semibold text-sky-800 transition hover:bg-sky-50 disabled:opacity-50">
        <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
        Trasladar estudiantes
      </button>
      {message ? <p role="status" className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p> : null}
      <dialog ref={dialog} aria-labelledby="student-transfer-title" onCancel={(event) => { if (saving) event.preventDefault(); }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-2xl backdrop:bg-slate-950/40 backdrop:backdrop-blur-sm">
        <div className="flex items-start justify-between gap-4">
          <h3 id="student-transfer-title" className="text-xl font-semibold text-slate-950">Trasladar estudiantes</h3>
          <button type="button" aria-label="Cerrar traslado" disabled={saving} onClick={() => dialog.current?.close()} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"><X className="h-5 w-5" /></button>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">Selecciona estudiantes y un docente de tu misma carrera. Conservarán sus cuentas, historial y estado de acceso.</p>
        <form onSubmit={transfer}>
          <fieldset disabled={saving} className="mt-5 space-y-4 disabled:opacity-60">
            <label className="block text-sm font-semibold text-slate-700">Docente receptor
              <select required value={teacherId} disabled={loading || saving} onChange={(event) => setTeacherId(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3">
                <option value="">{loading ? "Cargando docentes…" : "Selecciona un docente"}</option>
                {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}{teacher.email ? ` (${teacher.email})` : ""}</option>)}
              </select>
            </label>
            {!loading && !teachers.length && !error ? <p className="text-sm text-amber-800">No hay otros docentes de tu carrera disponibles para recibir estudiantes.</p> : null}
            <label className="block text-sm font-semibold text-slate-700">Buscar estudiantes
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre o correo" className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3" />
            </label>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span aria-live="polite">{selected.length} seleccionado(s) · máximo 100</span>
              <button type="button" onClick={() => setSelected(visible.slice(0, 100).map((student) => student.id))} className="font-semibold text-sky-700">Seleccionar visibles</button>
              <button type="button" onClick={() => setSelected([])} className="text-slate-600">Limpiar</button>
            </div>
            <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200">
              {visible.map((student) => <label key={student.id} className="flex cursor-pointer items-center gap-3 border-b border-slate-100 p-3 last:border-0 hover:bg-slate-50">
                <input type="checkbox" checked={selected.includes(student.id)} disabled={saving || (selected.length >= 100 && !selected.includes(student.id))} onChange={(event) => setSelected((current) => event.target.checked ? [...current, student.id] : current.filter((id) => id !== student.id))} className="h-4 w-4 accent-sky-700" />
                <span className="min-w-0"><span className="block text-sm font-semibold text-slate-900">{student.fullName}</span><span className="block break-all text-xs text-slate-500">{student.email}</span></span>
              </label>)}
              {!visible.length ? <p className="p-4 text-sm text-slate-500">No hay estudiantes que coincidan.</p> : null}
            </div>
            <p className="text-sm leading-6 text-slate-600">Al confirmar, dejarán de aparecer en tu lista y el docente receptor podrá gestionar su acceso y consultar sus resultados. Se aplicará la configuración del simulador de ese docente.</p>
          </fieldset>
          {error ? <div role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}{!teachers.length ? <button type="button" disabled={loading || saving} onClick={() => void loadTeachers()} className="ml-2 underline">Reintentar cargar docentes</button> : null}</div> : null}
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" disabled={saving} onClick={() => dialog.current?.close()} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">Cancelar</button>
            <button type="submit" disabled={saving || loading || !teacherId || !selected.length} className="inline-flex items-center gap-2 rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}{saving ? "Trasladando…" : `Confirmar traslado (${selected.length})`}</button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
