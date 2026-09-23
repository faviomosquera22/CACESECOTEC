import { TeacherQuestionEditor } from "@/components/TeacherQuestionEditor";
import { requireTeacherCareerScope } from "@/lib/teacherCareerScope";
import { getManualQuestions } from "@/lib/manualQuestionsServer";

export const dynamic = "force-dynamic";

export default async function TeacherQuestionsPage() {
  const { supabase, profile, teacherCareerScope } = await requireTeacherCareerScope();
  let questions;
  try { questions = await getManualQuestions(supabase, profile.id, teacherCareerScope); }
  catch {
    return <section role="alert" className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">No se pudo cargar tu banco de preguntas. Recarga la página; si persiste, contacta al administrador.</section>;
  }
  return <div className="space-y-6">
    <section>
      <p className="text-sm font-semibold text-sky-700">Panel docente</p>
      <h2 className="mt-2 text-3xl font-semibold text-slate-950">Banco de preguntas</h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">Crea preguntas para tus estudiantes. Las publicadas participan en los próximos intentos cuando su componente está habilitado en el Dashboard. En el Componente Integral se incluyen todas.</p>
    </section>
    <TeacherQuestionEditor initialQuestions={questions} career={teacherCareerScope} />
  </div>;
}
