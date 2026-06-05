"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  SimulationHistoryTable,
  type SimulationHistoryRecord,
} from "@/components/SimulationHistoryTable";
import {
  getLocalSimulationIndexKey,
  subscribeToLocalSimulationChanges,
} from "@/lib/localSimulationStorage";

type StudentHistoryClientProps = {
  studentId: string;
  serverSimulations: SimulationHistoryRecord[];
};

export function StudentHistoryClient({
  studentId,
  serverSimulations,
}: StudentHistoryClientProps) {
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

  return (
    <SimulationHistoryTable
      simulations={simulations}
      resultBasePath="/student/results"
      emptyMessage="Aún no tienes simulaciones registradas."
    />
  );
}
