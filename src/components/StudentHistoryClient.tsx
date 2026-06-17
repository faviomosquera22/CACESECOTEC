"use client";

import { useMemo } from "react";
import {
  SimulationHistoryTable,
  type SimulationHistoryRecord,
} from "@/components/SimulationHistoryTable";
import { StudentAttemptInsights } from "@/components/StudentAttemptInsights";
import { StudentSupabaseSyncClient } from "@/components/StudentSupabaseSyncClient";
import { mergeSimulationRecords } from "@/lib/cloudSimulationStorage";

type StudentHistoryClientProps = {
  studentId: string;
  serverSimulations: SimulationHistoryRecord[];
};

export function StudentHistoryClient({
  studentId,
  serverSimulations,
}: StudentHistoryClientProps) {
  const simulations = useMemo(
    () => mergeSimulationRecords(serverSimulations),
    [serverSimulations],
  );

  return (
    <div className="space-y-6">
      <StudentSupabaseSyncClient studentId={studentId} />
      <StudentAttemptInsights simulations={simulations} />
      <SimulationHistoryTable
        simulations={simulations}
        resultBasePath="/student/results"
        emptyMessage="Aún no tienes simulaciones registradas."
      />
    </div>
  );
}
