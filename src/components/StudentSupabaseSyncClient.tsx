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

function getMigratedAttemptsKey(studentId: string) {
  return `supabase-migrated-simulations:${studentId}`;
}

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
      const migratedAttemptsKey = getMigratedAttemptsKey(studentId);
      let migratedIds = new Set<string>();

      try {
        const parsedMigratedIds = JSON.parse(
          window.localStorage.getItem(migratedAttemptsKey) ?? "[]",
        );

        if (Array.isArray(parsedMigratedIds)) {
          migratedIds = new Set(
            parsedMigratedIds.filter(
              (item): item is string => typeof item === "string",
            ),
          );
        }
      } catch {
        migratedIds = new Set<string>();
      }
      let migratedCount = 0;

      for (const summary of summaries
        .filter((item) => !migratedIds.has(item.id))
        .slice(0, 5)) {
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
            .upsert(
              buildSimulationAttemptInsertFromLocalPayload(studentId, payload),
              {
                onConflict: "student_id,client_attempt_id",
                ignoreDuplicates: true,
              },
            );

          if (!error) {
            migratedIds.add(summary.id);
            migratedCount += 1;
          }
        } catch {
          // Keep the local copy. It can be retried after the Supabase table exists.
        }
      }

      if (migratedCount > 0) {
        window.localStorage.setItem(
          migratedAttemptsKey,
          JSON.stringify(Array.from(migratedIds)),
        );
        router.refresh();
      }
    });
  }, [router, studentId]);

  return null;
}
