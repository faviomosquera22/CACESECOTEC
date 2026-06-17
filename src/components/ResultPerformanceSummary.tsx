import { ClipboardCheck, Lightbulb, Target } from "lucide-react";
import type { SimulationAnswerWithQuestion } from "@/lib/database.types";
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
  const frequentErrors = buildPerformanceCategoryInsights(answers)
    .filter((insight) => insight.incorrect > 0)
    .slice(0, 4);
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
            Revisa tus errores frecuentes y las recomendaciones para el
            siguiente intento.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-red-600" aria-hidden="true" />
            <h4 className="text-sm font-semibold text-slate-950">
              Errores frecuentes
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
                  <span className="font-semibold text-slate-950">
                    {insight.category}
                  </span>
                  : {insight.incorrect} de {insight.total} incorrectas
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-sky-700" aria-hidden="true" />
            <h4 className="text-sm font-semibold text-slate-950">
              Recomendaciones
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
        </div>
      </div>
    </section>
  );
}
