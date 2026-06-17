"use client";

import { useMemo } from "react";
import { CalendarClock, ClipboardList, TrendingUp, Trophy } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import type { SimulationHistoryRecord } from "@/components/SimulationHistoryTable";
import { mergeSimulationRecords } from "@/lib/cloudSimulationStorage";
import { average, formatDate, formatScore } from "@/lib/format";
import { StudentSupabaseSyncClient } from "@/components/StudentSupabaseSyncClient";

type StudentStatsClientProps = {
  studentId: string;
  serverSimulations: SimulationHistoryRecord[];
};

export function StudentStatsClient({
  studentId,
  serverSimulations,
}: StudentStatsClientProps) {
  const simulations = useMemo(
    () => mergeSimulationRecords(serverSimulations),
    [serverSimulations],
  );
  const scores = simulations.map((simulation) => simulation.score);
  const latestSimulation = simulations[0] ?? null;
  const averageScore = average(scores);
  const bestScore = Math.max(0, ...scores.map((score) => score ?? 0));

  return (
    <>
      <StudentSupabaseSyncClient studentId={studentId} />
      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Simulaciones realizadas"
          value={simulations.length}
          icon={<ClipboardList className="h-5 w-5" aria-hidden="true" />}
          tone="blue"
        />
        <StatCard
          title="Promedio general"
          value={formatScore(averageScore)}
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
    </>
  );
}
