"use client";

import { useMemo, useSyncExternalStore } from "react";
import { MessageSquareText } from "lucide-react";
import type { SimulationAnswerWithQuestion } from "@/lib/database.types";

type SimulationStoredCommentsProps = {
  simulationId: string;
  answers: SimulationAnswerWithQuestion[];
};

type StoredCommentPayload = {
  comments?: Record<string, string>;
};

function subscribeToStorage(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);

  return () => window.removeEventListener("storage", onStoreChange);
}

function readStoredComments(simulationId: string) {
  const localResult = window.localStorage.getItem(
    `local-simulation:${simulationId}`,
  );
  const sidecarResult = window.localStorage.getItem(
    `simulation-question-comments:${simulationId}`,
  );

  try {
    if (localResult) {
      const parsedLocal = JSON.parse(localResult) as StoredCommentPayload;
      return parsedLocal.comments ?? {};
    }

    if (sidecarResult) {
      const parsedSidecar = JSON.parse(sidecarResult) as StoredCommentPayload;
      return parsedSidecar.comments ?? {};
    }
  } catch {
    return {};
  }

  return {};
}

export function SimulationStoredComments({
  simulationId,
  answers,
}: SimulationStoredCommentsProps) {
  const rawSnapshot = useSyncExternalStore(
    subscribeToStorage,
    () => JSON.stringify(readStoredComments(simulationId)),
    () => "{}",
  );

  const comments = useMemo(() => {
    try {
      return JSON.parse(rawSnapshot) as Record<string, string>;
    } catch {
      return {};
    }
  }, [rawSnapshot]);
  const visibleComments = answers
    .map((answer, index) => ({
      id: answer.question_id,
      index,
      question: answer.questions?.question_text ?? "Pregunta no disponible",
      comment: comments[answer.question_id]?.trim() ?? "",
    }))
    .filter((item) => item.comment.length > 0);

  if (visibleComments.length === 0) {
    return null;
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700 ring-1 ring-sky-100">
          <MessageSquareText className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-lg font-semibold tracking-normal text-slate-950">
            Comentarios marcados durante la simulación
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Usa estas notas para consultar dudas puntuales o preparar tu
            siguiente repaso.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {visibleComments.map((item) => (
          <article
            key={item.id}
            className="rounded-lg border border-slate-100 bg-slate-50 p-4"
          >
            <p className="text-xs font-semibold uppercase text-slate-500">
              Pregunta {item.index + 1}
            </p>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-950">
              {item.question}
            </p>
            <p className="mt-2 rounded-lg bg-white px-3 py-2 text-sm leading-6 text-slate-700">
              {item.comment}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
