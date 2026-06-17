import type { Simulation } from "@/lib/database.types";

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
