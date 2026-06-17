import { notFound } from "next/navigation";
import { Mail, UserRound } from "lucide-react";
import { TeacherStudentHistoryClient } from "@/components/TeacherStudentHistoryClient";
import { requireProfile } from "@/lib/auth";
import { mergeSimulationRecords } from "@/lib/cloudSimulationStorage";
import type {
  Profile,
  Simulation,
  SimulationAnswerWithQuestion,
  SimulationAttempt,
} from "@/lib/database.types";
import { getDemoStudentProfile } from "@/lib/demoStudents";
import {
  simulationAttemptToAnswers,
  simulationAttemptToHistoryRecord,
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
  const { supabase } = await requireProfile(["teacher"]);

  const { data: studentFromSupabase } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, career, created_at")
    .eq("id", studentId)
    .eq("role", "student")
    .maybeSingle()
    .returns<Profile | null>();
  const student = studentFromSupabase ?? getDemoStudentProfile(studentId);

  if (!student) {
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
    .select("*")
    .eq("student_id", student.id)
    .eq("status", "finished")
    .order("created_at", { ascending: false })
    .returns<SimulationAttempt[]>();

  const storedAttempts = attemptData ?? [];
  const simulations = mergeSimulationRecords([
    ...storedAttempts.map(simulationAttemptToHistoryRecord),
    ...(data ?? []),
  ]);
  const legacySimulationIds = (data ?? []).map((simulation) => simulation.id);
  const { data: answerData } =
    legacySimulationIds.length > 0
      ? await supabase
          .from("simulation_answers")
          .select(
            `
            id,
            simulation_id,
            question_id,
            selected_option,
            is_correct,
            answered_at,
            questions (
              id,
              question_text,
              option_a,
              option_b,
              option_c,
              option_d,
              correct_option,
              explanation,
              category,
              difficulty,
              created_at
            )
          `,
          )
          .in("simulation_id", legacySimulationIds)
          .order("answered_at", { ascending: true })
          .returns<SimulationAnswerWithQuestion[]>()
      : { data: [] };
  const storedAttemptAnswers = storedAttempts.flatMap(simulationAttemptToAnswers);

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
        serverAnswers={[...storedAttemptAnswers, ...(answerData ?? [])]}
      />
    </div>
  );
}
