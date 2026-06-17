import { GraduationCap, ShieldCheck } from "lucide-react";
import { SimulatorOptionCard } from "@/components/SimulatorOptionCard";
import { StudentStatsClient } from "@/components/StudentStatsClient";
import { StudentTeacherFeedback } from "@/components/StudentTeacherFeedback";
import { requireCompletedStudentProfile } from "@/lib/auth";
import { mergeSimulationRecords } from "@/lib/cloudSimulationStorage";
import { simulatorExams } from "@/lib/simulatorCatalog";
import { getStudentCareerOption } from "@/lib/studentCareer";
import {
  simulationAttemptHistorySelect,
  simulationAttemptToHistoryRecord,
  type SimulationAttemptHistoryRow,
} from "@/lib/supabaseSimulationAttempts";

export const dynamic = "force-dynamic";

export default async function StudentDashboardPage() {
  const { profile, supabase } = await requireCompletedStudentProfile();
  const career = getStudentCareerOption(profile.career);
  const availableExams = simulatorExams.filter(
    (exam) => exam.slug === career?.simulatorSlug,
  );

  const { data } = await supabase
    .from("simulations")
    .select(
      "id, finished_at, created_at, total_questions, correct_answers, incorrect_answers, score, time_used_seconds",
    )
    .eq("student_id", profile.id)
    .or("status.eq.finished,status.is.null")
    .order("created_at", { ascending: false });

  const { data: attemptData } = await supabase
    .from("simulation_attempts")
    .select(simulationAttemptHistorySelect)
    .eq("student_id", profile.id)
    .eq("status", "finished")
    .order("created_at", { ascending: false })
    .returns<SimulationAttemptHistoryRow[]>();

  const simulations = mergeSimulationRecords([
    ...(attemptData ?? []).map(simulationAttemptToHistoryRecord),
    ...(data ?? []),
  ]);

  return (
    <div className="space-y-8">
      <section>
        <div>
          <p className="text-sm font-semibold text-sky-700">
            Panel estudiante
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">
            Bienvenida, {profile.full_name || profile.email || "estudiante"}
          </h2>
        </div>
      </section>

      <StudentStatsClient
        studentId={profile.id}
        serverSimulations={simulations}
      />

      <StudentTeacherFeedback studentId={profile.id} />

      <section className="rounded-lg border border-sky-100 bg-sky-50 p-5 text-sky-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-sky-700 ring-1 ring-sky-100">
              <GraduationCap className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold">Carrera asignada</p>
              <h3 className="mt-1 text-xl font-semibold tracking-normal">
                {career?.label}
              </h3>
            </div>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-sky-800 ring-1 ring-sky-100">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Simulador CACES {career?.label} habilitado
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h3 className="text-xl font-semibold tracking-normal text-slate-950">
            Elige tu simulador
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Tu cuenta está habilitada para el simulador de {career?.label}.
          </p>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          {availableExams.map((exam) => (
            <SimulatorOptionCard key={exam.slug} exam={exam} />
          ))}
        </div>
      </section>
    </div>
  );
}
