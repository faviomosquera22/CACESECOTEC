"use client";
import { useState } from "react";
import { BankRemovalButton } from "@/components/BankRemovalButton";
import { removedComponentIds, type BankRemoval } from "@/lib/bankRemovals";
import { getSimulatorSettingsCatalog } from "@/lib/simulatorSettingsCatalog";
import type { CustomComponent } from "@/lib/customComponents";
import type { StudentCareerSlug } from "@/lib/studentCareer";

export function BankComponentManager({ career, custom, removals }: { career: StudentCareerSlug; custom: CustomComponent[]; removals: BankRemoval[] }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const active = getSimulatorSettingsCatalog(career, custom, removedComponentIds(removals)).phases;
  const trash = removals.filter(row => row.removed && row.label.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es")));
  return <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
    <h3 className="text-xl font-semibold">Administrar componentes y eliminados</h3>
    <p className="text-sm text-slate-600">Los componentes y el banco se comparten entre docentes de la carrera. Eliminar un componente retira también sus preguntas de los próximos intentos y conserva el historial.</p>
    <details><summary className="cursor-pointer font-semibold text-sky-800">Componentes activos ({active.length})</summary>
      <ul className="mt-3 divide-y divide-slate-200">{active.map(component => <li key={component.key} className="flex flex-wrap items-start justify-between gap-3 py-3"><span className="pt-2 text-sm font-semibold">{component.label}</span><BankRemovalButton kind="component" id={component.key} label={component.label} version={removals.find(row => row.kind === "component" && row.target_id === component.key)?.updated_at ?? null}/></li>)}</ul>
      {!active.length && <p className="py-3 text-sm">No hay componentes activos. Restaura uno o crea un componente nuevo.</p>}
    </details>
    <details><summary className="cursor-pointer font-semibold text-sky-800">Eliminados ({removals.filter(row => row.removed).length})</summary>
      <p className="mt-3 text-sm text-slate-600">Al restaurar un componente reaparecen sus preguntas, salvo las eliminadas individualmente. Tus preguntas manuales solo son visibles para ti.</p>
      <label className="mt-3 block text-sm">Buscar en eliminados<input type="search" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="mt-2 w-full rounded-lg border border-slate-300 p-3"/></label>
      <ul className="mt-3 space-y-3">{trash.slice(page * 20, (page + 1) * 20).map(row => <li key={`${row.kind}:${row.target_id}`} className="rounded-lg border p-3"><p className="mb-2 text-sm"><strong>{row.kind === "component" ? "Componente" : row.owner_id ? "Mi pregunta manual" : "Pregunta"}:</strong> {row.label}</p><BankRemovalButton kind={row.kind} id={row.target_id} label={row.label} version={row.updated_at} restore personal={!!row.owner_id}/></li>)}</ul>
      {!trash.length && <p className="py-3 text-sm text-slate-600">No hay elementos eliminados con este filtro.</p>}
      {trash.length > 20 && <div className="mt-3 flex items-center gap-3 text-sm"><button disabled={!page} onClick={() => setPage(page - 1)} className="rounded-lg border p-2 disabled:opacity-40">Anterior</button><span>Página {page + 1}</span><button disabled={(page + 1) * 20 >= trash.length} onClick={() => setPage(page + 1)} className="rounded-lg border p-2 disabled:opacity-40">Siguiente</button></div>}
    </details>
  </section>;
}
