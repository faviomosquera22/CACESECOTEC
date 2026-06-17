import {
  TeacherLearningTools,
  type TeacherQuestionAnswerRecord,
} from "@/components/TeacherLearningTools";
import { requireProfile } from "@/lib/auth";
import { getTeacherStudentCards } from "@/lib/teacherStudents";

export const dynamic = "force-dynamic";

export default async function TeacherAnalyticsPage() {
  const { supabase } = await requireProfile(["teacher"]);
  const studentCards = await getTeacherStudentCards(supabase);
  const { data: answerAnalyticsData } = await supabase
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
    .returns<TeacherQuestionAnswerRecord[]>();

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
        serverAnswers={answerAnalyticsData ?? []}
      />
    </div>
  );
}
