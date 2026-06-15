import type { Question } from "@/lib/database.types";
import enfermeriaQuestions from "@/data/enfermeriaQuestions.json";
import psicologiaQuestions from "@/data/psicologiaQuestions.json";

export const nursingExamDistribution = [
  {
    area: "Cuidado y Procedimientos Clínicos de Enfermería",
    percent: 30,
    count: 30,
  },
  {
    area: "Cuidados de la Mujer, Recién Nacido, Niño y Adolescente",
    percent: 24,
    count: 24,
  },
  {
    area: "Cuidados del Adulto y Adulto Mayor",
    percent: 20,
    count: 20,
  },
  {
    area: "Cuidado Familiar, Comunitario e Intercultural",
    percent: 17,
    count: 17,
  },
  {
    area: "Bases Educativas, Administrativas, Investigativas y Epidemiológicas",
    percent: 9,
    count: 9,
  },
];

export const psychologyExamDistribution = [
  {
    area: "Intervenciones clínicas y fundamentos de psicoterapia",
    percent: 27,
    count: 27,
  },
  {
    area: "Evaluación psicológica y psicodiagnóstico",
    percent: 24,
    count: 24,
  },
  {
    area: "Fundamentos de psicopatología en la Psicología",
    percent: 20,
    count: 20,
  },
  {
    area: "Ética, deontología y marco legal",
    percent: 19,
    count: 19,
  },
  {
    area: "Intervenciones psicosociales desde la Psicología",
    percent: 10,
    count: 10,
  },
];

export const examDistributionBySlug = {
  enfermeria: nursingExamDistribution,
  psicologia: psychologyExamDistribution,
};

type ExamDistribution = typeof nursingExamDistribution;

function getQuestionArea(question: Question, distribution: ExamDistribution) {
  const category = question.category ?? "";
  const match = distribution.find(({ area }) =>
    category.toLowerCase().includes(area.toLowerCase()),
  );

  return match?.area ?? distribution[0].area;
}

function dedupeQuestions(questions: Question[]) {
  const seen = new Set<string>();
  const result: Question[] = [];

  questions.forEach((question) => {
    if (seen.has(question.id)) {
      return;
    }

    seen.add(question.id);
    result.push(question);
  });

  return result;
}

function selectDistributedExamQuestions(
  questions: Question[],
  distribution: ExamDistribution,
) {
  const selected: Question[] = [];
  const targetCount = distribution.reduce((total, item) => total + item.count, 0);

  distribution.forEach(({ area, count }) => {
    selected.push(
      ...questions
        .filter((question) => getQuestionArea(question, distribution) === area)
        .slice(0, count),
    );
  });

  if (selected.length < targetCount) {
    const selectedIds = new Set(selected.map((question) => question.id));
    const fillQuestions = questions.filter(
      (question) => !selectedIds.has(question.id),
    );

    selected.push(...fillQuestions.slice(0, targetCount - selected.length));
  }

  return dedupeQuestions(selected).slice(0, targetCount);
}

export function selectNursingExamQuestions(questions: Question[]) {
  return selectDistributedExamQuestions(questions, nursingExamDistribution);
}

export function selectPsychologyExamQuestions(questions: Question[]) {
  return selectDistributedExamQuestions(questions, psychologyExamDistribution);
}

export function selectQuestionsForExam(examType: string, questions: Question[]) {
  if (examType === "enfermeria") {
    return selectNursingExamQuestions(questions);
  }

  if (examType === "psicologia") {
    return selectPsychologyExamQuestions(questions);
  }

  return questions.slice(0, 100);
}

export function getLocalQuestionsForExam(examType: string) {
  if (examType === "enfermeria") {
    return selectNursingExamQuestions(enfermeriaQuestions as Question[]);
  }

  if (examType === "psicologia") {
    return selectPsychologyExamQuestions(psicologiaQuestions as Question[]);
  }

  return [];
}

export function isLocalQuestionSet(questions: Question[]) {
  return questions.some((question) => question.id.startsWith("local-"));
}
