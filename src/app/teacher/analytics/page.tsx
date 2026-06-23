import {
  TeacherLearningTools,
  type TeacherQuestionAnswerRecord,
} from "@/components/TeacherLearningTools";
import { requireTeacherCareerScope } from "@/lib/teacherCareerScope";
import type { SimulationAttempt } from "@/lib/database.types";
import { simulationAttemptToAnswers } from "@/lib/supabaseSimulationAttempts";
import { getTeacherStudentCards } from "@/lib/teacherStudents";

export const dynamic = "force-dynamic";

export default async function TeacherAnalyticsPage() {
  const { supabase, teacherCareerScope } = await requireTeacherCareerScope();
  const studentCards = await getTeacherStudentCards(
    supabase,
    teacherCareerScope,
  );
  const studentIds = studentCards.map((student) => student.id);
  const { data: scopedSimulations } =
    studentIds.length > 0
      ? await supabase
          .from("simulations")
          .select("id")
          .in("student_id", studentIds)
      : { data: [] };
  const simulationIds = (scopedSimulations ?? []).map(
    (simulation) => simulation.id,
  );
  const { data: answerAnalyticsData } =
    simulationIds.length > 0
      ? await supabase
          .from("simulation_answers")
          .select(
            `
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
          .select("id, answers")
          .in("student_id", studentIds)
          .eq("status", "finished")
          .returns<Pick<SimulationAttempt, "id" | "answers">[]>()
      : { data: [] };
  const attemptAnswers = (attemptAnalyticsData ?? []).flatMap(
    simulationAttemptToAnswers,
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
        serverAnswers={[...(answerAnalyticsData ?? []), ...attemptAnswers]}
      />
    </div>
  );
}
