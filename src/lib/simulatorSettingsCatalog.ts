import type { Question } from "@/lib/database.types";
import type { StudentCareerSlug } from "@/lib/studentCareer";

export type SimulatorDifficultyKey = "facil" | "media" | "dificil";
export type SimulatorPhaseKey =
  | "fase-1"
  | "fase-2"
  | "fase-3"
  | "fase-4"
  | "fase-5";

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
  ];

const psychologyComponentOptions: SimulatorSettingOption<SimulatorPhaseKey>[] =
  [
    {
      key: "fase-1",
      label: "Componente 1: Intervenciones clínicas y psicoterapia",
      description: "Intervenciones individuales, grupales, crisis y proceso terapéutico.",
    },
    {
      key: "fase-2",
      label: "Componente 2: Evaluación psicológica y psicodiagnóstico",
      description: "Pruebas psicológicas, etapas diagnósticas y formulación de casos.",
    },
  ];

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

const psychologyCategoryOptions: SimulatorSettingOption[] = [
  {
    key: "crisis",
    label: "Intervención en crisis y seguridad",
    description: "Crisis, riesgo, primeros auxilios psicológicos y seguridad.",
  },
  {
    key: "grupal",
    label: "Intervenciones clínicas grupales",
    description: "Facilitación, psicoeducación y procesos grupales.",
  },
  {
    key: "asesoramiento",
    label: "Asesoramiento psicológico",
    description: "Acompañamiento, toma de decisiones y orientación.",
  },
  {
    key: "proceso",
    label: "Proceso psicoterapéutico",
    description: "Fases, alianza, seguimiento, progreso y cierre.",
  },
  {
    key: "encuadre",
    label: "Encuadre, demanda, ética y objetivos",
    description: "Consentimiento, confidencialidad, demanda y objetivos.",
  },
  {
    key: "psicoterapia",
    label: "Psicoterapia individual y formulación",
    description: "Formulación clínica, técnicas y casos individuales.",
  },
  {
    key: "pruebas-evaluacion-clinica",
    label: "2.1 Pruebas psicológicas",
    description:
      "Pruebas psicológicas, psicometría e interpretación en la evaluación clínica.",
  },
  {
    key: "psicodiagnostico-etapas",
    label: "2.2 Psicodiagnóstico: etapas",
    description:
      "Entrevista, proceso evaluativo, devolución y consideraciones éticas.",
  },
  {
    key: "formulacion-casos",
    label: "2.3 Formulación de casos",
    description:
      "Hipótesis, integración diagnóstica y análisis funcional del caso.",
  },
];

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

function includesAny(value: string, keywords: string[]) {
  return keywords.some((keyword) => value.includes(keyword));
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

function getPsychologyCategoryKey(question: Question) {
  const subcomponent = normalize(question.subcomponent ?? "");

  if (subcomponent.startsWith("2.1")) {
    return "pruebas-evaluacion-clinica";
  }

  if (subcomponent.startsWith("2.2")) {
    return "psicodiagnostico-etapas";
  }

  if (subcomponent.startsWith("2.3")) {
    return "formulacion-casos";
  }

  const source = normalize(
    `${question.category ?? ""} ${question.question_text ?? ""}`,
  );

  if (
    includesAny(source, [
      "crisis",
      "urgencia",
      "suicid",
      "autolesion",
      "riesgo",
      "plan de seguridad",
      "trauma",
      "violencia",
    ])
  ) {
    return "crisis";
  }

  if (
    includesAny(source, [
      "grupo",
      "grupal",
      "psicoeducativo",
      "participante",
      "facilitador",
    ])
  ) {
    return "grupal";
  }

  if (includesAny(source, ["asesoramiento", "orientacion psicologica"])) {
    return "asesoramiento";
  }

  if (
    includesAny(source, [
      "fase inicial",
      "fase media",
      "fase final",
      "proceso psicoterapeutico",
      "alianza",
      "adherencia",
      "monitoreo",
      "seguimiento",
      "cierre",
      "terminacion",
    ])
  ) {
    return "proceso";
  }

  if (
    includesAny(source, [
      "encuadre",
      "demanda",
      "motivo de consulta",
      "objetivo",
      "consentimiento",
      "confidencialidad",
      "informe",
      "etica",
    ])
  ) {
    return "encuadre";
  }

  return "psicoterapia";
}

function getDifficultyKey(value: string | null) {
  const difficulty = normalize(value ?? "");

  if (includesAny(difficulty, ["baja", "basico", "facil"])) {
    return "facil";
  }

  if (includesAny(difficulty, ["media", "intermedio"])) {
    return "media";
  }

  if (includesAny(difficulty, ["alta", "avanzado", "dificil"])) {
    return "dificil";
  }

  return null;
}

function getPhaseKey(
  career: StudentCareerSlug,
  question: Question,
): SimulatorPhaseKey {
  if (career === "enfermeria") {
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

export function getSimulatorSettingsCatalog(career: StudentCareerSlug) {
  return settingsCatalogByCareer[career];
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
) {
  const defaults = getDefaultSimulatorSettings(career);
  const catalog = getSimulatorSettingsCatalog(career);
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
      enabledPhases.length > 0 ? enabledPhases : defaults.enabledPhases,
    updatedAt:
      typeof value?.updatedAt === "string" ? value.updatedAt : defaults.updatedAt,
  } satisfies SimulatorSettings;
}

export function filterQuestionsForSimulatorSettings(
  career: StudentCareerSlug,
  questions: Question[],
  settings: SimulatorSettings,
) {
  const catalog = getSimulatorSettingsCatalog(career);
  const selectedCategories = new Set(settings.enabledCategories);
  const selectedDifficulties = new Set(settings.enabledDifficulties);
  const selectedPhases = new Set(settings.enabledPhases);
  const allCategoriesSelected =
    selectedCategories.size === catalog.categories.length;
  const allDifficultiesSelected =
    selectedDifficulties.size === catalog.difficulties.length;

  return questions.filter((question) => {
    if (!selectedPhases.has(getPhaseKey(career, question))) {
      return false;
    }

    const categoryKey =
      career === "enfermeria"
        ? getNursingCategoryKey(question)
        : getPsychologyCategoryKey(question);

    if (
      !allCategoriesSelected &&
      (!categoryKey || !selectedCategories.has(categoryKey))
    ) {
      return false;
    }

    if (!catalog.supportsDifficulty || allDifficultiesSelected) {
      return true;
    }

    const difficultyKey = getDifficultyKey(question.difficulty);

    return Boolean(
      difficultyKey && selectedDifficulties.has(difficultyKey),
    );
  });
}
