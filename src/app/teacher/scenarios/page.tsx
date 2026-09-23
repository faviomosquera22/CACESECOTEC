import { TeacherScenarioEditor } from "@/components/TeacherScenarioEditor";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function TeacherScenariosPage() {
  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-semibold text-sky-700">Panel docente</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">
          Escenarios
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
          Crea, edita y organiza casos o preguntas que quieras usar como
          escenarios de práctica.
        </p>
      </section>

      <p className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
        Para agregar preguntas al simulador de tus estudiantes, usa el{" "}
        <Link href="/teacher/questions" className="font-semibold underline">Banco de preguntas</Link>.
        {" "}Los escenarios de esta página se conservan solo en este navegador.
      </p>

      <TeacherScenarioEditor />
    </div>
  );
}
