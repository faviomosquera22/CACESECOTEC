import { ArrowRight, History, TrendingUp } from "lucide-react";
import type { SimulationHistoryRecord } from "@/components/SimulationHistoryTable";
import { average, formatScore } from "@/lib/format";

type StudentAttemptInsightsProps = {
  simulations: SimulationHistoryRecord[];
};

function getScore(value: number | null | undefined) {
  return value ?? 0;
}

export function StudentAttemptInsights({
  simulations,
}: StudentAttemptInsightsProps) {
  if (simulations.length === 0) {
    return null;
  }

  const orderedOldestFirst = [...simulations].reverse();
  const firstAttempt = orderedOldestFirst[0];
  const latestAttempt = simulations[0];
  const previousAttempt = simulations[1] ?? null;
  const latestScore = getScore(latestAttempt.score);
  const previousScore = getScore(previousAttempt?.score);
  const firstScore = getScore(firstAttempt.score);
  const deltaPrevious = previousAttempt ? latestScore - previousScore : 0;
  const deltaFirst = latestScore - firstScore;
  const bestScore = Math.max(
    0,
    ...simulations.map((simulation) => getScore(simulation.score)),
  );
  const averageScore = average(simulations.map((simulation) => simulation.score));

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700 ring-1 ring-sky-100">
          <History className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-lg font-semibold tracking-normal text-slate-950">
            Historial de intentos
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Compara lo que respondiste antes, tu avance reciente y tu mejor
            resultado.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-500">Último intento</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">
            {formatScore(latestScore)}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-500">
            Cambio vs anterior
          </p>
          <p
            className={`mt-2 flex items-center gap-2 text-2xl font-semibold ${
              deltaPrevious >= 0 ? "text-emerald-700" : "text-red-700"
            }`}
          >
            <TrendingUp className="h-5 w-5" aria-hidden="true" />
            {previousAttempt
              ? `${deltaPrevious >= 0 ? "+" : ""}${formatScore(deltaPrevious)}`
              : "Primer intento"}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-500">
            Mejora acumulada
          </p>
          <p
            className={`mt-2 text-2xl font-semibold ${
              deltaFirst >= 0 ? "text-emerald-700" : "text-red-700"
            }`}
          >
            {simulations.length > 1
              ? `${deltaFirst >= 0 ? "+" : ""}${formatScore(deltaFirst)}`
              : "Sin comparación"}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-500">
            Mejor / promedio
          </p>
          <p className="mt-2 flex items-center gap-2 text-2xl font-semibold text-slate-950">
            {formatScore(bestScore)}
            <ArrowRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
            {formatScore(averageScore)}
          </p>
        </div>
      </div>
    </section>
  );
}
