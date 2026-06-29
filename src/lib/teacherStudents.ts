import type { StudentCardData } from "@/components/StudentCard";
import type { SimulationHistoryRecord } from "@/components/SimulationHistoryTable";
import { mergeSimulationRecords } from "@/lib/cloudSimulationStorage";
import type { Profile, Simulation } from "@/lib/database.types";
import { demoStudentProfiles } from "@/lib/demoStudents";
import { average } from "@/lib/format";
import {
  getStudentCareerOption,
  type StudentCareerSlug,
} from "@/lib/studentCareer";
import type { SupabaseServerClient } from "@/lib/supabaseServer";
import {
  simulationAttemptHistorySelect,
  simulationAttemptToHistoryRecord,
  type SimulationAttemptHistoryRow,
} from "@/lib/supabaseSimulationAttempts";

function getSimulationDate(simulation: SimulationHistoryRecord) {
  return simulation.finished_at ?? simulation.created_at;
}

function getBestScore(simulations: SimulationHistoryRecord[]) {
  return Math.max(
    0,
    ...simulations.map((simulation) => simulation.score ?? 0),
  );
}

export async function getTeacherStudentCards(
  supabase: SupabaseServerClient,
  teacherCareerScope: StudentCareerSlug,
) {
  const teacherCareer = getStudentCareerOption(teacherCareerScope);
  const { data: studentProfiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, career, created_at")
    .eq("role", "student")
    .eq("career", teacherCareer?.label ?? teacherCareerScope)
    .order("full_name", { ascending: true })
    .returns<Profile[]>();

  const students =
    studentProfiles && studentProfiles.length > 0
      ? studentProfiles
      : demoStudentProfiles.filter(
          (student) =>
            getStudentCareerOption(student.career)?.slug === teacherCareerScope,
        );
  const studentIds = students.map((student) => student.id);

  const { data: accessRows } =
    studentIds.length > 0
      ? await supabase
          .from("student_simulator_access")
          .select("student_id, enabled")
          .in("student_id", studentIds)
          .returns<{ student_id: string; enabled: boolean }[]>()
      : { data: [] };
  const accessByStudent = new Map(
    (accessRows ?? []).map((access) => [access.student_id, access.enabled]),
  );

  const { data: simulationRows } =
    studentIds.length > 0
      ? await supabase
          .from("simulations")
          .select("*")
          .in("student_id", studentIds)
          .or("status.eq.finished,status.is.null")
          .order("created_at", { ascending: false })
          .returns<Simulation[]>()
      : { data: [] };

  const simulations = simulationRows ?? [];
  const { data: attemptRows } =
    studentIds.length > 0
      ? await supabase
          .from("simulation_attempts")
          .select(`student_id, ${simulationAttemptHistorySelect}`)
          .in("student_id", studentIds)
          .eq("status", "finished")
          .order("created_at", { ascending: false })
          .returns<(SimulationAttemptHistoryRow & { student_id: string })[]>()
      : { data: [] };
  const attemptsByStudent = new Map<
    string,
    (SimulationAttemptHistoryRow & { student_id: string })[]
  >();

  (attemptRows ?? []).forEach((attempt) => {
    const current = attemptsByStudent.get(attempt.student_id) ?? [];
    current.push(attempt);
    attemptsByStudent.set(attempt.student_id, current);
  });
  const simulationsByStudent = new Map<string, SimulationHistoryRecord[]>();

  simulations.forEach((simulation) => {
    const current = simulationsByStudent.get(simulation.student_id) ?? [];
    current.push(simulation);
    simulationsByStudent.set(simulation.student_id, current);
  });

  return students.map((student): StudentCardData => {
    const studentSimulations = mergeSimulationRecords([
      ...(attemptsByStudent.get(student.id) ?? []).map(
        simulationAttemptToHistoryRecord,
      ),
      ...(simulationsByStudent.get(student.id) ?? []),
    ]);
    const latestSimulation = studentSimulations[0] ?? null;
    const career = getStudentCareerOption(student.career);

    return {
      id: student.id,
      fullName: student.full_name || student.email || "Sin nombre",
      email: student.email || "Sin correo",
      careerSlug: career?.slug ?? null,
      careerLabel: career?.label ?? student.career ?? "Sin carrera",
      simulationsCount: studentSimulations.length,
      averageScore: average(
        studentSimulations.map((simulation) => simulation.score),
      ),
      bestScore: getBestScore(studentSimulations),
      lastActivity: latestSimulation ? getSimulationDate(latestSimulation) : null,
      simulatorAccessEnabled: accessByStudent.get(student.id) ?? false,
    };
  });
}
