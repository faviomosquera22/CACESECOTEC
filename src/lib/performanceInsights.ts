import type { SimulationAnswerWithQuestion } from "@/lib/database.types";

export type PerformanceCategoryInsight = {
  category: string;
  total: number;
  correct: number;
  incorrect: number;
  score: number;
};

function getCategoryName(answer: SimulationAnswerWithQuestion) {
  return answer.questions?.category?.trim() || "Sin categoría";
}

export function buildPerformanceCategoryInsights(
  answers: SimulationAnswerWithQuestion[],
) {
  const insights = new Map<
    string,
    Omit<PerformanceCategoryInsight, "score">
  >();

  answers.forEach((answer) => {
    const category = getCategoryName(answer);
    const current = insights.get(category) ?? {
      category,
      total: 0,
      correct: 0,
      incorrect: 0,
    };

    current.total += 1;
    if (answer.is_correct === true) {
      current.correct += 1;
    } else {
      current.incorrect += 1;
    }

    insights.set(category, current);
  });

  return Array.from(insights.values())
    .map((insight) => ({
      ...insight,
      score:
        insight.total > 0
          ? Math.round((insight.correct / insight.total) * 10000) / 100
          : 0,
    }))
    .sort(
      (left, right) =>
        right.incorrect - left.incorrect ||
        left.score - right.score ||
        left.category.localeCompare(right.category),
    );
}

export function buildPerformanceRecommendations(
  answers: SimulationAnswerWithQuestion[],
) {
  const categoryInsights = buildPerformanceCategoryInsights(answers);
  const weakCategories = categoryInsights
    .filter((insight) => insight.incorrect > 0)
    .slice(0, 3);
  const unansweredCount = answers.filter((answer) => !answer.selected_option)
    .length;
  const recommendations: string[] = [];

  weakCategories.forEach((insight) => {
    recommendations.push(
      `Repasa ${insight.category}: ${insight.incorrect} error${
        insight.incorrect === 1 ? "" : "es"
      } en este intento.`,
    );
  });

  if (unansweredCount > 0) {
    recommendations.push(
      `Practica gestión del tiempo: dejaste ${unansweredCount} pregunta${
        unansweredCount === 1 ? "" : "s"
      } sin responder.`,
    );
  }

  if (recommendations.length === 0 && answers.length > 0) {
    recommendations.push(
      "Mantén el ritmo: revisa las preguntas correctas y repite un caso cronometrado para consolidar.",
    );
  }

  return recommendations;
}
