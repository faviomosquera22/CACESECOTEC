import { SharedQuestionBankEditor } from "@/components/SharedQuestionBankEditor";
import { getSharedBank } from "@/lib/questionBankServer";
import { TeacherQuestionEditor } from "@/components/TeacherQuestionEditor";
import { requireTeacherCareerScope } from "@/lib/teacherCareerScope";
import { getManualQuestions } from "@/lib/manualQuestionsServer";

export const dynamic = "force-dynamic";

export default async function TeacherQuestionsPage() {
  const { supabase, profile, teacherCareerScope } = await requireTeacherCareerScope();
  let questions;
  let shared;
  try { [questions, shared] = await Promise.all([getManualQuestions(supabase, profile.id, teacherCareerScope), getSharedBank(teacherCareerScope)]); }
  catch {
    return <section role="alert" className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">No se pudo cargar tu banco de preguntas. Recarga la página; si persiste, contacta al administrador.</section>;
  }
  return <div className="space-y-6">
    <section>
      <p className="text-sm font-semibold text-sky-700">Panel docente</p>
      <h2 className="mt-2 text-3xl font-semibold text-slate-950">Banco de preguntas</h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">Revisa el banco completo por componentes y guarda correcciones en sus preguntas, respuestas y explicaciones. También puedes agregar preguntas manuales para tus estudiantes.</p>
    </section>
    <SharedQuestionBankEditor initialQuestions={shared} career={teacherCareerScope} />
    <details className="rounded-xl border border-slate-200 p-5"><summary className="mb-5 cursor-pointer text-xl font-semibold">Agregar preguntas y administrar mis preguntas manuales</summary>
    <TeacherQuestionEditor initialQuestions={questions} career={teacherCareerScope} />
    </details>
  </div>;
}
