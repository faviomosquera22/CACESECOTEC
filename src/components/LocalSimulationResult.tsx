"use client";

import { useMemo, useSyncExternalStore } from "react";
import { ResultReviewList } from "@/components/ResultReviewList";
import { ResultScoreCard } from "@/components/ResultScoreCard";
import type {
  Simulation,
  SimulationAnswerWithQuestion,
} from "@/lib/database.types";

type LocalSimulationPayload = {
  simulation: Simulation;
  answers: SimulationAnswerWithQuestion[];
};

type LocalSimulationResultProps = {
  simulationId: string;
};

export function LocalSimulationResult({
  simulationId,
}: LocalSimulationResultProps) {
  const storageKey = `local-simulation:${simulationId}`;
  const rawPayload = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("storage", onStoreChange);
      return () => window.removeEventListener("storage", onStoreChange);
    },
    () => window.localStorage.getItem(storageKey),
    () => null,
  );

  const payload = useMemo(() => {
    if (!rawPayload) {
      return null;
    }

    try {
      return JSON.parse(rawPayload) as LocalSimulationPayload;
    } catch {
      return null;
    }
  }, [rawPayload]);

  if (!payload) {
    return (
      <section className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
        No se encontró el resultado local de esta simulación.
      </section>
    );
  }

  const { simulation, answers } = payload;

  return (
    <div className="space-y-8">
      <ResultScoreCard
        simulation={simulation}
        note="Resultado guardado en el historial local de este navegador mientras Supabase no tenga las tablas de simulaciones cargadas."
      />

      <ResultReviewList answers={answers} />
    </div>
  );
}
