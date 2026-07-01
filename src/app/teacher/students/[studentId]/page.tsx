import { notFound } from "next/navigation";
import { Mail, UserRound } from "lucide-react";
import { TeacherStudentHistoryClient } from "@/components/TeacherStudentHistoryClient";
import {
  isStudentInTeacherCareerScope,
  requireTeacherCareerScope,
} from "@/lib/teacherCareerScope";
import { mergeSimulationRecords } from "@/lib/cloudSimulationStorage";
import type {
  Profile,
  Simulation,
} from "@/lib/database.types";
import { getDemoStudentProfile } from "@/lib/demoStudents";
import {
  simulationAttemptHistorySelect,
  simulationAttemptToHistoryRecord,
  type SimulationAttemptHistoryRow,
} from "@/lib/supabaseSimulationAttempts";

type TeacherStudentPageProps = {
  params: Promise<{
    studentId: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function TeacherStudentPage({
  params,
}: TeacherStudentPageProps) {
  const { studentId } = await params;
  const { supabase, teacherCareerScope } = await requireTeacherCareerScope();

  const { data: studentFromSupabase } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, career, created_at")
    .eq("id", studentId)
    .eq("role", "student")
    .maybeSingle()
    .returns<Profile | null>();
  const student = studentFromSupabase ?? getDemoStudentProfile(studentId);

  if (
    !student ||
    !isStudentInTeacherCareerScope(student.career, teacherCareerScope)
  ) {
    notFound();
  }

  const { data } = await supabase
    .from("simulations")
    .select("*")
    .eq("student_id", student.id)
    .or("status.eq.finished,status.is.null")
    .order("created_at", { ascending: false })
    .returns<Simulation[]>();

  const { data: attemptData } = await supabase
    .from("simulation_attempts")
    .select(simulationAttemptHistorySelect)
    .eq("student_id", student.id)
    .eq("status", "finished")
    .order("created_at", { ascending: false })
    .returns<SimulationAttemptHistoryRow[]>();

  const storedAttempts = attemptData ?? [];
  const simulations = mergeSimulationRecords([
    ...storedAttempts.map(simulationAttemptToHistoryRecord),
    ...(data ?? []),
  ]);

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold text-sky-700">
              Historial del estudiante
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">
              {student.full_name || "Sin nombre"}
            </h2>
            <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-600">
              <span className="inline-flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                <Mail className="h-4 w-4" aria-hidden="true" />
                {student.email || "Sin correo"}
              </span>
              <span className="inline-flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                <UserRound className="h-4 w-4" aria-hidden="true" />
                {student.career || "Sin carrera"}
              </span>
            </div>
          </div>
        </div>
      </section>

      <TeacherStudentHistoryClient
        studentId={student.id}
        serverSimulations={simulations}
        serverAnswers={[]}
      />
    </div>
  );
}
