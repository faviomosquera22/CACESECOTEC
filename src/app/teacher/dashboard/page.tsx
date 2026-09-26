import { TeacherDashboardClient } from "@/components/TeacherDashboardClient";
import { TeacherSimulatorSettings } from "@/components/TeacherSimulatorSettings";
import { getCareerSimulatorSettings } from "@/lib/simulatorSettings";
import { getLocalQuestionBankCount, getLocalQuestionsForExam } from "@/lib/localQuestions";
import { manualQuestionForSimulator } from "@/lib/manualQuestions";
import { getManualQuestions } from "@/lib/manualQuestionsServer";
import { requireTeacherCareerScope } from "@/lib/teacherCareerScope";
import { getTeacherStudentCards } from "@/lib/teacherStudents";

export const dynamic = "force-dynamic";

export default async function TeacherDashboardPage() {
  const { supabase, profile, teacherCareerScope } =
    await requireTeacherCareerScope();
  const [studentCards, simulatorSettings, totalQuestionCount, manualQuestions] = await Promise.all([
    getTeacherStudentCards(supabase, teacherCareerScope, profile.id),
    getCareerSimulatorSettings(supabase, teacherCareerScope, profile.id),
    getLocalQuestionBankCount(teacherCareerScope),
    teacherCareerScope === "enfermeria"
      ? getManualQuestions(supabase, profile.id, teacherCareerScope, true).catch(() => null)
      : null,
  ]);
  const integralQuestionCount = manualQuestions === null ? null : (
    await getLocalQuestionsForExam(
      "enfermeria",
      "integral-question-count",
      { ...simulatorSettings, enabledPhases: ["componente-integral"] },
      manualQuestions.map(manualQuestionForSimulator),
    )
  ).length;

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-semibold text-sky-700">Panel docente</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">
          Seguimiento de estudiantes
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
          Revisa la actividad y el historial de estudiantes de tu carrera
          asignada.
        </p>
      </section>

      <TeacherSimulatorSettings
        career={teacherCareerScope}
        initialSettings={simulatorSettings}
        totalQuestionCount={totalQuestionCount}
        integralQuestionCount={integralQuestionCount}
      />

      <TeacherDashboardClient
        students={studentCards}
        teacherCareerScope={teacherCareerScope}
      />
    </div>
  );
}
