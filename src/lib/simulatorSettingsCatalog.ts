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

export const simulatorPhaseOptions: SimulatorSettingOption<SimulatorPhaseKey>[] =
  [
    {
      key: "fase-1",
      label: "Fase 1",
      description: "Banco actual de preguntas.",
    },
    {
      key: "fase-2",
      label: "Fase 2",
      description: "Preparada para el próximo banco.",
    },
    {
      key: "fase-3",
      label: "Fase 3",
      description: "Preparada para el próximo banco.",
    },
    {
      key: "fase-4",
      label: "Fase 4",
      description: "Preparada para el próximo banco.",
    },
    {
      key: "fase-5",
      label: "Fase 5",
      description: "Preparada para el próximo banco.",
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
];

const settingsCatalogByCareer: Record<
  StudentCareerSlug,
  SimulatorSettingsCatalog
> = {
  enfermeria: {
    difficulties: simulatorDifficultyOptions,
    categories: nursingCategoryOptions,
    phases: simulatorPhaseOptions,
    supportsDifficulty: false,
  },
  psicologia: {
    difficulties: simulatorDifficultyOptions,
    categories: psychologyCategoryOptions,
    phases: simulatorPhaseOptions,
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

function getPhaseKey(value: string | null | undefined): SimulatorPhaseKey {
  const phase = normalize(value ?? "");
  const matchingPhase = simulatorPhaseOptions.find(
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
    enabledPhases: ["fase-1"],
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
    if (!selectedPhases.has(getPhaseKey(question.phase))) {
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
