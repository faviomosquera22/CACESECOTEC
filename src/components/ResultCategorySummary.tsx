import { BarChart3 } from "lucide-react";
import type { SimulationAnswerWithQuestion } from "@/lib/database.types";
import { formatScore } from "@/lib/format";

type ResultCategorySummaryProps = {
  answers: SimulationAnswerWithQuestion[];
};

type CategorySummary = {
  category: string;
  total: number;
  correct: number;
  score: number;
};

function getCategoryName(answer: SimulationAnswerWithQuestion) {
  return answer.questions?.category?.trim() || "Sin categoría";
}

function buildCategorySummaries(
  answers: SimulationAnswerWithQuestion[],
): CategorySummary[] {
  const summaries = new Map<string, Omit<CategorySummary, "score">>();

  answers.forEach((answer) => {
    const category = getCategoryName(answer);
    const current = summaries.get(category) ?? {
      category,
      total: 0,
      correct: 0,
    };

    current.total += 1;
    current.correct += answer.is_correct === true ? 1 : 0;
    summaries.set(category, current);
  });

  return Array.from(summaries.values())
    .map((summary) => ({
      ...summary,
      score:
        summary.total > 0
          ? Math.round((summary.correct / summary.total) * 10000) / 100
          : 0,
    }))
    .sort((left, right) => right.total - left.total || left.category.localeCompare(right.category));
}

function getBarColor(score: number) {
  if (score >= 70) {
    return "bg-emerald-500";
  }

  if (score >= 50) {
    return "bg-sky-500";
  }

  return "bg-red-500";
}

export function ResultCategorySummary({ answers }: ResultCategorySummaryProps) {
  const summaries = buildCategorySummaries(answers);

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
            Identifica las áreas con mejor rendimiento y las que requieren refuerzo.
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
                <div>
                  <h4 className="text-sm font-semibold text-slate-950">
                    {summary.category}
                  </h4>
                  <p className="mt-1 text-xs text-slate-500">
                    {summary.correct} de {summary.total} correctas
                  </p>
                </div>
                <p className="text-lg font-semibold text-slate-950">
                  {formatScore(summary.score)}
                </p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-lg bg-white">
                <div
                  className={`h-full rounded-lg ${getBarColor(summary.score)}`}
                  style={{ width: `${safeScore}%` }}
                />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
