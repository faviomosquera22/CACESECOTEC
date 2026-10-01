import type { Question } from "@/lib/database.types";

export type BankQuestion = Question & { revision: string | null };
export type BankOverride = { question_id: string; question: unknown; updated_at: string };
export function applyBankOverrides(questions: Question[], overrides: BankOverride[]): Question[] {
  const byId = new Map(overrides.map(row => [row.question_id, row]));
  return questions.map(question => {
    const row = byId.get(question.id);
    return row ? { ...question, ...(row.question as Question), id: question.id, bank_revision: row.updated_at, option_explanations: undefined } : question;
  });
}

export function validateBankEdit(value: unknown, original: Question): Question {
  if (!value || typeof value !== "object") throw new Error("Completa la pregunta.");
  const input = value as Record<string, unknown>;
  const next = { ...original, option_explanations: undefined };
  for (const field of ["question_text", "option_a", "option_b", "option_c", "option_d", "option_e", "explanation"] as const) {
    const text = input[field] ?? (field === "option_e" ? "" : undefined);
    const limit = field.startsWith("option_") ? 3000 : 12000;
    if (typeof text !== "string" || text.length > limit) throw new Error("Revisa los textos y sus límites.");
    next[field] = text.trim();
  }
  if (!next.question_text || !next.explanation) throw new Error("El enunciado y la explicación son obligatorios.");
  const letters = ["A", "B", "C", "D", "E"] as const;
  const selected = letters.find(letter => letter === input.correct_option);
  if (!selected || !next[`option_${selected.toLowerCase()}` as "option_a"]) throw new Error("Selecciona una respuesta correcta con texto.");
  const options = letters.map(letter => next[`option_${letter.toLowerCase()}` as "option_a"] || "").filter(Boolean);
  const minimum = original.source_format === "answer-only" ? 1 : original.source_format === "partial-options" ? 2 : 4;
  if (options.length < minimum) throw new Error(`Esta pregunta requiere al menos ${minimum} opciones. Conserva las opciones del documento.`);
  const normalized = options.map(text => text.normalize("NFKC").toLocaleLowerCase("es").replace(/\s+/g, " ").replace(/[.!?]+$/, ""));
  if (new Set(normalized).size !== options.length) throw new Error("Las opciones no pueden repetirse.");
  next.correct_option = selected;
  return next;
}
