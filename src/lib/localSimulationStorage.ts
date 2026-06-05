import type { Simulation } from "@/lib/database.types";

const LOCAL_SIMULATIONS_UPDATED_EVENT = "local-simulations-updated";

export type LocalSimulationSummary = Pick<
  Simulation,
  | "id"
  | "student_id"
  | "started_at"
  | "finished_at"
  | "created_at"
  | "total_questions"
  | "correct_answers"
  | "incorrect_answers"
  | "score"
  | "time_used_seconds"
  | "status"
>;

export function getLocalSimulationIndexKey(studentId: string) {
  return `local-simulations:${studentId}`;
}

export function subscribeToLocalSimulationChanges(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(LOCAL_SIMULATIONS_UPDATED_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(LOCAL_SIMULATIONS_UPDATED_EVENT, onStoreChange);
  };
}

export function readLocalSimulationSummaries(studentId: string) {
  const rawValue = window.localStorage.getItem(
    getLocalSimulationIndexKey(studentId),
  );

  if (!rawValue) {
    return [];
  }

  try {
    return JSON.parse(rawValue) as LocalSimulationSummary[];
  } catch {
    return [];
  }
}

export function writeLocalSimulationSummary(
  studentId: string,
  simulation: LocalSimulationSummary,
) {
  const existing = readLocalSimulationSummaries(studentId);
  const next = [
    simulation,
    ...existing.filter((item) => item.id !== simulation.id),
  ].sort((left, right) => {
    const leftTime = new Date(left.finished_at ?? left.created_at ?? 0).getTime();
    const rightTime = new Date(
      right.finished_at ?? right.created_at ?? 0,
    ).getTime();

    return rightTime - leftTime;
  });

  window.localStorage.setItem(
    getLocalSimulationIndexKey(studentId),
    JSON.stringify(next),
  );
  window.dispatchEvent(new Event(LOCAL_SIMULATIONS_UPDATED_EVENT));
}
