import type { Question } from "@/lib/database.types";

export const legacyFixedPsychologyAttemptSeed =
  "00000000-0000-4000-8000-000000000000";

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
    area: "Muestra rotativa del banco de Psicología",
    percent: 100,
    count: 80,
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

  if (!['A', 'B', 'C', 'D'].includes(question.correct_option)) {
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

function createSeededRandom(seed: string) {
  let state = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function getRandomSource(seed?: string) {
  return seed ? createSeededRandom(seed) : Math.random;
}

function shuffleQuestions(
  questions: Question[],
  random: () => number = Math.random,
) {
  const shuffled = [...questions];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(random() * (index + 1));
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
  random: () => number,
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
        random,
      )
        .slice(0, count),
    );
  });

  if (selected.length < targetCount) {
    const selectedIds = new Set(selected.map((question) => question.id));
    const fillQuestions = shuffleQuestions(
      usableQuestions.filter((question) => !selectedIds.has(question.id)),
      random,
    );

    selected.push(...fillQuestions.slice(0, targetCount - selected.length));
  }

  return shuffleQuestions(dedupeQuestions(selected), random).slice(
    0,
    targetCount,
  );
}

export function selectNursingExamQuestions(
  questions: Question[],
  attemptSeed?: string,
) {
  return selectDistributedExamQuestions(
    questions,
    nursingExamDistribution,
    getRandomSource(attemptSeed),
  );
}

export function selectPsychologyExamQuestions(
  questions: Question[],
  attemptSeed?: string,
) {
  if (attemptSeed === legacyFixedPsychologyAttemptSeed) {
    return questions.filter(isUsableQuestion).slice(0, 80);
  }

  // Cada intento toma una muestra nueva y cambia también el orden. El banco
  // completo permanece disponible para que estudiantes simultáneos no reciban
  // necesariamente el mismo examen.
  return shuffleQuestions(
    questions.filter(isUsableQuestion),
    getRandomSource(attemptSeed),
  ).slice(0, 80);
}

export function selectQuestionsForExam(
  examType: string,
  questions: Question[],
  attemptSeed?: string,
) {
  if (examType === "enfermeria") {
    return selectNursingExamQuestions(questions, attemptSeed);
  }

  if (examType === "psicologia") {
    return selectPsychologyExamQuestions(questions, attemptSeed);
  }

  return shuffleQuestions(
    questions.filter(isUsableQuestion),
    getRandomSource(attemptSeed),
  ).slice(0, 100);
}

export async function getLocalQuestionsForExam(
  examType: string,
  attemptSeed?: string,
) {
  if (examType === "enfermeria") {
    const { default: enfermeriaQuestions } = await import(
      "@/data/enfermeriaQuestions.json"
    );

    return selectNursingExamQuestions(
      enfermeriaQuestions as Question[],
      attemptSeed,
    );
  }

  if (examType === "psicologia") {
    const { default: psicologiaQuestions } = await import(
      "@/data/psicologiaQuestions.json"
    );

    return selectPsychologyExamQuestions(
      psicologiaQuestions as Question[],
      attemptSeed,
    );
  }

  return [];
}

export function isLocalQuestionSet(questions: Question[]) {
  return questions.some((question) => question.id.startsWith("local-"));
}
