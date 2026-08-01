export type ReportPeriodMode = "day" | "week";

export type ReportPeriod = {
  startAt: number;
  endAt: number;
  label: string;
  filePart: string;
};

const ECUADOR_TIME_ZONE = "America/Guayaquil";
const ECUADOR_OFFSET = "-05:00";
const DATE_VALUE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function getDateParts(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

function addCalendarDays(value: string, days: number) {
  const { year, month, day } = getDateParts(value);
  const nextDate = new Date(Date.UTC(year, month - 1, day + days));

  return [
    nextDate.getUTCFullYear(),
    String(nextDate.getUTCMonth() + 1).padStart(2, "0"),
    String(nextDate.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function formatDateValue(value: string) {
  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

export function getCurrentEcuadorDateValue(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: ECUADOR_TIME_ZONE,
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

export function getReportPeriod(
  mode: ReportPeriodMode,
  selectedDate: string,
): ReportPeriod {
  const safeDate = DATE_VALUE_PATTERN.test(selectedDate)
    ? selectedDate
    : getCurrentEcuadorDateValue();
  let startDate = safeDate;
  let endDate = safeDate;

  if (mode === "week") {
    const { year, month, day } = getDateParts(safeDate);
    const weekDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    const daysSinceMonday = (weekDay + 6) % 7;
    startDate = addCalendarDays(safeDate, -daysSinceMonday);
    endDate = addCalendarDays(startDate, 6);
  }

  const endExclusiveDate = addCalendarDays(endDate, 1);

  return {
    startAt: Date.parse(`${startDate}T00:00:00${ECUADOR_OFFSET}`),
    endAt: Date.parse(`${endExclusiveDate}T00:00:00${ECUADOR_OFFSET}`),
    label:
      mode === "day"
        ? formatDateValue(startDate)
        : `${formatDateValue(startDate)} al ${formatDateValue(endDate)}`,
    filePart:
      mode === "day"
        ? `dia-${startDate}`
        : `semana-${startDate}-a-${endDate}`,
  };
}
