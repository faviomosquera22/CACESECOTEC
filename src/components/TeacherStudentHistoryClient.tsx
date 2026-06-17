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
import {
  SimulationHistoryTable,
  type SimulationHistoryRecord,
} from "@/components/SimulationHistoryTable";
import { StatCard } from "@/components/StatCard";
import { average, formatDate, formatScore } from "@/lib/format";
import {
  getLocalSimulationIndexKey,
  subscribeToLocalSimulationChanges,
} from "@/lib/localSimulationStorage";

type TeacherStudentHistoryClientProps = {
  studentId: string;
  serverSimulations: SimulationHistoryRecord[];
};

export function TeacherStudentHistoryClient({
  studentId,
  serverSimulations,
}: TeacherStudentHistoryClientProps) {
  const storageKey = getLocalSimulationIndexKey(studentId);
  const feedbackStorageKey = `teacher-feedback:${studentId}`;
  const [feedback, setFeedback] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");
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
    </>
  );
}
