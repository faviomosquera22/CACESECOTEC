import { TeacherDashboardClient } from "@/components/TeacherDashboardClient";
import { requireTeacherCareerScope } from "@/lib/teacherCareerScope";
import { getTeacherStudentCards } from "@/lib/teacherStudents";

export const dynamic = "force-dynamic";

export default async function TeacherDashboardPage() {
  const { supabase, teacherCareerScope } = await requireTeacherCareerScope();
  const studentCards = await getTeacherStudentCards(
    supabase,
    teacherCareerScope,
  );

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

      <TeacherDashboardClient
        students={studentCards}
        teacherCareerScope={teacherCareerScope}
      />
    </div>
  );
}
