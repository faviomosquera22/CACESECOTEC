import { ClipboardCheck, Lightbulb, Target } from "lucide-react";
import type { SimulationAnswerWithQuestion } from "@/lib/database.types";
import { formatScore } from "@/lib/format";
import {
  buildPerformanceCategoryInsights,
  buildPerformanceRecommendations,
} from "@/lib/performanceInsights";

type ResultPerformanceSummaryProps = {
  answers: SimulationAnswerWithQuestion[];
};

export function ResultPerformanceSummary({
  answers,
}: ResultPerformanceSummaryProps) {
  const insights = buildPerformanceCategoryInsights(answers);
  const frequentErrors = insights
    .filter((insight) => insight.incorrect > 0 || insight.unanswered > 0)
    .slice(0, 3);
  const strengths = [...insights]
    .filter((insight) => insight.total >= 3 && insight.score >= 70)
    .sort((left, right) => right.score - left.score || right.total - left.total)
    .slice(0, 2);
  const recommendations = buildPerformanceRecommendations(answers);

  if (answers.length === 0) {
    return null;
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
          <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-lg font-semibold tracking-normal text-slate-950">
            Resumen final del desempeño
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Lectura rápida por áreas clínicas: primero aparecen los temas que
            más conviene reforzar para subir el puntaje.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-red-600" aria-hidden="true" />
            <h4 className="text-sm font-semibold text-slate-950">
              Prioridades de refuerzo
            </h4>
          </div>
          {frequentErrors.length === 0 ? (
            <p className="mt-3 text-sm leading-6 text-slate-600">
              No se registraron errores en este intento.
            </p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {frequentErrors.map((insight) => (
                <li
                  key={insight.category}
                  className="rounded-lg bg-white px-3 py-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">
                        {insight.category}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {insight.description}
                      </p>
                    </div>
                    <p className="shrink-0 font-semibold text-red-600">
                      {formatScore(insight.score)}
                    </p>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-600">
                    {insight.correct}/{insight.total} correctas ·{" "}
                    {insight.incorrect} error
                    {insight.incorrect === 1 ? "" : "es"} ·{" "}
                    {insight.unanswered} sin responder. Repasa {insight.focus}.
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-sky-700" aria-hidden="true" />
            <h4 className="text-sm font-semibold text-slate-950">
              Plan para el siguiente intento
            </h4>
          </div>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {recommendations.map((recommendation) => (
              <li
                key={recommendation}
                className="rounded-lg bg-white px-3 py-2"
              >
                {recommendation}
              </li>
            ))}
          </ul>

          {strengths.length > 0 ? (
            <div className="mt-4 rounded-lg bg-white px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-normal text-emerald-700">
                Áreas fuertes
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {strengths
                  .map(
                    (insight) =>
                      `${insight.category} (${formatScore(insight.score)})`,
                  )
                  .join(" · ")}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
