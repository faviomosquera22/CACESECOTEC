export const simulatorDurationOptions = [60, 70, 80, 90, 100, 110, 120, 130, 140, 150] as const;

export function isSimulatorDurationMinutes(value: unknown): value is number {
  return typeof value === "number" && simulatorDurationOptions.some(minutes => minutes === value);
}

export function getDefaultSimulatorDurationMinutes(career: string) {
  return career === "psicologia" ? 140 : 90;
}

export function formatSimulatorDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours} h${remainder ? ` ${remainder} min` : ""}`;
}
