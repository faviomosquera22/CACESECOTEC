import type { SimulationHistoryRecord } from "@/components/SimulationHistoryTable";
import type {
  Inserts,
  Json,
  OptionLetter,
  Question,
  Simulation,
  SimulationAnswerWithQuestion,
  SimulationAttempt,
} from "@/lib/database.types";

type AttemptAnswerSnapshot = {
  question_id: string;
  selected_option: OptionLetter | null;
  is_correct: boolean | null;
  answered_at: string | null;
  question: Question | null;
};

export type LocalSimulationPayload = {
  simulation: Simulation;
  answers: SimulationAnswerWithQuestion[];
  comments?: Record<string, string>;
};

export type SimulationAttemptHistoryRow = Pick<
  SimulationAttempt,
  | "id"
  | "finished_at"
  | "created_at"
  | "total_questions"
  | "correct_answers"
  | "incorrect_answers"
  | "score"
  | "time_used_seconds"
>;

export const simulationAttemptHistorySelect =
  "id, finished_at, created_at, total_questions, correct_answers, incorrect_answers, score, time_used_seconds";

function isOptionLetter(value: unknown): value is OptionLetter {
  return ["A", "B", "C", "D"].includes(String(value));
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeOptionExplanations(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const entries = Object.entries(value).filter(
    ([option, explanation]) => isOptionLetter(option) && typeof explanation === "string",
  );

  return entries.length > 0
    ? (Object.fromEntries(entries) as Partial<Record<OptionLetter, string>>)
    : undefined;
}

function normalizeQuestion(value: unknown): Question | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const question = value as Partial<Question>;

  if (!question.id || !question.question_text) {
    return null;
  }

  return {
    id: question.id,
    question_text: question.question_text,
    option_a: asString(question.option_a),
    option_b: asString(question.option_b),
    option_c: asString(question.option_c),
    option_d: asString(question.option_d),
    correct_option: isOptionLetter(question.correct_option)
      ? question.correct_option
      : "A",
    explanation: question.explanation ?? null,
    option_explanations: normalizeOptionExplanations(
      question.option_explanations,
    ),
    category: question.category ?? null,
    difficulty: question.difficulty ?? null,
    created_at: question.created_at ?? null,
  };
}

function parseAnswerSnapshots(value: Json): AttemptAnswerSnapshot[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }

      const snapshot = item as Record<string, unknown>;
      const selectedOption = snapshot.selected_option;

      return {
        question_id: asString(snapshot.question_id),
        selected_option: isOptionLetter(selectedOption) ? selectedOption : null,
        is_correct:
          typeof snapshot.is_correct === "boolean"
            ? snapshot.is_correct
            : null,
        answered_at:
          typeof snapshot.answered_at === "string"
            ? snapshot.answered_at
            : null,
        question: normalizeQuestion(snapshot.question),
      };
    })
    .filter((item): item is AttemptAnswerSnapshot => Boolean(item?.question_id));
}

export function simulationAttemptToHistoryRecord(
  attempt: SimulationAttemptHistoryRow,
): SimulationHistoryRecord {
  return {
    id: attempt.id,
    finished_at: attempt.finished_at,
    created_at: attempt.created_at,
    total_questions: attempt.total_questions,
    correct_answers: attempt.correct_answers,
    incorrect_answers: attempt.incorrect_answers,
    score: attempt.score,
    time_used_seconds: attempt.time_used_seconds,
  };
}

export function simulationAttemptToSimulation(
  attempt: SimulationAttempt,
): Simulation {
  return {
    id: attempt.id,
    student_id: attempt.student_id,
    started_at: attempt.started_at,
    finished_at: attempt.finished_at,
    total_questions: attempt.total_questions,
    correct_answers: attempt.correct_answers,
    incorrect_answers: attempt.incorrect_answers,
    score: attempt.score,
    time_used_seconds: attempt.time_used_seconds,
    status: attempt.status,
    created_at: attempt.created_at,
  };
}

export function simulationAttemptToAnswers(
  attempt: Pick<SimulationAttempt, "id" | "answers">,
): SimulationAnswerWithQuestion[] {
  return parseAnswerSnapshots(attempt.answers).map((answer, index) => ({
    id: `${attempt.id}-${index + 1}`,
    simulation_id: attempt.id,
    question_id: answer.question_id,
    selected_option: answer.selected_option,
    is_correct: answer.is_correct,
    answered_at: answer.answered_at,
    questions: answer.question,
  }));
}

export function buildSimulationAttemptInsert({
  studentId,
  examSlug,
  simulationId,
  startedAt,
  finishedAt,
  totalQuestions,
  correctAnswers,
  incorrectAnswers,
  score,
  timeUsedSeconds,
  questions,
  selectedAnswers,
  comments = {},
  clientAttemptId,
}: {
  studentId: string;
  examSlug: string;
  simulationId?: string;
  startedAt: string;
  finishedAt: string;
  totalQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  score: number;
  timeUsedSeconds: number;
  questions: Question[];
  selectedAnswers: Partial<Record<string, OptionLetter>>;
  comments?: Record<string, string>;
  clientAttemptId?: string | null;
}): Inserts<"simulation_attempts"> {
  return {
    id: simulationId,
    student_id: studentId,
    exam_slug: examSlug,
    client_attempt_id: clientAttemptId ?? null,
    started_at: startedAt,
    finished_at: finishedAt,
    total_questions: totalQuestions,
    correct_answers: correctAnswers,
    incorrect_answers: incorrectAnswers,
    score,
    time_used_seconds: timeUsedSeconds,
    answers: questions.map((question) => {
      const selectedOption = selectedAnswers[question.id] ?? null;

      return {
        question_id: question.id,
        selected_option: selectedOption,
        is_correct: selectedOption === question.correct_option,
        answered_at: finishedAt,
        question,
      };
    }) as Json,
    comments: comments as Json,
    status: "finished",
  };
}

export function buildSimulationAttemptInsertFromLocalPayload(
  studentId: string,
  payload: LocalSimulationPayload,
): Inserts<"simulation_attempts"> {
  const selectedAnswers = Object.fromEntries(
    payload.answers.map((answer) => [
      answer.question_id,
      answer.selected_option ?? undefined,
    ]),
  ) as Partial<Record<string, OptionLetter>>;
  const questions = payload.answers
    .map((answer) => answer.questions)
    .filter((question): question is Question => Boolean(question));
  const hasPsychologyQuestion = questions.some((question) =>
    (question.category ?? "").toLowerCase().includes("psicolog"),
  );
  const simulation = payload.simulation;
  const fallbackDate = new Date().toISOString();

  return buildSimulationAttemptInsert({
    studentId,
    examSlug: hasPsychologyQuestion ? "psicologia" : "enfermeria",
    startedAt: simulation.started_at ?? simulation.created_at ?? fallbackDate,
    finishedAt: simulation.finished_at ?? simulation.created_at ?? fallbackDate,
    totalQuestions: simulation.total_questions ?? questions.length,
    correctAnswers:
      simulation.correct_answers ??
      payload.answers.filter((answer) => answer.is_correct === true).length,
    incorrectAnswers:
      simulation.incorrect_answers ??
      payload.answers.filter((answer) => answer.is_correct !== true).length,
    score: simulation.score ?? 0,
    timeUsedSeconds: simulation.time_used_seconds ?? 0,
    questions,
    selectedAnswers,
    comments: payload.comments ?? {},
    clientAttemptId: simulation.id,
  });
}
