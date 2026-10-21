import repairs from "@/data/questionStatementRepairs.json";
import type { Question } from "@/lib/database.types";

// Match both identity and old wording: generic diagnostic prompts are shared
// by unrelated cases. Teacher revisions and stored grading remain untouched.
export function getCompleteQuestionStatement(
  question: Pick<Question, "id" | "question_text" | "bank_revision">,
) {
  if (question.bank_revision) return question.question_text;
  return repairs.find(
    (repair) => repair.id === question.id && repair.original === question.question_text.trim(),
  )?.text ?? question.question_text;
}
