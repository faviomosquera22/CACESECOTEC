import type { OptionLetter, Question } from "@/lib/database.types";
import { getSimulatorSettingsCatalog, type SimulatorPhaseKey } from "@/lib/simulatorSettingsCatalog";
import type { StudentCareerSlug } from "@/lib/studentCareer";

export type ManualQuestionInput = {
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: OptionLetter;
  explanation: string;
  phase: SimulatorPhaseKey;
  difficulty: "Fácil" | "Media" | "Difícil";
  published: boolean;
};

export type ManualQuestionRow = ManualQuestionInput & {
  id: string;
  teacher_id: string;
  career_slug: StudentCareerSlug;
  created_at: string;
  updated_at: string;
};

export function validateManualQuestion(value: unknown, career: StudentCareerSlug): ManualQuestionInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Completa los datos de la pregunta.");
  const body = value as Record<string, unknown>;
  const fields = { question_text: 12000, option_a: 3000, option_b: 3000, option_c: 3000, option_d: 3000, explanation: 12000 };
  const text: Record<string, string> = {};
  for (const [key, limit] of Object.entries(fields)) {
    const item = body[key];
    if (typeof item !== "string" || !item.trim() || item.trim().length > limit) {
      throw new Error("Completa el enunciado, las cuatro opciones y la explicación, respetando sus límites de texto.");
    }
    text[key] = item.trim();
  }
  const normalized = "abcd".split("").map(key => text[`option_${key}`].normalize("NFKC").toLocaleLowerCase("es").replace(/\s+/g, " ").replace(/[.!?]+$/, ""));
  if (new Set(normalized).size !== 4) throw new Error("Las cuatro opciones deben ser diferentes.");
  if (!["A", "B", "C", "D"].includes(String(body.correct_option))) throw new Error("Selecciona la respuesta correcta.");
  if (!getSimulatorSettingsCatalog(career).phases.some(phase => phase.key === body.phase)) throw new Error("Selecciona un componente de tu carrera.");
  if (!["Fácil", "Media", "Difícil"].includes(String(body.difficulty))) throw new Error("Selecciona una dificultad válida.");
  if (typeof body.published !== "boolean") throw new Error("Selecciona si la pregunta estará publicada o en borrador.");
  return {
    ...text,
    correct_option: body.correct_option,
    phase: body.phase,
    difficulty: body.difficulty,
    published: body.published,
  } as ManualQuestionInput;
}

export function manualQuestionForSimulator(row: ManualQuestionRow): Question {
  const component = getSimulatorSettingsCatalog(row.career_slug).phases.find(phase => phase.key === row.phase)!.label;
  return {
    id: `local-manual-${row.id}`,
    question_text: row.question_text,
    option_a: row.option_a, option_b: row.option_b, option_c: row.option_c, option_d: row.option_d,
    correct_option: row.correct_option, explanation: row.explanation,
    category: `${row.career_slug === "enfermeria" ? "Enfermería" : "Psicología"} - ${component}`,
    difficulty: row.difficulty, phase: row.phase, component, created_at: row.created_at,
  };
}
