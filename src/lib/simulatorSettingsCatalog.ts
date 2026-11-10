import type { CustomComponent } from "@/lib/customComponents";
import type { Question } from "@/lib/database.types";
import type { StudentCareerSlug } from "@/lib/studentCareer";

export type SimulatorDifficultyKey = "facil" | "media" | "dificil";
export type SimulatorPhaseKey =
  | "fase-1"
  | "fase-2"
  | "fase-3"
  | "fase-4"
  | "fase-5"
  | "componente-integral"
  | `custom-${string}`;

export type SimulatorSettings = {
  enabledDifficulties: SimulatorDifficultyKey[];
  enabledCategories: string[];
  enabledPhases: SimulatorPhaseKey[];
  updatedAt: string | null;
};

type SimulatorSettingOption<T extends string = string> = {
  key: T;
  label: string;
  description: string;
};

type SimulatorSettingsCatalog = {
  difficulties: SimulatorSettingOption<SimulatorDifficultyKey>[];
  categories: SimulatorSettingOption[];
  phases: SimulatorSettingOption<SimulatorPhaseKey>[];
  supportsDifficulty: boolean;
};

export const simulatorDifficultyOptions: SimulatorSettingOption<SimulatorDifficultyKey>[] =
  [
    {
      key: "facil",
      label: "Fáciles",
      description: "Preguntas de dificultad baja.",
    },
    {
      key: "media",
      label: "Medias",
      description: "Preguntas de dificultad intermedia.",
    },
    {
      key: "dificil",
      label: "Difíciles",
      description: "Preguntas de dificultad alta.",
    },
  ];

const nursingComponentOptions: SimulatorSettingOption<SimulatorPhaseKey>[] =
  [
    {
      key: "fase-1",
      label: "Componente 1: Cuidado y procedimientos clínicos",
      description: "Seguridad del paciente, procedimientos y razonamiento clínico.",
    },
    {
      key: "fase-2",
      label: "Componente 2: Mujer, recién nacido, niño y adolescente",
      description: "Cuidado materno, neonatal, pediátrico y adolescente.",
    },
    {
      key: "fase-3",
      label: "Componente 3: Adulto y adulto mayor",
      description: "Cuidados integrales del adulto y adulto mayor.",
    },
    {
      key: "fase-4",
      label: "Componente 4: Cuidado familiar y comunitario",
      description: "Salud familiar, comunitaria e intercultural.",
    },
    {
      key: "fase-5",
      label: "Componente 5: Bases profesionales y epidemiología",
      description: "Educación, administración, investigación y epidemiología.",
    },
    {
      key: "componente-integral",
      label: "Componente Integral",
      description: "Preguntas de los documentos CACES 18 y CACES 19.",
    },
  ];

export const psychologyComponentWeights = [
  { key: "fase-1", label: "1. Intervenciones clínicas y fundamentos de psicoterapia", percent: 32, topicCount: 13, subcomponents: [
    "1.1 Intervenciones clínicas individuales",
    "1.2 Intervenciones clínicas grupales",
    "1.3 Proceso psicoterapéutico: fases",
    "1.4 Proceso psicoterapéutico: elementos",
  ] },
  { key: "fase-2", label: "2. Evaluación psicológica y psicodiagnóstico", percent: 23, topicCount: 6, subcomponents: [
    "2.1 Psicodiagnóstico: etapas",
    "2.2 Formulación de caso",
  ] },
  { key: "fase-3", label: "3. Fundamentos de psicopatología en la psicología", percent: 20, topicCount: 13, subcomponents: [
    "3.1 Psicopatología general",
    "3.2 Psicofarmacología básica y sus implicaciones psicológicas",
  ] },
  { key: "fase-4", label: "4. Intervenciones psicosociales desde la Psicología", percent: 16, topicCount: 5, subcomponents: [
    "4.1 Promoción y prevención comunitaria en salud mental: fases y alcances",
    "4.2 Problemáticas contemporáneas en el campo psicosocial",
  ] },
  { key: "fase-5", label: "5. Ética, deontología y marco legal", percent: 9, topicCount: 7, subcomponents: [
    "5.1 Fundamentos éticos",
    "5.2 Ética en intervenciones clínicas y en investigación",
  ] },
] as const;

const psychologyComponentOptions: SimulatorSettingOption<SimulatorPhaseKey>[] =
  psychologyComponentWeights.map(({ key, label, subcomponents }) => ({
    key,
    label,
    description: subcomponents.join(" · "),
  }));

const nursingCategoryOptions: SimulatorSettingOption[] = [
  {
    key: "procedimientos-clinicos",
    label: "Cuidado y procedimientos clínicos",
    description: "Razonamiento clínico, procedimientos y seguridad del paciente.",
  },
  {
    key: "mujer-recien-nacido",
    label: "Mujer, recién nacido, niño y adolescente",
    description: "Salud materna, neonatal, pediátrica y adolescente.",
  },
  {
    key: "adulto-mayor",
    label: "Adulto y adulto mayor",
    description: "Cuidados integrales del adulto y del adulto mayor.",
  },
  {
    key: "comunitario",
    label: "Cuidado familiar y comunitario",
    description: "Salud familiar, comunitaria e intercultural.",
  },
  {
    key: "bases-profesionales",
    label: "Bases profesionales y epidemiología",
    description: "Educación, administración, investigación y epidemiología.",
  },
];

const psychologyCategoryOptions: SimulatorSettingOption[] =
  psychologyComponentWeights.flatMap(({ subcomponents }) =>
    Array.from(subcomponents, (label: string) => ({
      key: label.split(" ")[0],
      label,
      description: label,
    })),
  );

const settingsCatalogByCareer: Record<
  StudentCareerSlug,
  SimulatorSettingsCatalog
> = {
  enfermeria: {
    difficulties: simulatorDifficultyOptions,
    categories: nursingCategoryOptions,
    phases: nursingComponentOptions,
    supportsDifficulty: false,
  },
  psicologia: {
    difficulties: simulatorDifficultyOptions,
    categories: psychologyCategoryOptions,
    phases: psychologyComponentOptions,
    supportsDifficulty: true,
  },
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getNursingCategoryKey(question: Question) {
  const category = normalize(question.category ?? "");

  if (category.includes("cuidado y procedimientos clinicos")) {
    return "procedimientos-clinicos";
  }

  if (category.includes("mujer, recien nacido, nino y adolescente")) {
    return "mujer-recien-nacido";
  }

  if (category.includes("adulto y adulto mayor")) {
    return "adulto-mayor";
  }

  if (category.includes("cuidado familiar, comunitario e intercultural")) {
    return "comunitario";
  }

  if (
    category.includes(
      "bases educativas, administrativas, investigativas y epidemiologicas",
    )
  ) {
    return "bases-profesionales";
  }

  return null;
}

export function getPhaseKey(
  career: StudentCareerSlug,
  question: Question,
): SimulatorPhaseKey {
  if (question.phase?.startsWith("custom-")) return question.phase as SimulatorPhaseKey;
  const explicitPhase = settingsCatalogByCareer[career].phases.find(
    option => option.key === question.phase,
  );
  if ((question.id.startsWith("local-manual-") || question.id.startsWith("local-pdf-")) && explicitPhase) return explicitPhase.key;
  if (career === "enfermeria") {
    if (normalize(question.phase ?? "") === "componente-integral") {
      return "componente-integral";
    }

    if (normalize(question.category ?? "") === "enfermeria - componente integral") {
      return "componente-integral";
    }
    const categoryKey = getNursingCategoryKey(question);
    const nursingPhaseByCategory: Record<string, SimulatorPhaseKey> = {
      "procedimientos-clinicos": "fase-1",
      "mujer-recien-nacido": "fase-2",
      "adulto-mayor": "fase-3",
      comunitario: "fase-4",
      "bases-profesionales": "fase-5",
    };

    return nursingPhaseByCategory[categoryKey ?? ""] ?? "fase-1";
  }

  const phase = normalize(question.phase ?? "");
  const matchingPhase = psychologyComponentOptions.find(
    (option) =>
      normalize(option.key) === phase || normalize(option.label) === phase,
  );

  return matchingPhase?.key ?? "fase-1";
}

export function getSimulatorSettingsCatalog(career: StudentCareerSlug, custom: CustomComponent[] = [], removedComponents: string[] = []) {
  const base = settingsCatalogByCareer[career];
  return { ...base, phases: [...base.phases, ...custom].filter(phase => !removedComponents.includes(phase.key)) };
}

export function getDefaultSimulatorSettings(
  career: StudentCareerSlug,
): SimulatorSettings {
  const catalog = getSimulatorSettingsCatalog(career);

  return {
    enabledDifficulties: catalog.difficulties.map((option) => option.key),
    enabledCategories: catalog.categories.map((option) => option.key),
    enabledPhases: catalog.phases.map((option) => option.key),
    updatedAt: null,
  };
}

export function sanitizeSimulatorSettings(
  career: StudentCareerSlug,
  value:
    | {
        enabledDifficulties?: unknown;
        enabledCategories?: unknown;
        enabledPhases?: unknown;
        updatedAt?: unknown;
      }
    | null
    | undefined,
  custom: CustomComponent[] = [],
  removedComponents: string[] = [],
) {
  const defaults = getDefaultSimulatorSettings(career);
  const catalog = getSimulatorSettingsCatalog(career, custom, removedComponents);
  const allowedDifficultyKeys = new Set(
    catalog.difficulties.map((option) => option.key),
  );
  const allowedCategoryKeys = new Set(
    catalog.categories.map((option) => option.key),
  );
  const allowedPhaseKeys = new Set(
    catalog.phases.map((option) => option.key),
  );
  const enabledDifficulties = Array.isArray(value?.enabledDifficulties)
    ? value.enabledDifficulties.filter(
        (item): item is SimulatorDifficultyKey =>
          typeof item === "string" &&
          allowedDifficultyKeys.has(item as SimulatorDifficultyKey),
      )
    : [];
  const enabledCategories = Array.isArray(value?.enabledCategories)
    ? value.enabledCategories.filter(
        (item): item is string =>
          typeof item === "string" && allowedCategoryKeys.has(item),
      )
    : [];
  const enabledPhases = Array.isArray(value?.enabledPhases)
    ? value.enabledPhases.filter(
        (item): item is SimulatorPhaseKey =>
          typeof item === "string" &&
          allowedPhaseKeys.has(item as SimulatorPhaseKey),
      )
    : [];

  return {
    enabledDifficulties:
      enabledDifficulties.length > 0
        ? enabledDifficulties
        : defaults.enabledDifficulties,
    enabledCategories:
      enabledCategories.length > 0
        ? enabledCategories
        : defaults.enabledCategories,
    enabledPhases:
      enabledPhases.length > 0 ? enabledPhases : Array.isArray(value?.enabledPhases) && value.enabledPhases.some(item => removedComponents.includes(item)) ? [] : defaults.enabledPhases.filter(phase => !removedComponents.includes(phase)),
    updatedAt:
      typeof value?.updatedAt === "string" ? value.updatedAt : defaults.updatedAt,
  } satisfies SimulatorSettings;
}

export function filterQuestionsForSimulatorSettings(
  career: StudentCareerSlug,
  questions: Question[],
  settings: SimulatorSettings,
) {
  const selectedPhases = new Set(settings.enabledPhases);

  return questions.filter((question) =>
    !isRetiredQuestion(question) && selectedPhases.has(getPhaseKey(career, question)),
  );
}

// El Integral actual contiene solo CACES 18/19. Los bancos históricos siguen retirados.
export function isRetiredQuestion(question: Partial<Pick<Question, "id" | "phase" | "category" | "component">>) {
  if (/^local-enfermeria-integral-18-19-(18|19)-\d{3}$/.test(question.id ?? "")) return false;
  return normalize(question.phase ?? "") === "componente-integral" ||
    normalize(question.category ?? "") === "enfermeria - componente integral" ||
    normalize(question.component ?? "") === "componente integral";
}
