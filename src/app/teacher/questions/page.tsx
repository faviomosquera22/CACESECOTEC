import { BankComponentManager } from "@/components/BankComponentManager";
import { getBankRemovals } from "@/lib/bankRemovalsServer";
import { filterActiveBank, removedComponentIds } from "@/lib/bankRemovals";
import { manualQuestionForSimulator } from "@/lib/manualQuestions";
import { TeacherPdfImporter } from "@/components/TeacherPdfImporter";
import { getCustomComponents } from "@/lib/customComponentsServer";
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
  let custom;
  let removals;
  try { [questions, shared, custom, removals] = await Promise.all([getManualQuestions(supabase, profile.id, teacherCareerScope), getSharedBank(teacherCareerScope), getCustomComponents(teacherCareerScope), getBankRemovals(teacherCareerScope)]); }
  catch {
    return <section role="alert" className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">No se pudo cargar tu banco de preguntas. Recarga la página; si persiste, contacta al administrador.</section>;
  }
  removals = removals.filter(row => !row.owner_id || row.owner_id === profile.id);
  const removedComponents = removedComponentIds(removals);
  const activeManualIds = new Set(filterActiveBank(teacherCareerScope, questions.map(manualQuestionForSimulator), removals).map(q => q.id));
  questions = questions.filter(q => activeManualIds.has(`local-manual-${q.id}`));
  const bankVersion = removals.map(row => row.updated_at).join("|");
  return <div className="space-y-6">
    <section>
      <p className="text-sm font-semibold text-sky-700">Panel docente</p>
      <h2 className="mt-2 text-3xl font-semibold text-slate-950">Banco de preguntas</h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">Revisa el banco completo por componentes y guarda correcciones en sus preguntas, respuestas y explicaciones. También puedes agregar preguntas manuales para tus estudiantes.</p>
    </section>
    <BankComponentManager key={`manage:${bankVersion}`} career={teacherCareerScope} custom={custom} removals={removals} />
    <TeacherPdfImporter key={`import:${bankVersion}`} removedComponents={removedComponents} career={teacherCareerScope} initialComponents={custom} />
    <SharedQuestionBankEditor key={`${shared.length}:${bankVersion}`} removals={removals} initialQuestions={shared} career={teacherCareerScope} customComponents={custom} />
    <details className="rounded-xl border border-slate-200 p-5"><summary className="mb-5 cursor-pointer text-xl font-semibold">Agregar preguntas y administrar mis preguntas manuales</summary>
    <TeacherQuestionEditor key={`manual:${bankVersion}`} removals={removals} initialQuestions={questions} career={teacherCareerScope} />
    </details>
  </div>;
}
