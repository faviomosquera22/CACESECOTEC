export type StudentCareerSlug = "enfermeria" | "psicologia";

export type StudentCareerOption = {
  slug: StudentCareerSlug;
  label: string;
  simulatorSlug: StudentCareerSlug;
  aliases: string[];
};

export const studentCareerOptions: StudentCareerOption[] = [
  {
    slug: "enfermeria",
    label: "Enfermería",
    simulatorSlug: "enfermeria",
    aliases: ["enfermeria", "enfermería", "nursing"],
  },
  {
    slug: "psicologia",
    label: "Psicología",
    simulatorSlug: "psicologia",
    aliases: ["psicologia", "psicología", "psychology"],
  },
];

function normalizeCareer(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function getExactStudentCareerOption(career?: string | null) {
  const normalizedCareer = normalizeCareer(career ?? "");

  if (!normalizedCareer) {
    return null;
  }

  return (
    studentCareerOptions.find((option) =>
      [option.slug, option.label, ...option.aliases].some(
        (alias) => normalizeCareer(alias) === normalizedCareer,
      ),
    ) ?? null
  );
}

export function getStudentCareerOption(career?: string | null) {
  const normalizedCareer = normalizeCareer(career ?? "");

  if (!normalizedCareer) {
    return null;
  }

  return (
    getExactStudentCareerOption(career) ??
    studentCareerOptions.find((option) =>
      [option.slug, option.label, ...option.aliases].some((alias) => {
        const normalizedAlias = normalizeCareer(alias);

        return normalizedCareer.includes(normalizedAlias);
      }),
    ) ?? null
  );
}

export function isSupportedStudentCareer(career?: string | null) {
  return Boolean(getStudentCareerOption(career));
}
