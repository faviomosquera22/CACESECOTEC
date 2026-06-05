import { SimulatorOptionCard } from "@/components/SimulatorOptionCard";
import { requireCompletedStudentProfile } from "@/lib/auth";
import { simulatorExams } from "@/lib/simulatorCatalog";

export const dynamic = "force-dynamic";

export default async function StudentSimulatorPage() {
  await requireCompletedStudentProfile();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-sky-700">Simuladores</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">
          Selecciona el área de práctica
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
          Cada simulador usa preguntas registradas en Supabase y conserva el
          flujo de 50 preguntas con 60 minutos de tiempo.
        </p>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {simulatorExams.map((exam) => (
          <SimulatorOptionCard key={exam.slug} exam={exam} />
        ))}
      </div>
    </div>
  );
}
