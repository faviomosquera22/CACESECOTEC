export function formatScore(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "0%";
  }

  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

export function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Sin registro";
  }

  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatDuration(seconds: number | null | undefined) {
  if (!seconds || seconds <= 0) {
    return "0 min";
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours} h ${minutes.toString().padStart(2, "0")} min`;
  }

  if (minutes > 0) {
    return `${minutes} min ${remainingSeconds.toString().padStart(2, "0")} s`;
  }

  return `${remainingSeconds} s`;
}

export function average(values: Array<number | null | undefined>) {
  const validValues = values.filter(
    (value): value is number => value !== null && value !== undefined,
  );

  if (validValues.length === 0) {
    return 0;
  }

  return (
    validValues.reduce((total, value) => total + value, 0) / validValues.length
  );
}
