import type { Question } from "@/lib/database.types";
import {
  filterQuestionsForSimulatorSettings,
  type SimulatorSettings,
} from "@/lib/simulatorSettingsCatalog";
import type { StudentCareerSlug } from "@/lib/studentCareer";

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
    count: 100,
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
  "pacientes de una tercera institución. ¿qué tipo de estudio se está utilizando para este caso?",
  "un electrocardiograma que reporta bloqueos cardíacos. ¿cuál es la alteración electrolítica que presenta el paciente?",
  "un electrocardiograma que reporta intervalo qt y segmento st prolongados. ¿cuál es la alteración electrolítica que presenta el paciente?",
  "una persona con discapacidad. excepto:",
  "¿a qué característica del proceso hace referencia el enunciado?",
  "¿cuál es la alteración que presenta el paciente?",
  "¿cuál es la escala que mide esas acciones?",
  "¿cuál es la etiqueta diagnóstica de enfermería a la que hace referencia el enunciado?",
  "¿cuál es la intervención de enfermería principal en este caso?",
  "¿cuál es la patología que presenta el rn?",
  "¿cuál es la teorizante que utilizaría en este caso?",
  "¿cuál es el diagnóstico de enfermería prioritario en este caso?",
  "¿cuál es el ruido que presenta el paciente?",
  "¿cuáles son las alteraciones que presenta el paciente?",
  "¿en qué etapa de la vida se encuentra el niño?",
  "¿qué alteración electrolítica presenta la paciente?",
  "¿qué diagnóstico considera para la planificación de cuidados de enfermería en la paciente?",
  "¿qué trastorno hipertensivo presenta la paciente?",
  "¿qué valor esencial se pone de manifiesto en esta situación?",
  "¿qué valores determinan esta alteración?",
  "lograr el conocimiento sobre el procedimiento y desarrollar su memoria",
  "orientar hacia la calidad de la atención y seguridad del paciente",
]);

const questionTextRepairs = new Map<string, string>([
  [
    "¿Qué tipo de familia representa la gráfica?",
    "En un familiograma se observa un hogar integrado por una pareja, sus hijos y otros parientes consanguíneos de generaciones anteriores. ¿Qué tipo de familia representa esta composición?",
  ],
  [
    "La representación gráfica del familiograma, pertenece a la familia N N. Identifique el tipo de familia, el ciclo vital del desarrollo familiar, y la relación de los hijos con su padre.",
    "Una pareja forma un nuevo hogar después de relaciones previas. Sus hijos de 20 y 17 años se encuentran próximos a abandonar el hogar y mantienen una relación conflictiva con su padre. Identifique el tipo de familia, el ciclo vital del desarrollo familiar y la relación de los hijos con su padre.",
  ],
  [
    "Observe la curva de peso para la edad e identifique el estado nutricional:",
    "En el control de crecimiento, el indicador de peso para la edad de un niño se ubica dentro del rango esperado para su edad. Identifique el estado nutricional:",
  ],
  [
    "Paciente que ingresa en el Servicio de Urgencias en contra de su voluntad, presenta los siguientes síntomas: Náuseas, vómitos, disnea, hipertensión arterial y edemas. Además, se encuentra obnubilado, con diagnóstico de síndrome de Alport hace cinco años, presenta un claro déficit de autocuidado de naturaleza alta. Se adopta un sistema compensatorio total. El objetivo prioritario es salvar la vida del paciente y estabilizar las funciones vitales. Presenta dificultad para tomar decisiones y llevar a cabo acciones de auto cuidado. No hace uso de los recursos sanitarios adecuadamente, déficit a nivel de juzgar/actuar, no se posiciona en necesidad de ayuda, negación de su estado actual, patrón de eliminación inadecuado, déficit de conocimiento sobre la ingesta apropiada y gran desvío de su estado de salud: no diferencia salud ideal/salud real. ¿Cuál de las teorizantes se pone de manifiesto en el caso anterior?",
    "Paciente que ingresa en el Servicio de Urgencias en contra de su voluntad, presenta los siguientes síntomas: Náuseas, vómitos, disnea, hipertensión arterial y edemas. Además, se encuentra obnubilado, con diagnóstico de síndrome de Alport hace cinco años, presenta un claro déficit de autocuidado de naturaleza alta. Se adopta un sistema compensatorio total. El objetivo prioritario es salvar la vida del paciente y estabilizar las funciones vitales. Presenta dificultad para tomar decisiones y llevar a cabo acciones de auto cuidado. No hace uso de los recursos sanitarios adecuadamente, déficit a nivel de juzgar/actuar, no se posiciona en necesidad de ayuda, negación de su estado actual, patrón de eliminación inadecuado, déficit de conocimiento sobre la ingesta apropiada y gran desvío de su estado de salud: no diferencia salud ideal/salud real. ¿Cuál de las teorizantes se pone de manifiesto en el caso descrito?",
  ],
  [
    "En el caso anterior, el manejo conservador descrito por los autores del texto incluye:",
    "Puérpera de 28 años, en el día 20 posparto, presenta loquios prolongados, sangrado irregular y un útero más grande y blando de lo esperado, sin fiebre, compatible con subinvolución uterina. El manejo conservador descrito por los autores incluye:",
  ],
  [
    "En el caso anterior, el tratamiento empírico inicial habitual y su duración recomendada son:",
    "Mujer en el día 10 posparto que amamanta presenta escalofríos, fiebre, taquicardia y una mama endurecida, enrojecida y dolorosa, compatible con mastitis puerperal. El tratamiento empírico inicial habitual y su duración recomendada son:",
  ],
  [
    "¿Cuál recomendación, corresponde a esta actividad?",
    "En un centro de salud, el profesional de enfermería encargado del programa de tuberculosis implementa medidas de control ambiental. ¿Cuál recomendación corresponde a esta actividad?",
  ],
  [
    "¿A qué tipo de incontinencia se refiere?",
    "Un adulto con hipertrofia prostática presenta goteo continuo de orina, sensación de vejiga llena y vaciamiento incompleto. ¿A qué tipo de incontinencia se refiere?",
  ],
  [
    "¿Qué condiciones clínicas corresponde a este estadio?",
    "Una paciente con VIH se encuentra en el estadio clínico II. ¿Qué condición clínica corresponde a este estadio?",
  ],
]);

type QuestionMedia = Pick<
  Question,
  "image_url" | "image_alt" | "image_width" | "image_height"
>;

const extendedFamilyMedia: QuestionMedia = {
  image_url: "/images/questions/familiograma-familia-extensa.png",
  image_alt:
    "Familiograma con una pareja, dos hijos y vínculos con familiares consanguíneos de generaciones anteriores.",
  image_width: 637,
  image_height: 455,
};
const reconstitutedFamilyMedia: QuestionMedia = {
  image_url: "/images/questions/familiograma-familia-reconstituida.png",
  image_alt:
    "Familiograma de una pareja formada después de relaciones previas, con hijos próximos a abandonar el hogar y vínculos conflictivos con el padre.",
  image_width: 948,
  image_height: 485,
};
const normalWeightCurveMedia: QuestionMedia = {
  image_url: "/images/questions/curva-peso-edad-normal.jpeg",
  image_alt:
    "Curva de peso para la edad cuyas mediciones se mantienen dentro del rango esperado, entre las líneas de puntuación Z menos uno y cero.",
  image_width: 384,
  image_height: 249,
};

const questionMediaByText = new Map<string, QuestionMedia>([
  ["¿Qué tipo de familia representa la gráfica?", extendedFamilyMedia],
  [
    "En un familiograma se observa un hogar integrado por una pareja, sus hijos y otros parientes consanguíneos de generaciones anteriores. ¿Qué tipo de familia representa esta composición?",
    extendedFamilyMedia,
  ],
  [
    "La representación gráfica del familiograma, pertenece a la familia N N. Identifique el tipo de familia, el ciclo vital del desarrollo familiar, y la relación de los hijos con su padre.",
    reconstitutedFamilyMedia,
  ],
  [
    "Una pareja forma un nuevo hogar después de relaciones previas. Sus hijos de 20 y 17 años se encuentran próximos a abandonar el hogar y mantienen una relación conflictiva con su padre. Identifique el tipo de familia, el ciclo vital del desarrollo familiar y la relación de los hijos con su padre.",
    reconstitutedFamilyMedia,
  ],
  [
    "Observe la curva de peso para la edad e identifique el estado nutricional:",
    normalWeightCurveMedia,
  ],
  [
    "En el control de crecimiento, el indicador de peso para la edad de un niño se ubica dentro del rango esperado para su edad. Identifique el estado nutricional:",
    normalWeightCurveMedia,
  ],
]);

const missingRequiredVisualPattern =
  /(?:\b(?:seg[uú]n|de acuerdo (?:con|al)|con base en|observe|observa|analice|interprete|revise)\s+(?:el|la|los|las)?\s*(?:gr[aá]fic[oa]|figura|imagen|tabla|cuadro|diagrama|familiograma)\b|\bobserve\s+(?:el|la)\s+curva\b|\brepresenta (?:el|la) gr[aá]fic[oa]\b|\brepresentaci[oó]n gr[aá]fica del familiograma\b)/i;
const missingPriorContextPattern =
  /\b(?:en|del|seg[uú]n) (?:el )?caso anterior\b|\b(?:pregunta|informaci[oó]n|situaci[oó]n|enunciado) anterior\b/i;

function normalizeOptionText(value: string) {
  return value.trim().replace(/\.$/, "").toLowerCase();
}

function repairQuestionText(question: Question) {
  const sourceText = question.question_text.trim();
  const repairedText = questionTextRepairs.get(sourceText);
  const media = questionMediaByText.get(sourceText);

  return repairedText || media
    ? {
        ...question,
        ...media,
        question_text: repairedText ?? question.question_text,
      }
    : question;
}

const psychologyExamQuestionCount = 100;
const absolutistOptionPattern =
  /\b(siempre|nunca|jamás|jamas|todos?|todas|ningún|ningun|ninguna|ninguno|solamente|s[oó]lo|solo|únicamente|unicamente|exclusivamente|completamente|automáticamente|automaticamente|definitivamente|obligatoriamente|por completo)\b/i;

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

  if (
    (missingRequiredVisualPattern.test(questionText) && !question.image_url) ||
    missingPriorContextPattern.test(questionText)
  ) {
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

function isBalancedPsychologyQuestion(question: Question) {
  if (!isUsableQuestion(question)) {
    return false;
  }

  const options = {
    A: question.option_a.trim(),
    B: question.option_b.trim(),
    C: question.option_c.trim(),
    D: question.option_d.trim(),
  };
  const lengths = Object.values(options).map((option) => option.length);
  const shortestLength = Math.max(1, Math.min(...lengths));
  const longestLength = Math.max(...lengths);
  const averageLength =
    lengths.reduce((total, length) => total + length, 0) / lengths.length;
  const correctLength = options[question.correct_option].length;
  const correctLengthRatio = correctLength / averageLength;

  if (longestLength / shortestLength > 2.6) {
    return false;
  }

  if (correctLengthRatio < 0.55 || correctLengthRatio > 1.65) {
    return false;
  }

  return !absolutistOptionPattern.test(options[question.correct_option]);
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
  const usableQuestions = questions
    .map(repairQuestionText)
    .filter(isUsableQuestion);
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
  const qualityPool = questions.filter(isBalancedPsychologyQuestion);
  const questionPool =
    qualityPool.length >= psychologyExamQuestionCount
      ? qualityPool
      : questions.filter(isUsableQuestion);

  if (attemptSeed === legacyFixedPsychologyAttemptSeed) {
    return questionPool.slice(0, psychologyExamQuestionCount);
  }

  // Cada intento toma una muestra nueva y cambia también el orden. El banco
  // completo permanece disponible para que estudiantes simultáneos no reciban
  // necesariamente el mismo examen.
  return shuffleQuestions(
    questionPool,
    getRandomSource(attemptSeed),
  ).slice(0, psychologyExamQuestionCount);
}

export function selectQuestionsForExam(
  examType: string,
  questions: Question[],
  attemptSeed?: string,
  settings?: SimulatorSettings,
) {
  const filteredQuestions =
    settings && (examType === "enfermeria" || examType === "psicologia")
      ? filterQuestionsForSimulatorSettings(
          examType as StudentCareerSlug,
          questions,
          settings,
        )
      : questions;

  if (examType === "enfermeria") {
    return selectNursingExamQuestions(filteredQuestions, attemptSeed);
  }

  if (examType === "psicologia") {
    return selectPsychologyExamQuestions(filteredQuestions, attemptSeed);
  }

  return shuffleQuestions(
    filteredQuestions.filter(isUsableQuestion),
    getRandomSource(attemptSeed),
  ).slice(0, 100);
}

export async function getLocalQuestionsForExam(
  examType: string,
  attemptSeed?: string,
  settings?: SimulatorSettings,
) {
  if (examType === "enfermeria") {
    const { default: enfermeriaQuestions } = await import(
      "@/data/enfermeriaQuestions.json"
    );

    return selectQuestionsForExam(
      examType,
      enfermeriaQuestions as Question[],
      attemptSeed,
      settings,
    );
  }

  if (examType === "psicologia") {
    const { default: psicologiaQuestions } = await import(
      "@/data/psicologiaQuestions.json"
    );

    return selectQuestionsForExam(
      examType,
      psicologiaQuestions as Question[],
      attemptSeed,
      settings,
    );
  }

  return [];
}

export function isLocalQuestionSet(questions: Question[]) {
  return questions.some((question) => question.id.startsWith("local-"));
}
