import type { Simulation } from "@/lib/database.types";
import type { OptionLetter } from "@/lib/database.types";

export type CloudSimulationRecord = Pick<
  Simulation,
  | "id"
  | "finished_at"
  | "created_at"
  | "total_questions"
  | "correct_answers"
  | "incorrect_answers"
  | "score"
  | "time_used_seconds"
>;

export const CLOUD_SIMULATIONS_METADATA_KEY = "simulationSummaries";
export const CLOUD_SIMULATION_RESULTS_METADATA_KEY = "simulationResults";

export type CloudSimulationAnswerRecord = {
  id: string;
  simulation_id: string;
  question_id: string;
  selected_option: OptionLetter | null;
  is_correct: boolean | null;
  answered_at: string | null;
};

export type CloudSimulationResultRecord = {
  simulation: CloudSimulationRecord;
  answers: CloudSimulationAnswerRecord[];
  comments?: Record<string, string>;
};

export function parseCloudSimulationRecords(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }

  const value = (metadata as Record<string, unknown>)[
    CLOUD_SIMULATIONS_METADATA_KEY
  ];

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is CloudSimulationRecord => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return false;
      }

      const record = item as Partial<CloudSimulationRecord>;

      return typeof record.id === "string";
    })
    .map((record) => ({
      id: record.id,
      finished_at: record.finished_at ?? null,
      created_at: record.created_at ?? null,
      total_questions: record.total_questions ?? null,
      correct_answers: record.correct_answers ?? null,
      incorrect_answers: record.incorrect_answers ?? null,
      score: record.score ?? null,
      time_used_seconds: record.time_used_seconds ?? null,
    }));
}

export function mergeSimulationRecords(records: CloudSimulationRecord[]) {
  const byId = new Map<string, CloudSimulationRecord>();

  records.forEach((record) => {
    byId.set(record.id, record);
  });

  return Array.from(byId.values()).sort((left, right) => {
    const leftTime = new Date(left.finished_at ?? left.created_at ?? 0).getTime();
    const rightTime = new Date(
      right.finished_at ?? right.created_at ?? 0,
    ).getTime();

    return rightTime - leftTime;
  });
}

export function parseCloudSimulationResults(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }

  const value = (metadata as Record<string, unknown>)[
    CLOUD_SIMULATION_RESULTS_METADATA_KEY
  ];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is CloudSimulationResultRecord => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return false;
    }

    const record = item as Partial<CloudSimulationResultRecord>;

    return Boolean(record.simulation?.id && Array.isArray(record.answers));
  });
}
