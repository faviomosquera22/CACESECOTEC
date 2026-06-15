import { TeacherDashboardClient } from "@/components/TeacherDashboardClient";
import { requireProfile } from "@/lib/auth";
import { getTeacherStudentCards } from "@/lib/teacherStudents";

export const dynamic = "force-dynamic";

export default async function TeacherStudentsPage() {
  const { supabase } = await requireProfile(["teacher"]);
  const studentCards = await getTeacherStudentCards(supabase);

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-semibold text-sky-700">Panel docente</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">
          Estudiantes
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
          Gestiona estudiantes, carreras asignadas, accesos e historial desde
          un listado enfocado.
        </p>
      </section>

      <TeacherDashboardClient
        students={studentCards}
        showSummaryCards={false}
      />
    </div>
  );
}
