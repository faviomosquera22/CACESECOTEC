"use client";

import { useMemo, useSyncExternalStore } from "react";
import { CalendarClock, ClipboardList, TrendingUp, Trophy } from "lucide-react";
import {
  SimulationHistoryTable,
  type SimulationHistoryRecord,
} from "@/components/SimulationHistoryTable";
import { StatCard } from "@/components/StatCard";
import { average, formatDate, formatScore } from "@/lib/format";
import {
  getLocalSimulationIndexKey,
  subscribeToLocalSimulationChanges,
} from "@/lib/localSimulationStorage";

type TeacherStudentHistoryClientProps = {
  studentId: string;
  serverSimulations: SimulationHistoryRecord[];
};

export function TeacherStudentHistoryClient({
  studentId,
  serverSimulations,
}: TeacherStudentHistoryClientProps) {
  const storageKey = getLocalSimulationIndexKey(studentId);
  const rawValue = useSyncExternalStore(
    subscribeToLocalSimulationChanges,
    () => window.localStorage.getItem(storageKey),
    () => null,
  );

  const localSimulations = useMemo(() => {
    if (!rawValue) {
      return [];
    }

    try {
      return JSON.parse(rawValue) as SimulationHistoryRecord[];
    } catch {
      return [];
    }
  }, [rawValue]);

  const simulations = useMemo(
    () =>
      [...localSimulations, ...serverSimulations].sort((left, right) => {
        const leftTime = new Date(
          left.finished_at ?? left.created_at ?? 0,
        ).getTime();
        const rightTime = new Date(
          right.finished_at ?? right.created_at ?? 0,
        ).getTime();

        return rightTime - leftTime;
      }),
    [localSimulations, serverSimulations],
  );
  const scores = simulations.map((simulation) => simulation.score);
  const latestSimulation = simulations[0] ?? null;
  const bestScore = Math.max(
    0,
    ...simulations.map((simulation) => simulation.score ?? 0),
  );

  return (
    <>
      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Simulaciones realizadas"
          value={simulations.length}
          icon={<ClipboardList className="h-5 w-5" aria-hidden="true" />}
          tone="blue"
        />
        <StatCard
          title="Promedio general"
          value={formatScore(average(scores))}
          icon={<TrendingUp className="h-5 w-5" aria-hidden="true" />}
          tone="sky"
        />
        <StatCard
          title="Mejor puntaje"
          value={formatScore(bestScore)}
          icon={<Trophy className="h-5 w-5" aria-hidden="true" />}
          tone="green"
        />
        <StatCard
          title="Última simulación"
          value={formatDate(
            latestSimulation?.finished_at ?? latestSimulation?.created_at,
          )}
          icon={<CalendarClock className="h-5 w-5" aria-hidden="true" />}
          tone="slate"
        />
      </section>

      <section>
        <h3 className="mb-4 text-xl font-semibold tracking-normal text-slate-950">
          Historial completo
        </h3>
        <SimulationHistoryTable
          simulations={simulations}
          emptyMessage="Este estudiante aún no tiene simulaciones registradas."
        />
      </section>
    </>
  );
}
