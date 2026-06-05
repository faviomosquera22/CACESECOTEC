import { SimulatorOptionCard } from "@/components/SimulatorOptionCard";
import { StudentStatsClient } from "@/components/StudentStatsClient";
import { requireCompletedStudentProfile } from "@/lib/auth";
import { simulatorExams } from "@/lib/simulatorCatalog";

export const dynamic = "force-dynamic";

export default async function StudentDashboardPage() {
  const { profile, supabase } = await requireCompletedStudentProfile();

  const { data } = await supabase
    .from("simulations")
    .select(
      "id, finished_at, created_at, total_questions, correct_answers, incorrect_answers, score, time_used_seconds",
    )
    .eq("student_id", profile.id)
    .order("created_at", { ascending: false });

  const simulations = data ?? [];

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

      <section>
        <div className="mb-4">
          <h3 className="text-xl font-semibold tracking-normal text-slate-950">
            Elige tu simulador
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Selecciona el área para practicar con preguntas alineadas al banco
            disponible en Supabase.
          </p>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          {simulatorExams.map((exam) => (
            <SimulatorOptionCard key={exam.slug} exam={exam} />
          ))}
        </div>
      </section>
    </div>
  );
}
