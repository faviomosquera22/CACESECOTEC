import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { Simulation } from "@/lib/database.types";
import { formatDate, formatDuration, formatScore } from "@/lib/format";

export type SimulationHistoryRecord = Pick<
  Simulation,
  | "id"
  | "finished_at"
  | "created_at"
  | "total_questions"
  | "correct_answers"
  | "incorrect_answers"
  | "score"
  | "time_used_seconds"
>;

type SimulationHistoryTableProps = {
  simulations: SimulationHistoryRecord[];
  emptyMessage?: string;
  resultBasePath?: string;
};

export function SimulationHistoryTable({
  simulations,
  emptyMessage = "No hay simulaciones registradas.",
  resultBasePath,
}: SimulationHistoryTableProps) {
  const columnCount = resultBasePath ? 7 : 6;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-950 text-left text-xs uppercase tracking-normal text-white">
            <tr>
              <th scope="col" className="px-5 py-3 font-semibold">
                Fecha
              </th>
              <th scope="col" className="px-5 py-3 font-semibold">
                Preguntas
              </th>
              <th scope="col" className="px-5 py-3 font-semibold">
                Correctas
              </th>
              <th scope="col" className="px-5 py-3 font-semibold">
                Incorrectas
              </th>
              <th scope="col" className="px-5 py-3 font-semibold">
                Puntaje
              </th>
              <th scope="col" className="px-5 py-3 font-semibold">
                Tiempo
              </th>
              {resultBasePath ? (
                <th scope="col" className="px-5 py-3 font-semibold">
                  Resultado
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {simulations.length === 0 ? (
              <tr>
                <td
                  colSpan={columnCount}
                  className="px-5 py-10 text-center text-slate-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              simulations.map((simulation) => (
                <tr key={simulation.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                    {formatDate(simulation.finished_at ?? simulation.created_at)}
                  </td>
                  <td className="px-5 py-4 text-slate-700">
                    {simulation.total_questions ?? 0}
                  </td>
                  <td className="px-5 py-4 font-medium text-emerald-700">
                    {simulation.correct_answers ?? 0}
                  </td>
                  <td className="px-5 py-4 font-medium text-red-600">
                    {simulation.incorrect_answers ?? 0}
                  </td>
                  <td className="px-5 py-4 font-semibold text-slate-950">
                    {formatScore(simulation.score)}
                  </td>
                  <td className="px-5 py-4 text-slate-700">
                    {formatDuration(simulation.time_used_seconds)}
                  </td>
                  {resultBasePath ? (
                    <td className="px-5 py-4">
                      <Link
                        href={`${resultBasePath}/${simulation.id}`}
                        className="inline-flex items-center gap-2 rounded-lg bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800 transition hover:bg-sky-100"
                      >
                        Ver
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
