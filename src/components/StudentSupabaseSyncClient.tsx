"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  getLocalSimulationIndexKey,
  type LocalSimulationSummary,
} from "@/lib/localSimulationStorage";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import {
  buildSimulationAttemptInsertFromLocalPayload,
  type LocalSimulationPayload,
} from "@/lib/supabaseSimulationAttempts";

type StudentSupabaseSyncClientProps = {
  studentId: string;
};

export function StudentSupabaseSyncClient({
  studentId,
}: StudentSupabaseSyncClientProps) {
  const router = useRouter();
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (hasStartedRef.current) {
      return;
    }

    hasStartedRef.current = true;

    queueMicrotask(async () => {
      const rawIndex = window.localStorage.getItem(
        getLocalSimulationIndexKey(studentId),
      );

      if (!rawIndex) {
        return;
      }

      let summaries: LocalSimulationSummary[] = [];

      try {
        summaries = JSON.parse(rawIndex) as LocalSimulationSummary[];
      } catch {
        return;
      }

      const supabase = getSupabaseBrowserClient();
      let migratedCount = 0;

      for (const summary of summaries) {
        const rawPayload = window.localStorage.getItem(
          `local-simulation:${summary.id}`,
        );

        if (!rawPayload) {
          continue;
        }

        try {
          const payload = JSON.parse(rawPayload) as LocalSimulationPayload;
          const { error } = await supabase
            .from("simulation_attempts")
            .upsert(buildSimulationAttemptInsertFromLocalPayload(studentId, payload), {
              onConflict: "student_id,client_attempt_id",
              ignoreDuplicates: true,
            });

          if (!error) {
            migratedCount += 1;
          }
        } catch {
          // Keep the local copy. It can be retried after the Supabase table exists.
        }
      }

      if (migratedCount > 0) {
        router.refresh();
      }
    });
  }, [router, studentId]);

  return null;
}
