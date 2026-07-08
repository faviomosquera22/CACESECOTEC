import type { Question, SimulationAnswerWithQuestion } from "@/lib/database.types";

export type PerformanceAnswerInput = Pick<
  SimulationAnswerWithQuestion,
  "selected_option" | "is_correct"
> & {
  questions: Pick<Question, "category" | "question_text"> | null;
};

export type PerformanceCategoryInsight = {
  category: string;
  description: string;
  focus: string;
  total: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  score: number;
};

type PerformanceArea = {
  key: string;
  category: string;
  description: string;
  focus: string;
};

const fallbackArea: PerformanceArea = {
  key: "sin-categoria",
  category: "Sin categoría",
  description: "Preguntas sin clasificación temática disponible.",
  focus: "Revisa los contenidos asociados a las preguntas incorrectas.",
};

const psychologyAreas: PerformanceArea[] = [
  {
    key: "crisis",
    category: "Intervención en crisis y seguridad",
    description:
      "Primeros auxilios psicológicos, riesgo suicida, trauma reciente y planes de seguridad.",
    focus:
      "priorización, evaluación de riesgo, contención, red de apoyo y seguimiento inmediato",
  },
  {
    key: "grupal",
    category: "Intervenciones clínicas grupales",
    description:
      "Manejo de grupos, psicoeducación, contención emocional, roles y dinámica grupal.",
    focus:
      "facilitación, límites del grupo, participación equilibrada y transferencia a la práctica",
  },
  {
    key: "asesoramiento",
    category: "Asesoramiento psicológico",
    description:
      "Acompañamiento en decisiones, clarificación de alternativas y límites del consejo directo.",
    focus:
      "análisis de alternativas, valores, consecuencias y diferencia entre asesoramiento y psicoterapia",
  },
  {
    key: "proceso",
    category: "Proceso psicoterapéutico",
    description:
      "Fase inicial, fase media, cierre, alianza, adherencia, monitoreo y reformulación.",
    focus:
      "objetivos por fase, alianza terapéutica, tareas, monitoreo de progreso y cierre",
  },
  {
    key: "encuadre",
    category: "Encuadre, demanda, ética y objetivos",
    description:
      "Motivo de consulta, consentimiento, confidencialidad, informes, límites y objetivos terapéuticos.",
    focus:
      "encuadre, confidencialidad, consentimiento informado, demanda y objetivos medibles",
  },
  {
    key: "psicoterapia",
    category: "Psicoterapia individual y formulación clínica",
    description:
      "Formulación de caso, técnicas clínicas individuales y factores de mantenimiento.",
    focus:
      "formulación colaborativa, factores de mantenimiento, exposición, activación y ajuste técnico",
  },
];

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function includesAny(value: string, keywords: string[]) {
  return keywords.some((keyword) => value.includes(keyword));
}

function getPsychologyPerformanceArea(answer: PerformanceAnswerInput) {
  const category = normalize(answer.questions?.category?.trim() ?? "");
  const questionText = normalize(answer.questions?.question_text?.trim() ?? "");
  const source = `${category} ${questionText}`;

  if (
    includesAny(source, [
      "crisis",
      "urgencia",
      "suicid",
      "autolesion",
      "riesgo",
      "plan de seguridad",
      "trauma",
      "accidente",
      "violencia",
      "fallecio",
      "arrestado",
      "shock",
    ])
  ) {
    return psychologyAreas[0];
  }

  if (
    includesAny(source, [
      "grupo",
      "grupal",
      "psicoeducativo",
      "participante",
      "miembro",
      "facilitador",
      "cuidadores",
    ])
  ) {
    return psychologyAreas[1];
  }

  if (
    includesAny(source, [
      "asesoramiento",
      "consejeria",
      "consejería",
      "consejo",
      "decision",
      "decidir",
      "vocacional",
      "divorciarse",
      "oferta laboral",
    ])
  ) {
    return psychologyAreas[2];
  }

  if (
    includesAny(source, [
      "fase",
      "cierre",
      "terminacion",
      "terminación",
      "alianza",
      "adherencia",
      "tarea",
      "monitoreo",
      "progreso",
      "devolucion",
      "devolución",
      "sesion preliminar",
      "sesiones preliminares",
    ])
  ) {
    return psychologyAreas[3];
  }

  if (
    includesAny(source, [
      "encuadre",
      "demanda",
      "consentimiento",
      "confidencialidad",
      "informe",
      "judicial",
      "objetivo",
      "mandato",
      "adolescente",
      "videollamada",
      "remota",
      "online",
    ])
  ) {
    return psychologyAreas[4];
  }

  return psychologyAreas[5];
}

function getPerformanceArea(answer: PerformanceAnswerInput) {
  const rawCategory = answer.questions?.category?.trim();

  if (!rawCategory) {
    return fallbackArea;
  }

  if (normalize(rawCategory).includes("psicolog")) {
    return getPsychologyPerformanceArea(answer);
  }

  return {
    key: rawCategory,
    category: rawCategory,
    description: "Área evaluada en este intento.",
    focus: "revisa los conceptos y procedimientos de las preguntas incorrectas",
  };
}

export function buildPerformanceCategoryInsights(
  answers: PerformanceAnswerInput[],
) {
  const insights = new Map<
    string,
    Omit<PerformanceCategoryInsight, "score">
  >();

  answers.forEach((answer) => {
    const area = getPerformanceArea(answer);
    const current = insights.get(area.key) ?? {
      category: area.category,
      description: area.description,
      focus: area.focus,
      total: 0,
      correct: 0,
      incorrect: 0,
      unanswered: 0,
    };

    current.total += 1;
    if (answer.is_correct === true) {
      current.correct += 1;
    } else if (!answer.selected_option) {
      current.unanswered += 1;
    } else {
      current.incorrect += 1;
    }

    insights.set(area.key, current);
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
        left.score - right.score ||
        right.total - left.total ||
        right.incorrect - left.incorrect ||
        left.category.localeCompare(right.category),
    );
}

export function buildPerformanceRecommendations(
  answers: PerformanceAnswerInput[],
) {
  const categoryInsights = buildPerformanceCategoryInsights(answers);
  const weakCategories = categoryInsights
    .filter((insight) => insight.incorrect > 0 || insight.unanswered > 0)
    .slice(0, 3);
  const unansweredCount = answers.filter((answer) => !answer.selected_option)
    .length;
  const recommendations: string[] = [];

  weakCategories.forEach((insight) => {
    const pendingText =
      insight.unanswered > 0
        ? `, con ${insight.unanswered} sin responder`
        : "";

    recommendations.push(
      `Prioriza ${insight.category}: tuviste ${insight.correct}/${insight.total} correctas${pendingText}. Repasa ${insight.focus}.`,
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
