"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BankRemoval } from "@/lib/bankRemovals";

type Props = { kind: BankRemoval["kind"]; id: string; label: string; version: string | null; revision?: string | null; restore?: boolean; personal?: boolean };
export function BankRemovalButton({ kind, id, label, version, revision, restore = false, personal = false }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  async function save() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/teacher/bank-removals", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, id, version, revision, remove: !restore }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo guardar el cambio.");
      setDone(true); setConfirming(false); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo guardar el cambio."); }
    finally { setBusy(false); }
  }
  if (done) return <p role="status" className="text-sm text-emerald-800">{restore ? "Restaurado." : "Eliminado del banco activo."}</p>;
  return <div className="text-sm">
    <button type="button" disabled={busy} className={`rounded-lg border px-3 py-2 font-semibold disabled:opacity-50 ${restore ? "border-sky-200 text-sky-800" : "border-red-200 text-red-700"}`} onClick={() => { setConfirming(true); setError(""); }}>{restore ? "Restaurar" : kind === "component" ? "Eliminar componente" : "Eliminar pregunta"}</button>
    {confirming && <div role="alertdialog" aria-label={restore ? "Confirmar restauración" : "Confirmar eliminación"} className="mt-3 max-w-xl space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-slate-900">
      <p className="font-semibold">{label}</p>
      <p>{restore ? "Volverá a estar disponible. Las preguntas eliminadas individualmente seguirán en Eliminados; los componentes deben estar habilitados en el Dashboard para usarse." : kind === "component" ? "Este componente y sus preguntas dejarán de estar disponibles para nuevos intentos de todos los docentes de esta carrera." : personal ? "La pregunta dejará de estar disponible para tus estudiantes." : "La pregunta dejará de estar disponible para nuevos intentos de todos los docentes de esta carrera."}</p>
      {!restore && <p>Los resultados anteriores se conservan. Puedes recuperarlo desde «Eliminados».</p>}
      <div className="flex flex-wrap gap-3"><button type="button" disabled={busy} onClick={save} className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? "Guardando…" : restore ? "Confirmar restauración" : "Confirmar eliminación"}</button><button type="button" disabled={busy} onClick={() => setConfirming(false)} className="rounded-lg border border-slate-400 px-4 py-2">Cancelar</button></div>
    </div>}
    {error && <p role="alert" className="mt-2 max-w-xl text-red-700">{error}</p>}
  </div>;
}
