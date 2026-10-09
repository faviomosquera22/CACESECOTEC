import { getBankRemovals } from "@/lib/bankRemovalsServer";
import { removedComponentIds } from "@/lib/bankRemovals";
import { getSharedBank } from "@/lib/questionBankServer";
import { getCustomComponents } from "@/lib/customComponentsServer";
import { TeacherDashboardClient } from "@/components/TeacherDashboardClient";
import { TeacherSimulatorSettings } from "@/components/TeacherSimulatorSettings";
import { getCareerSimulatorSettings } from "@/lib/simulatorSettings";
import { requireTeacherCareerScope } from "@/lib/teacherCareerScope";
import { getTeacherStudentCards } from "@/lib/teacherStudents";

export const dynamic = "force-dynamic";

export default async function TeacherDashboardPage() {
  const { supabase, profile, teacherCareerScope } =
    await requireTeacherCareerScope();
  const [studentCards, simulatorSettings, sharedQuestions, customComponents, removals] = await Promise.all([
    getTeacherStudentCards(supabase, teacherCareerScope, profile.id),
    getCareerSimulatorSettings(supabase, teacherCareerScope, profile.id),
    getSharedBank(teacherCareerScope),
    getCustomComponents(teacherCareerScope),
    getBankRemovals(teacherCareerScope),
  ]);

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
        totalQuestionCount={sharedQuestions.length}
        removedComponents={removedComponentIds(removals)}
        customComponents={customComponents}
      />

      <TeacherDashboardClient
        students={studentCards}
        teacherCareerScope={teacherCareerScope}
      />
    </div>
  );
}
