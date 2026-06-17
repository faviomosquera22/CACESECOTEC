import { TeacherScenarioEditor } from "@/components/TeacherScenarioEditor";

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

      <TeacherScenarioEditor />
    </div>
  );
}
