import { BarChart3 } from "lucide-react";
import type { SimulationAnswerWithQuestion } from "@/lib/database.types";
import { formatScore } from "@/lib/format";
import { buildPerformanceCategoryInsights } from "@/lib/performanceInsights";

type ResultCategorySummaryProps = {
  answers: SimulationAnswerWithQuestion[];
};

function getBarColor(score: number) {
  if (score >= 70) {
    return "bg-emerald-500";
  }

  if (score >= 50) {
    return "bg-sky-500";
  }

  return "bg-red-500";
}

function getStatus(score: number) {
  if (score >= 70) {
    return {
      label: "Dominio adecuado",
      className: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    };
  }

  if (score >= 50) {
    return {
      label: "En progreso",
      className: "bg-sky-50 text-sky-700 ring-sky-100",
    };
  }

  return {
    label: "Reforzar primero",
    className: "bg-red-50 text-red-700 ring-red-100",
  };
}

export function ResultCategorySummary({ answers }: ResultCategorySummaryProps) {
  const summaries = buildPerformanceCategoryInsights(answers);

  if (summaries.length === 0) {
    return null;
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-sky-700 ring-1 ring-sky-100">
          <BarChart3 className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-lg font-semibold tracking-normal text-slate-950">
            Desempeño por categoría
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Las preguntas se agrupan por área clínica para que veas dónde
            reforzar primero y qué contenido repasar.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {summaries.map((summary) => {
          const safeScore = Math.min(100, Math.max(0, summary.score));

          return (
            <article
              key={summary.category}
              className="rounded-lg border border-slate-100 bg-slate-50 p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-slate-950">
                    {summary.category}
                  </h4>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {summary.description}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-lg font-semibold text-slate-950">
                    {formatScore(summary.score)}
                  </p>
                  <span
                    className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${getStatus(summary.score).className}`}
                  >
                    {getStatus(summary.score).label}
                  </span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-md bg-white px-2 py-2">
                  <p className="text-slate-500">Correctas</p>
                  <p className="mt-1 font-semibold text-slate-950">
                    {summary.correct}
                  </p>
                </div>
                <div className="rounded-md bg-white px-2 py-2">
                  <p className="text-slate-500">Incorrectas</p>
                  <p className="mt-1 font-semibold text-slate-950">
                    {summary.incorrect}
                  </p>
                </div>
                <div className="rounded-md bg-white px-2 py-2">
                  <p className="text-slate-500">Total</p>
                  <p className="mt-1 font-semibold text-slate-950">
                    {summary.total}
                  </p>
                </div>
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-lg bg-white">
                <div
                  className={`h-full rounded-lg ${getBarColor(summary.score)}`}
                  style={{ width: `${safeScore}%` }}
                />
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-600">
                Repasar: {summary.focus}.
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
