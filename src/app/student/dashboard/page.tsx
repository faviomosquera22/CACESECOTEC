import { GraduationCap, LockKeyhole, ShieldCheck } from "lucide-react";
import { SimulatorOptionCard } from "@/components/SimulatorOptionCard";
import { StudentStatsClient } from "@/components/StudentStatsClient";
import { StudentTeacherFeedback } from "@/components/StudentTeacherFeedback";
import { requireCompletedStudentProfile } from "@/lib/auth";
import { mergeSimulationRecords } from "@/lib/cloudSimulationStorage";
import { simulatorExams } from "@/lib/simulatorCatalog";
import { getStudentCareerOption } from "@/lib/studentCareer";
import { getStudentSimulatorAccess } from "@/lib/studentSimulatorAccess";
import {
  simulationAttemptHistorySelect,
  simulationAttemptToHistoryRecord,
  type SimulationAttemptHistoryRow,
} from "@/lib/supabaseSimulationAttempts";

export const dynamic = "force-dynamic";

export default async function StudentDashboardPage() {
  const { profile, supabase } = await requireCompletedStudentProfile();
  const career = getStudentCareerOption(profile.career);
  const simulatorAccessEnabled = await getStudentSimulatorAccess(
    supabase,
    profile.id,
  );
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
          <div
            className={`inline-flex w-fit items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold ring-1 ${
              simulatorAccessEnabled
                ? "text-sky-800 ring-sky-100"
                : "text-amber-800 ring-amber-200"
            }`}
          >
            {simulatorAccessEnabled ? (
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            ) : (
              <LockKeyhole className="h-4 w-4" aria-hidden="true" />
            )}
            Simulador {simulatorAccessEnabled ? "habilitado" : "bloqueado"}
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h3 className="text-xl font-semibold tracking-normal text-slate-950">
            {simulatorAccessEnabled
              ? "Elige tu simulador"
              : "Acceso al simulador bloqueado"}
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {simulatorAccessEnabled
              ? `Tu docente habilitó el simulador de ${career?.label} para esta sesión.`
              : "Tu docente habilitará el acceso cuando inicie la actividad en clase. Tu perfil y tu historial continúan disponibles."}
          </p>
        </div>
        {simulatorAccessEnabled ? (
          <div className="grid gap-5 lg:grid-cols-2">
            {availableExams.map((exam) => (
              <SimulatorOptionCard key={exam.slug} exam={exam} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-900">
            <div className="flex items-start gap-3">
              <LockKeyhole
                className="mt-0.5 h-5 w-5 shrink-0"
                aria-hidden="true"
              />
              <div>
                <p className="font-semibold">
                  Espera la autorización del docente
                </p>
                <p className="mt-1 text-sm leading-6 text-amber-800">
                  No es necesario crear otra cuenta. Cuando el docente habilite
                  tu acceso, actualiza esta página para comenzar.
                </p>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
