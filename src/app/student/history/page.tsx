import Link from "next/link";
import { ArrowLeft, History } from "lucide-react";
import { StudentHistoryClient } from "@/components/StudentHistoryClient";
import { requireCompletedStudentProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function StudentHistoryPage() {
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
    <div className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-sky-700">
            Historial estudiante
          </p>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-950 text-white shadow-sm">
              <History className="h-5 w-5" aria-hidden="true" />
            </div>
            <h2 className="text-3xl font-semibold tracking-normal text-slate-950">
              Simulaciones realizadas
            </h2>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-500">
            Revisa tus intentos anteriores y entra al detalle de cada resultado.
          </p>
        </div>
        <Link
          href="/student/dashboard"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver al dashboard
        </Link>
      </section>

      <StudentHistoryClient
        studentId={profile.id}
        serverSimulations={simulations}
      />
    </div>
  );
}
