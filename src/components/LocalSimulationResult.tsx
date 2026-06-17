"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ResultCategorySummary } from "@/components/ResultCategorySummary";
import { ResultPerformanceSummary } from "@/components/ResultPerformanceSummary";
import { ResultReviewList } from "@/components/ResultReviewList";
import { ResultScoreCard } from "@/components/ResultScoreCard";
import { SimulationStoredComments } from "@/components/SimulationStoredComments";
import { parseCloudSimulationResults } from "@/lib/cloudSimulationStorage";
import type {
  Question,
  Simulation,
  SimulationAnswerWithQuestion,
} from "@/lib/database.types";
import { getLocalQuestionsForExam } from "@/lib/localQuestions";
import { getFreshSupabaseUser } from "@/lib/supabaseAuthMetadata";

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
  const [cloudPayload, setCloudPayload] = useState<LocalSimulationPayload | null>(
    null,
  );
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
      return cloudPayload;
    }

    try {
      return JSON.parse(rawPayload) as LocalSimulationPayload;
    } catch {
      return cloudPayload;
    }
  }, [cloudPayload, rawPayload]);

  useEffect(() => {
    let isMounted = true;

    queueMicrotask(async () => {
      try {
        const user = await getFreshSupabaseUser();
        const result = parseCloudSimulationResults(user?.user_metadata).find(
          (item) => item.simulation.id === simulationId,
        );

        if (!result) {
          return;
        }

        const questionMap = new Map<string, Question>();

        getLocalQuestionsForExam("enfermeria").forEach((question) => {
          questionMap.set(question.id, question);
        });
        getLocalQuestionsForExam("psicologia").forEach((question) => {
          questionMap.set(question.id, question);
        });

        const nextPayload: LocalSimulationPayload = {
          simulation: result.simulation as Simulation,
          answers: result.answers.map((answer) => ({
            ...answer,
            questions: questionMap.get(answer.question_id) ?? null,
          })),
        };

        if (isMounted) {
          setCloudPayload(nextPayload);
        }
      } catch {
        if (isMounted) {
          setCloudPayload(null);
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [simulationId]);

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
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/student/dashboard" },
          { label: "Resultado" },
        ]}
      />

      <ResultScoreCard
        simulation={simulation}
        note="Resultado sincronizado con tu cuenta para consultar el historial desde tus dispositivos."
      />

      <ResultPerformanceSummary answers={answers} />

      <SimulationStoredComments simulationId={simulation.id} answers={answers} />

      <ResultCategorySummary answers={answers} />

      <ResultReviewList answers={answers} />
    </div>
  );
}
