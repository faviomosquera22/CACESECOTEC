"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  CalendarClock,
  ClipboardList,
  MessageSquareText,
  Save,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { ResultReviewList } from "@/components/ResultReviewList";
import {
  SimulationHistoryTable,
  type SimulationHistoryRecord,
} from "@/components/SimulationHistoryTable";
import { StatCard } from "@/components/StatCard";
import type { SimulationAnswerWithQuestion } from "@/lib/database.types";
import { average, formatDate, formatScore } from "@/lib/format";
import {
  getLocalSimulationIndexKey,
  subscribeToLocalSimulationChanges,
} from "@/lib/localSimulationStorage";

type TeacherStudentHistoryClientProps = {
  studentId: string;
  serverSimulations: SimulationHistoryRecord[];
  serverAnswers: SimulationAnswerWithQuestion[];
};

export function TeacherStudentHistoryClient({
  studentId,
  serverSimulations,
  serverAnswers,
}: TeacherStudentHistoryClientProps) {
  const storageKey = getLocalSimulationIndexKey(studentId);
  const feedbackStorageKey = `teacher-feedback:${studentId}`;
  const [feedback, setFeedback] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [selectedSimulationId, setSelectedSimulationId] = useState(
    serverSimulations[0]?.id ?? "",
  );
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
  const scores = simulations.map((simulation) => simulation.score);
  const latestSimulation = simulations[0] ?? null;
  const bestScore = Math.max(
    0,
    ...simulations.map((simulation) => simulation.score ?? 0),
  );

  useEffect(() => {
    queueMicrotask(() => {
      setFeedback(window.localStorage.getItem(feedbackStorageKey) ?? "");
    });
  }, [feedbackStorageKey]);

  useEffect(() => {
    if (
      selectedSimulationId &&
      simulations.some((simulation) => simulation.id === selectedSimulationId)
    ) {
      return;
    }

    queueMicrotask(() => {
      setSelectedSimulationId(simulations[0]?.id ?? "");
    });
  }, [selectedSimulationId, simulations]);

  const answersBySimulation = useMemo(() => {
    const groupedAnswers = new Map<string, SimulationAnswerWithQuestion[]>();

    serverAnswers.forEach((answer) => {
      const currentAnswers = groupedAnswers.get(answer.simulation_id) ?? [];
      currentAnswers.push(answer);
      groupedAnswers.set(answer.simulation_id, currentAnswers);
    });

    return groupedAnswers;
  }, [serverAnswers]);
  const selectedAnswers = selectedSimulationId
    ? (answersBySimulation.get(selectedSimulationId) ?? [])
    : [];

  function saveFeedback() {
    window.localStorage.setItem(feedbackStorageKey, feedback);
    setFeedbackStatus("Retroalimentación guardada.");
  }

  return (
    <>
      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Simulaciones realizadas"
          value={simulations.length}
          icon={<ClipboardList className="h-5 w-5" aria-hidden="true" />}
          tone="blue"
        />
        <StatCard
          title="Promedio general"
          value={formatScore(average(scores))}
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

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700 ring-1 ring-sky-100">
            <MessageSquareText className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-lg font-semibold tracking-normal text-slate-950">
              Retroalimentación personalizada
            </h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Registra observaciones, recomendaciones o acuerdos para este
              estudiante.
            </p>
          </div>
        </div>
        <textarea
          value={feedback}
          onChange={(event) => {
            setFeedback(event.target.value);
            setFeedbackStatus("");
          }}
          rows={5}
          data-allow-selection="true"
          placeholder="Ejemplo: reforzar el módulo de adulto mayor y repetir un intento cronometrado."
          className="mt-4 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
        />
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-emerald-700">
            {feedbackStatus}
          </p>
          <button
            type="button"
            onClick={saveFeedback}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            Guardar comentario
          </button>
        </div>
      </section>

      <section>
        <h3 className="mb-4 text-xl font-semibold tracking-normal text-slate-950">
          Historial completo
        </h3>
        <SimulationHistoryTable
          simulations={simulations}
          emptyMessage="Este estudiante aún no tiene simulaciones registradas."
        />
      </section>

      {simulations.length > 0 ? (
        <section className="space-y-4">
          <div>
            <h3 className="text-xl font-semibold tracking-normal text-slate-950">
              Preguntas correctas e incorrectas
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Selecciona un intento para revisar las respuestas del estudiante.
            </p>
          </div>

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {simulations.map((simulation) => {
              const isSelected = simulation.id === selectedSimulationId;

              return (
                <button
                  key={simulation.id}
                  type="button"
                  onClick={() => setSelectedSimulationId(simulation.id)}
                  className={`rounded-lg border p-4 text-left transition ${
                    isSelected
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <p className="text-sm font-semibold">
                    {formatDate(simulation.finished_at ?? simulation.created_at)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                    <span
                      className={
                        isSelected ? "text-emerald-200" : "text-emerald-700"
                      }
                    >
                      Correctas: {simulation.correct_answers ?? 0}
                    </span>
                    <span className={isSelected ? "text-red-200" : "text-red-600"}>
                      Incorrectas: {simulation.incorrect_answers ?? 0}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-semibold">
                    Puntaje: {formatScore(simulation.score)}
                  </p>
                </button>
              );
            })}
          </div>

          {selectedAnswers.length > 0 ? (
            <ResultReviewList answers={selectedAnswers} />
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
              No hay respuestas registradas para este intento.
            </div>
          )}
        </section>
      ) : null}
    </>
  );
}
