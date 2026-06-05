import { TeacherDashboardClient } from "@/components/TeacherDashboardClient";
import type { StudentCardData } from "@/components/StudentCard";
import { requireProfile } from "@/lib/auth";
import type { Profile, Simulation } from "@/lib/database.types";
import { demoStudentProfiles } from "@/lib/demoStudents";
import { average } from "@/lib/format";

export const dynamic = "force-dynamic";

function getSimulationDate(simulation: Simulation) {
  return simulation.finished_at ?? simulation.created_at;
}

function getBestScore(simulations: Simulation[]) {
  return Math.max(
    0,
    ...simulations.map((simulation) => simulation.score ?? 0),
  );
}

export default async function TeacherDashboardPage() {
  const { supabase } = await requireProfile(["teacher"]);

  const { data: studentProfiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, career, created_at")
    .eq("role", "student")
    .order("full_name", { ascending: true })
    .returns<Profile[]>();

  const students =
    studentProfiles && studentProfiles.length > 0
      ? studentProfiles
      : demoStudentProfiles;
  const studentIds = students.map((student) => student.id);

  const { data: simulationRows } =
    studentIds.length > 0
      ? await supabase
          .from("simulations")
          .select("*")
          .in("student_id", studentIds)
          .order("created_at", { ascending: false })
          .returns<Simulation[]>()
      : { data: [] };

  const simulations = simulationRows ?? [];
  const simulationsByStudent = new Map<string, Simulation[]>();

  simulations.forEach((simulation) => {
    const current = simulationsByStudent.get(simulation.student_id) ?? [];
    current.push(simulation);
    simulationsByStudent.set(simulation.student_id, current);
  });

  const studentCards: StudentCardData[] = students.map((student) => {
    const studentSimulations = simulationsByStudent.get(student.id) ?? [];
    const latestSimulation = studentSimulations[0] ?? null;

    return {
      id: student.id,
      fullName: student.full_name || student.email || "Sin nombre",
      email: student.email || "Sin correo",
      simulationsCount: studentSimulations.length,
      averageScore: average(
        studentSimulations.map((simulation) => simulation.score),
      ),
      bestScore: getBestScore(studentSimulations),
      lastActivity: latestSimulation ? getSimulationDate(latestSimulation) : null,
    };
  });

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-semibold text-sky-700">Panel docente</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">
          Seguimiento de estudiantes
        </h2>
      </section>

      <TeacherDashboardClient students={studentCards} />
    </div>
  );
}
