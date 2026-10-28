import repairs from "@/data/reviewedClinicalQuestionRepairs.json";
import type { Question } from "@/lib/database.types";

type ReviewedRepair = {
  id: string;
  original_text: string;
  difficulty: string;
  patch: Partial<Pick<Question, "question_text" | "option_a" | "option_b" | "option_c" | "option_d" | "correct_option" | "explanation">>;
};

// Match the original wording as well as the identity. The source/difficulty
// fallback covers copies with database UUIDs. Never replace teacher revisions.
export function applyReviewedClinicalRepair(question: Question): Question {
  if (question.bank_revision) return question;
  const repair = (repairs as ReviewedRepair[]).find(row =>
    row.original_text === question.question_text.trim() &&
    (row.id === question.id || row.difficulty === question.difficulty),
  );
  return repair
    ? { ...question, ...repair.patch, option_explanations: undefined }
    : question;
}
