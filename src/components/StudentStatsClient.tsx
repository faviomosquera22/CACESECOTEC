"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { CalendarClock, ClipboardList, TrendingUp, Trophy } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import type { SimulationHistoryRecord } from "@/components/SimulationHistoryTable";
import {
  mergeSimulationRecords,
  parseCloudSimulationRecords,
} from "@/lib/cloudSimulationStorage";
import { average, formatDate, formatScore } from "@/lib/format";
import {
  getLocalSimulationIndexKey,
  subscribeToLocalSimulationChanges,
} from "@/lib/localSimulationStorage";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type StudentStatsClientProps = {
  studentId: string;
  serverSimulations: SimulationHistoryRecord[];
};

function useLocalSimulationRows(studentId: string) {
  const storageKey = getLocalSimulationIndexKey(studentId);
  const rawValue = useSyncExternalStore(
    subscribeToLocalSimulationChanges,
    () => window.localStorage.getItem(storageKey),
    () => null,
  );

  return useMemo(() => {
    if (!rawValue) {
      return [];
    }

    try {
      return JSON.parse(rawValue) as SimulationHistoryRecord[];
    } catch {
      return [];
    }
  }, [rawValue]);
}

export function StudentStatsClient({
  studentId,
  serverSimulations,
}: StudentStatsClientProps) {
  const localSimulations = useLocalSimulationRows(studentId);
  const [cloudSimulations, setCloudSimulations] = useState<
    SimulationHistoryRecord[]
  >([]);

  useEffect(() => {
    let isMounted = true;

    queueMicrotask(async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (isMounted) {
          setCloudSimulations(parseCloudSimulationRecords(user?.user_metadata));
        }
      } catch {
        if (isMounted) {
          setCloudSimulations([]);
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const simulations = useMemo(
    () =>
      mergeSimulationRecords([
        ...localSimulations,
        ...cloudSimulations,
        ...serverSimulations,
      ]),
    [cloudSimulations, localSimulations, serverSimulations],
  );
  const scores = simulations.map((simulation) => simulation.score);
  const latestSimulation = simulations[0] ?? null;
  const averageScore = average(scores);
  const bestScore = Math.max(0, ...scores.map((score) => score ?? 0));

  return (
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
  );
}
