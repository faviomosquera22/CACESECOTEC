import Link from "next/link";
import { ArrowRight, ListChecks } from "lucide-react";
import type { SimulatorExamConfig } from "@/lib/simulatorCatalog";

type SimulatorOptionCardProps = {
  exam: SimulatorExamConfig;
};

export function SimulatorOptionCard({ exam }: SimulatorOptionCardProps) {
  const Icon = exam.icon;

  return (
    <article className="flex h-full flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700 ring-1 ring-sky-100">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-xl font-semibold tracking-normal text-slate-950">
            {exam.title}
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {exam.description}
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-lg bg-slate-50 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-950">
          <ListChecks className="h-4 w-4 text-emerald-700" aria-hidden="true" />
          Constitución del simulador
        </p>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
          {exam.structure.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <Link
        href={`/student/simulator/${exam.slug}`}
        className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700"
      >
        Iniciar {exam.shortTitle}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </article>
  );
}
