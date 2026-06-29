import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SimulatorOptionCard } from "@/components/SimulatorOptionCard";
import { simulatorExams } from "@/lib/simulatorCatalog";
import { getStudentCareerOption } from "@/lib/studentCareer";
import { requireStudentSimulatorAccess } from "@/lib/studentSimulatorAccess";

export const dynamic = "force-dynamic";

export default async function StudentSimulatorPage() {
  const { profile } = await requireStudentSimulatorAccess();
  const career = getStudentCareerOption(profile.career);
  const availableExams = simulatorExams.filter(
    (exam) => exam.slug === career?.simulatorSlug,
  );

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/student/dashboard" },
          { label: "Simulador" },
        ]}
      />

      <div>
        <p className="text-sm font-semibold text-sky-700">Simuladores</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">
          Selecciona el área de práctica
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
          Tu cuenta está habilitada para practicar en el área de{" "}
          {career?.label}.
        </p>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {availableExams.map((exam) => (
          <SimulatorOptionCard key={exam.slug} exam={exam} />
        ))}
      </div>
    </div>
  );
}
