import type { Question } from "@/lib/database.types";
import { getPhaseKey } from "@/lib/simulatorSettingsCatalog";
import type { StudentCareerSlug } from "@/lib/studentCareer";

export type BankRemoval = {
  career_slug: string;
  kind: "question" | "component";
  target_id: string;
  label: string;
  owner_id: string | null;
  removed: boolean;
  updated_by: string;
  updated_at: string;
};

export function removedComponentIds(rows: BankRemoval[]) {
  return rows.filter(row => row.kind === "component" && row.removed).map(row => row.target_id);
}

export function filterActiveBank<T extends Question>(career: StudentCareerSlug, questions: T[], removals: BankRemoval[]): T[] {
  const components = new Set(removedComponentIds(removals));
  const ids = new Set(removals.filter(row => row.kind === "question" && row.removed).map(row => row.target_id));
  return questions.filter(question => !ids.has(question.id) && !components.has(getPhaseKey(career, question)));
}
