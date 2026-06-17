"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  SimulationHistoryTable,
  type SimulationHistoryRecord,
} from "@/components/SimulationHistoryTable";
import { StudentAttemptInsights } from "@/components/StudentAttemptInsights";
import {
  mergeSimulationRecords,
  parseCloudSimulationRecords,
} from "@/lib/cloudSimulationStorage";
import {
  getLocalSimulationIndexKey,
  subscribeToLocalSimulationChanges,
} from "@/lib/localSimulationStorage";
import { getFreshSupabaseUser } from "@/lib/supabaseAuthMetadata";

type StudentHistoryClientProps = {
  studentId: string;
  serverSimulations: SimulationHistoryRecord[];
};

export function StudentHistoryClient({
  studentId,
  serverSimulations,
}: StudentHistoryClientProps) {
  const storageKey = getLocalSimulationIndexKey(studentId);
  const [cloudSimulations, setCloudSimulations] = useState<
    SimulationHistoryRecord[]
  >([]);
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

  useEffect(() => {
    let isMounted = true;

    queueMicrotask(async () => {
      try {
        const user = await getFreshSupabaseUser();

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

  return (
    <div className="space-y-6">
      <StudentAttemptInsights simulations={simulations} />
      <SimulationHistoryTable
        simulations={simulations}
        resultBasePath="/student/results"
        emptyMessage="Aún no tienes simulaciones registradas."
      />
    </div>
  );
}
