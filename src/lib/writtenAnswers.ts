import type { OptionLetter, Question } from "@/lib/database.types";

function normalize(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim().replace(/[.,;:!?]+$/g, "").replace(/\s+/g, " ").trim();
}

export function gradeWrittenAnswer(question: Question, response: string): OptionLetter | undefined {
  const value = normalize(response);
  if (!value) return undefined;
  const expected = { A: question.option_a, B: question.option_b, C: question.option_c, D: question.option_d }[question.correct_option];
  const accepted = [expected];
  // The source's parenthetical drug class is optional; the drug name is required.
  if (question.id === "local-enfermeria-octubre-documento-029") {
    accepted.push("Morfina", "Morfina (opioide)");
  }
  // Keep legacy letter-based scoring compatible; written_answer carries the actual response.
  return accepted.some(answer => normalize(answer) === value)
    ? question.correct_option
    : question.correct_option === "A" ? "B" : "A";
}

export function parseWrittenAnswers(value: unknown, questionIds: Set<string>): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([id, text]) =>
    questionIds.has(id) && typeof text === "string").map(([id, text]) => [id, (text as string).slice(0, 500)]));
}
