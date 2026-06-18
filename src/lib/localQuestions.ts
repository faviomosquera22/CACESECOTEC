import type { Question } from "@/lib/database.types";

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

const brokenOptionTexts = new Set([
  "abstenerse de",
  "alinear las",
  "de las",
  "es aquel en que se debe mantener una abstención de",
  "mejorar las",
]);

const brokenQuestionTexts = new Set([
  "lograr el conocimiento sobre el procedimiento y desarrollar su memoria",
  "orientar hacia la calidad de la atención y seguridad del paciente",
]);

function normalizeOptionText(value: string) {
  return value.trim().replace(/\.$/, "").toLowerCase();
}

export function isUsableQuestion(question: Question) {
  const questionText = question.question_text?.trim() ?? "";
  const options = [
    question.option_a,
    question.option_b,
    question.option_c,
    question.option_d,
  ].map((option) => option?.trim() ?? "");

  if (!questionText || options.some((option) => !option)) {
    return false;
  }

  if (brokenQuestionTexts.has(questionText.toLowerCase())) {
    return false;
  }

  if (/\bRespuestas?:\s*[-–]/i.test(questionText)) {
    return false;
  }

  if (/\b\d+\s*-\s*PAE\s*-\s*Paciente/i.test(questionText)) {
    return false;
  }

  if (/^(?:\s*[A-ZÁÉÍÓÚÑ]\s*){8,}/.test(questionText)) {
    return false;
  }

  if (/víase utiliza para/i.test(questionText)) {
    return false;
  }

  const normalizedOptions = options.map(normalizeOptionText);

  if (normalizedOptions.some((option) => brokenOptionTexts.has(option))) {
    return false;
  }

  return new Set(normalizedOptions).size === normalizedOptions.length;
}

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

function shuffleQuestions(questions: Question[]) {
  const shuffled = [...questions];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index],
    ];
  }

  return shuffled;
}

function selectDistributedExamQuestions(
  questions: Question[],
  distribution: ExamDistribution,
) {
  const usableQuestions = questions.filter(isUsableQuestion);
  const selected: Question[] = [];
  const targetCount = distribution.reduce((total, item) => total + item.count, 0);

  distribution.forEach(({ area, count }) => {
    selected.push(
      ...shuffleQuestions(
        usableQuestions.filter(
          (question) => getQuestionArea(question, distribution) === area,
        ),
      )
        .slice(0, count),
    );
  });

  if (selected.length < targetCount) {
    const selectedIds = new Set(selected.map((question) => question.id));
    const fillQuestions = shuffleQuestions(
      usableQuestions.filter((question) => !selectedIds.has(question.id)),
    );

    selected.push(...fillQuestions.slice(0, targetCount - selected.length));
  }

  return shuffleQuestions(dedupeQuestions(selected)).slice(0, targetCount);
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

  return shuffleQuestions(questions.filter(isUsableQuestion)).slice(0, 100);
}

export async function getLocalQuestionsForExam(examType: string) {
  if (examType === "enfermeria") {
    const { default: enfermeriaQuestions } = await import(
      "@/data/enfermeriaQuestions.json"
    );

    return selectNursingExamQuestions(enfermeriaQuestions as Question[]);
  }

  if (examType === "psicologia") {
    const { default: psicologiaQuestions } = await import(
      "@/data/psicologiaQuestions.json"
    );

    return selectPsychologyExamQuestions(psicologiaQuestions as Question[]);
  }

  return [];
}

export function isLocalQuestionSet(questions: Question[]) {
  return questions.some((question) => question.id.startsWith("local-"));
}
