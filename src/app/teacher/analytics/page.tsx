import {
  TeacherLearningTools,
  type TeacherQuestionAnswerRecord,
} from "@/components/TeacherLearningTools";
import { requireTeacherCareerScope } from "@/lib/teacherCareerScope";
import type { Simulation, SimulationAttempt } from "@/lib/database.types";
import { simulationAttemptToAnswers } from "@/lib/supabaseSimulationAttempts";
import { getTeacherStudentCards } from "@/lib/teacherStudents";
import type { TeacherAttemptAnalytics } from "@/lib/teacherAnalyticsReport";

export const dynamic = "force-dynamic";

export default async function TeacherAnalyticsPage() {
  const { supabase, teacherCareerScope } = await requireTeacherCareerScope();
  const studentCards = await getTeacherStudentCards(
    supabase,
    teacherCareerScope,
  );
  const studentIds = studentCards.map((student) => student.id);
  const studentCareerById = new Map(
    studentCards.map((student) => [student.id, student.careerSlug]),
  );
  const { data: scopedSimulations } =
    studentIds.length > 0
      ? await supabase
          .from("simulations")
          .select(
            "id, student_id, finished_at, created_at, total_questions, correct_answers, incorrect_answers, score, time_used_seconds",
          )
          .in("student_id", studentIds)
          .returns<
            Pick<
              Simulation,
              | "id"
              | "student_id"
              | "finished_at"
              | "created_at"
              | "total_questions"
              | "correct_answers"
              | "incorrect_answers"
              | "score"
              | "time_used_seconds"
            >[]
          >()
      : { data: [] };
  const simulationById = new Map(
    (scopedSimulations ?? []).map((simulation) => [simulation.id, simulation]),
  );
  const simulationIds = (scopedSimulations ?? []).map(
    (simulation) => simulation.id,
  );
  const { data: answerAnalyticsData } =
    simulationIds.length > 0
      ? await supabase
          .from("simulation_answers")
          .select(
            `
      simulation_id,
      question_id,
      selected_option,
      is_correct,
      questions (
        id,
        question_text,
        category,
        difficulty,
        correct_option
      )
    `,
          )
          .in("simulation_id", simulationIds)
          .returns<TeacherQuestionAnswerRecord[]>()
      : { data: [] };
  const { data: attemptAnalyticsData } =
    studentIds.length > 0
      ? await supabase
          .from("simulation_attempts")
          .select(
            "id, student_id, exam_slug, finished_at, created_at, total_questions, correct_answers, incorrect_answers, score, time_used_seconds, answers",
          )
          .in("student_id", studentIds)
          .eq("status", "finished")
          .returns<
            Pick<
              SimulationAttempt,
              | "id"
              | "student_id"
              | "exam_slug"
              | "finished_at"
              | "created_at"
              | "total_questions"
              | "correct_answers"
              | "incorrect_answers"
              | "score"
              | "time_used_seconds"
              | "answers"
            >[]
          >()
      : { data: [] };
  const legacyAttempts: TeacherAttemptAnalytics[] = (scopedSimulations ?? []).map(
    (simulation) => ({
      id: simulation.id,
      student_id: simulation.student_id,
      exam_slug: studentCareerById.get(simulation.student_id) ?? null,
      finished_at: simulation.finished_at,
      created_at: simulation.created_at,
      total_questions: simulation.total_questions,
      correct_answers: simulation.correct_answers,
      incorrect_answers: simulation.incorrect_answers,
      unanswered_answers: Math.max(
        0,
        (simulation.total_questions ?? 0) -
          (simulation.correct_answers ?? 0) -
          (simulation.incorrect_answers ?? 0),
      ),
      score: simulation.score,
      time_used_seconds: simulation.time_used_seconds,
    }),
  );
  const attemptSummaries: TeacherAttemptAnalytics[] = (
    attemptAnalyticsData ?? []
  ).map((attempt) => ({
    id: attempt.id,
    student_id: attempt.student_id,
    exam_slug: attempt.exam_slug,
    finished_at: attempt.finished_at,
    created_at: attempt.created_at,
    total_questions: attempt.total_questions,
    correct_answers: attempt.correct_answers,
    incorrect_answers: attempt.incorrect_answers,
    unanswered_answers: Math.max(
      0,
      (attempt.total_questions ?? 0) -
        (attempt.correct_answers ?? 0) -
        (attempt.incorrect_answers ?? 0),
    ),
    score: attempt.score,
    time_used_seconds: attempt.time_used_seconds,
  }));
  const legacyAnswers = (answerAnalyticsData ?? []).map((answer) => {
    const simulation = answer.simulation_id
      ? simulationById.get(answer.simulation_id)
      : null;

    return {
      ...answer,
      student_id: simulation?.student_id ?? null,
      exam_slug: simulation?.student_id
        ? studentCareerById.get(simulation.student_id) ?? null
        : null,
      attempt_id: answer.simulation_id ?? null,
    };
  });
  const attemptAnswers = (attemptAnalyticsData ?? []).flatMap((attempt) =>
    simulationAttemptToAnswers(attempt).map((answer) => ({
      ...answer,
      student_id: attempt.student_id,
      exam_slug: attempt.exam_slug,
      attempt_id: attempt.id,
    })),
  );

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-semibold text-sky-700">Panel docente</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">
          Analíticas
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
          Revisa los módulos y preguntas con mayor dificultad, y exporta
          reportes para seguimiento académico.
        </p>
      </section>

      <TeacherLearningTools
        students={studentCards}
        serverAnswers={[...legacyAnswers, ...attemptAnswers]}
        serverAttempts={[...legacyAttempts, ...attemptSummaries]}
      />
    </div>
  );
}
