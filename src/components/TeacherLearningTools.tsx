"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import {
  BarChart3,
  CalendarDays,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  UserRound,
} from "lucide-react";
import type { StudentCardData } from "@/components/StudentCard";
import { formatScore } from "@/lib/format";
import {
  getLocalSimulationIndexKey,
  subscribeToLocalSimulationChanges,
} from "@/lib/localSimulationStorage";
import {
  getCurrentEcuadorDateValue,
  getReportPeriod,
  type ReportPeriodMode,
} from "@/lib/reportPeriod";
import {
  buildStudentAnalyticsReportPdf,
  buildTeacherAnalyticsReportPdf,
  buildTeacherModulesFromAnswers,
  buildTeacherQuestionsFromAnswers,
  getTeacherAnalyticsReportFilename,
  getTeacherStudentReportFilename,
  type TeacherAttemptAnalytics,
  type TeacherReportAnswer,
} from "@/lib/teacherAnalyticsReport";

export type TeacherQuestionAnswerRecord = TeacherReportAnswer;

type TeacherLearningToolsProps = {
  students: StudentCardData[];
  serverAnswers: TeacherQuestionAnswerRecord[];
  serverAttempts: TeacherAttemptAnalytics[];
};

type LocalSimulationPayload = {
  simulation?: {
    id?: string;
    student_id?: string | null;
    started_at?: string | null;
    finished_at?: string | null;
    created_at?: string | null;
    total_questions?: number | null;
    correct_answers?: number | null;
    incorrect_answers?: number | null;
    score?: number | null;
    time_used_seconds?: number | null;
  };
  answers?: TeacherQuestionAnswerRecord[];
};

function readJsonArray<T>(value: string | null): T[] {
  if (!value) {
    return [];
  }

  try {
    return JSON.parse(value) as T[];
  } catch {
    return [];
  }
}

function inferExamSlug(
  student: StudentCardData,
  answers: TeacherQuestionAnswerRecord[],
) {
  if (student.careerSlug) {
    return student.careerSlug;
  }

  return answers.some((answer) =>
    (answer.questions?.category ?? "").toLowerCase().includes("psicolog"),
  )
    ? "psicologia"
    : "enfermeria";
}

function getAnswerTotals(answers: TeacherQuestionAnswerRecord[]) {
  return answers.reduce(
    (totals, answer) => {
      totals.total += 1;

      if (answer.is_correct === true) {
        totals.correct += 1;
      } else if (answer.selected_option === null) {
        totals.unanswered += 1;
      } else {
        totals.incorrect += 1;
      }

      return totals;
    },
    { total: 0, correct: 0, incorrect: 0, unanswered: 0 },
  );
}

function readLocalReportData(students: StudentCardData[]): {
  answers: TeacherQuestionAnswerRecord[];
  attempts: TeacherAttemptAnalytics[];
} {
  if (typeof window === "undefined") {
    return { answers: [], attempts: [] };
  }

  return students.reduce<{
    answers: TeacherQuestionAnswerRecord[];
    attempts: TeacherAttemptAnalytics[];
  }>(
    (reportData, student) => {
      const summaries = readJsonArray<{ id: string }>(
        window.localStorage.getItem(getLocalSimulationIndexKey(student.id)),
      );

      summaries.forEach((summary) => {
        const rawPayload = window.localStorage.getItem(
          `local-simulation:${summary.id}`,
        );

        if (!rawPayload) {
          return;
        }

        try {
          const payload = JSON.parse(rawPayload) as LocalSimulationPayload;
          const rawAnswers = payload.answers ?? [];
          const examSlug = inferExamSlug(student, rawAnswers);
          const simulationId = payload.simulation?.id ?? summary.id;
          const answers = rawAnswers.map((answer) => ({
            ...answer,
            student_id: student.id,
            exam_slug: examSlug,
            attempt_id: answer.attempt_id ?? simulationId,
            simulation_id: answer.simulation_id ?? simulationId,
          }));
          const totals = getAnswerTotals(answers);
          const totalQuestions =
            payload.simulation?.total_questions ?? totals.total;
          const correctAnswers =
            payload.simulation?.correct_answers ?? totals.correct;
          const incorrectAnswers =
            payload.simulation?.incorrect_answers ?? totals.incorrect;
          const unansweredAnswers = Math.max(
            0,
            totalQuestions - correctAnswers - incorrectAnswers,
          );

          reportData.answers.push(...answers);
          reportData.attempts.push({
            id: simulationId,
            student_id: student.id,
            exam_slug: examSlug,
            finished_at: payload.simulation?.finished_at ?? null,
            created_at: payload.simulation?.created_at ?? null,
            total_questions: totalQuestions,
            correct_answers: correctAnswers,
            incorrect_answers: incorrectAnswers,
            unanswered_answers: unansweredAnswers,
            score:
              payload.simulation?.score ??
              (totalQuestions > 0
                ? Math.round((correctAnswers / totalQuestions) * 10000) / 100
                : 0),
            time_used_seconds: payload.simulation?.time_used_seconds ?? null,
          });
        } catch {
          return;
        }
      });

      return reportData;
    },
    { answers: [], attempts: [] },
  );
}

function csvValue(value: string | number | null | undefined) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadBlob(filename: string, content: BlobPart, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function getAttemptDate(attempt: TeacherAttemptAnalytics) {
  return attempt.finished_at ?? attempt.created_at;
}

function getAttemptScore(attempt: TeacherAttemptAnalytics) {
  if (typeof attempt.score === "number") {
    return attempt.score;
  }

  const totalQuestions = attempt.total_questions ?? 0;
  const correctAnswers = attempt.correct_answers ?? 0;

  return totalQuestions > 0
    ? Math.round((correctAnswers / totalQuestions) * 10000) / 100
    : 0;
}

function buildPeriodStudent(
  student: StudentCardData,
  attempts: TeacherAttemptAnalytics[],
): StudentCardData {
  const scores = attempts.map(getAttemptScore);
  const lastActivity = attempts
    .map(getAttemptDate)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null;

  return {
    ...student,
    simulationsCount: attempts.length,
    averageScore:
      scores.length > 0
        ? scores.reduce((total, score) => total + score, 0) / scores.length
        : 0,
    bestScore: scores.length > 0 ? Math.max(...scores) : 0,
    lastActivity,
  };
}

export function TeacherLearningTools({
  students,
  serverAnswers,
  serverAttempts,
}: TeacherLearningToolsProps) {
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [exportingStudentId, setExportingStudentId] = useState("");
  const [pdfError, setPdfError] = useState("");
  const [periodMode, setPeriodMode] = useState<ReportPeriodMode>("week");
  const [selectedDate, setSelectedDate] = useState(() =>
    getCurrentEcuadorDateValue(),
  );
  const localStorageSnapshot = useSyncExternalStore(
    subscribeToLocalSimulationChanges,
    () =>
      JSON.stringify(
        students.map((student) =>
          window.localStorage.getItem(getLocalSimulationIndexKey(student.id)),
        ),
      ),
    () => "[]",
  );

  const localReportData = useMemo(() => {
    void localStorageSnapshot;
    return readLocalReportData(students);
  }, [localStorageSnapshot, students]);

  const allAnswers = useMemo(
    () => [...serverAnswers, ...localReportData.answers],
    [localReportData.answers, serverAnswers],
  );

  const allAttempts = useMemo(
    () => [...serverAttempts, ...localReportData.attempts],
    [localReportData.attempts, serverAttempts],
  );

  const reportPeriod = useMemo(
    () => getReportPeriod(periodMode, selectedDate),
    [periodMode, selectedDate],
  );

  const periodAttempts = useMemo(
    () =>
      allAttempts
        .filter((attempt) => {
          const value = getAttemptDate(attempt);
          const timestamp = value ? Date.parse(value) : Number.NaN;

          return (
            Number.isFinite(timestamp) &&
            timestamp >= reportPeriod.startAt &&
            timestamp < reportPeriod.endAt
          );
        })
        .map((attempt) => ({
          ...attempt,
          score: getAttemptScore(attempt),
        })),
    [allAttempts, reportPeriod.endAt, reportPeriod.startAt],
  );

  const periodAnswers = useMemo(() => {
    const attemptIds = new Set(periodAttempts.map((attempt) => attempt.id));

    return allAnswers.filter((answer) => {
      const attemptId = answer.attempt_id ?? answer.simulation_id;
      return Boolean(attemptId && attemptIds.has(attemptId));
    });
  }, [allAnswers, periodAttempts]);

  const periodStudents = useMemo(
    () =>
      students.map((student) =>
        buildPeriodStudent(
          student,
          periodAttempts.filter(
            (attempt) => attempt.student_id === student.id,
          ),
        ),
      ),
    [periodAttempts, students],
  );

  const moduleAnalytics = useMemo(
    () => buildTeacherModulesFromAnswers(periodAnswers),
    [periodAnswers],
  );

  const questionAnalytics = useMemo(
    () => buildTeacherQuestionsFromAnswers(periodAnswers, 8),
    [periodAnswers],
  );

  const studentReportRows = useMemo(
    () =>
      periodStudents
        .map((student) => {
          const answers = periodAnswers.filter(
            (answer) => answer.student_id === student.id,
          );
          const attempts = periodAttempts.filter(
            (attempt) => attempt.student_id === student.id,
          );
          const totals = getAnswerTotals(answers);

          return {
            student,
            attempts,
            answers,
            totals,
          };
        })
        .sort((left, right) =>
          left.student.fullName.localeCompare(right.student.fullName),
        ),
    [periodAnswers, periodAttempts, periodStudents],
  );

  function exportCsv() {
    const rows = [
      ["Período del reporte", reportPeriod.label],
      [],
      [
        "Estudiante",
        "Correo",
        "Carrera",
        "Simulaciones",
        "Promedio",
        "Mejor puntaje",
        "Correctas",
        "Incorrectas",
        "No respondidas",
        "Última actividad",
      ],
      ...studentReportRows.map(({ student, attempts, totals }) => [
          student.fullName,
          student.email,
          student.careerLabel,
          attempts.length,
          formatScore(student.averageScore),
          formatScore(student.bestScore),
          totals.correct,
          totals.incorrect,
          totals.unanswered,
          student.lastActivity ?? "",
        ]),
      [],
      [
        "Categoría",
        "Respuestas",
        "Correctas",
        "Incorrectas",
        "No respondidas",
        "Desempeño",
        "Tasa de alerta",
      ],
      ...moduleAnalytics.map((item) => [
        item.category,
        item.total,
        item.correct,
        item.incorrect,
        item.unanswered,
        formatScore(item.score),
        formatScore(item.affectedRate),
      ]),
    ];

    downloadBlob(
      `reporte-docente-caces-${reportPeriod.filePart}.csv`,
      rows.map((row) => row.map(csvValue).join(",")).join("\n"),
      "text/csv;charset=utf-8",
    );
  }

  function exportExcel() {
    const studentRows = studentReportRows
      .map(
        ({ student, attempts, totals }) =>
          `<tr><td>${escapeHtml(student.fullName)}</td><td>${escapeHtml(
            student.email,
          )}</td><td>${escapeHtml(student.careerLabel)}</td><td>${
            attempts.length
          }</td><td>${escapeHtml(formatScore(student.averageScore))}</td><td>${escapeHtml(
            formatScore(student.bestScore),
          )}</td><td>${totals.correct}</td><td>${totals.incorrect}</td><td>${
            totals.unanswered
          }</td></tr>`,
      )
      .join("");
    const moduleRows = moduleAnalytics
      .map(
        (item) =>
          `<tr><td>${escapeHtml(item.category)}</td><td>${item.total}</td><td>${item.correct}</td><td>${item.incorrect}</td><td>${item.unanswered}</td><td>${escapeHtml(
            formatScore(item.score),
          )}</td><td>${escapeHtml(
            formatScore(item.affectedRate),
          )}</td></tr>`,
      )
      .join("");
    const workbook = `<html><body><h1>Reporte docente CACES</h1><p><strong>Período:</strong> ${escapeHtml(reportPeriod.label)}</p><h2>Estudiantes</h2><table border="1"><tr><th>Estudiante</th><th>Correo</th><th>Carrera</th><th>Simulaciones</th><th>Promedio</th><th>Mejor</th><th>Correctas</th><th>Incorrectas</th><th>No respondidas</th></tr>${studentRows}</table><h2>Analítica por categoría</h2><table border="1"><tr><th>Categoría</th><th>Respuestas</th><th>Correctas</th><th>Incorrectas</th><th>No respondidas</th><th>Desempeño</th><th>Tasa de alerta</th></tr>${moduleRows}</table></body></html>`;

    downloadBlob(
      `reporte-docente-caces-${reportPeriod.filePart}.xls`,
      workbook,
      "application/vnd.ms-excel;charset=utf-8",
    );
  }

  async function exportPdf() {
    setIsExportingPdf(true);
    setPdfError("");

    try {
      const generatedAt = new Date();
      const report = await buildTeacherAnalyticsReportPdf({
        students: periodStudents,
        modules: moduleAnalytics,
        questions: questionAnalytics,
        attempts: periodAttempts,
        answers: periodAnswers,
        generatedAt,
        periodLabel: reportPeriod.label,
      });
      downloadBlob(
        getTeacherAnalyticsReportFilename(
          generatedAt,
          reportPeriod.filePart,
        ),
        report,
        "application/pdf",
      );
    } catch {
      setPdfError("No se pudo generar el reporte PDF. Intenta nuevamente.");
    } finally {
      setIsExportingPdf(false);
    }
  }

  async function exportStudentPdf(student: StudentCardData) {
    setExportingStudentId(student.id);
    setPdfError("");

    try {
      const generatedAt = new Date();
      const studentAnswers = periodAnswers.filter(
        (answer) => answer.student_id === student.id,
      );
      const studentAttempts = periodAttempts.filter(
        (attempt) => attempt.student_id === student.id,
      );
      const report = await buildStudentAnalyticsReportPdf({
        student,
        attempts: studentAttempts,
        answers: studentAnswers,
        modules: buildTeacherModulesFromAnswers(studentAnswers),
        questions: buildTeacherQuestionsFromAnswers(studentAnswers, 8),
        generatedAt,
        periodLabel: reportPeriod.label,
      });

      downloadBlob(
        getTeacherStudentReportFilename(
          student,
          generatedAt,
          reportPeriod.filePart,
        ),
        report,
        "application/pdf",
      );
    } catch {
      setPdfError(
        "No se pudo generar el reporte individual. Intenta nuevamente.",
      );
    } finally {
      setExportingStudentId("");
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-sky-700">
            Herramientas docentes
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-normal text-slate-950">
            Analítica y reportes
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            CSV
          </button>
          <button
            type="button"
            onClick={exportExcel}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
            Excel
          </button>
          <button
            type="button"
            onClick={() => void exportPdf()}
            disabled={isExportingPdf}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isExportingPdf ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <FileText className="h-4 w-4" aria-hidden="true" />
            )}
            {isExportingPdf ? "Generando..." : "Reporte general PDF"}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
            <CalendarDays className="h-4 w-4 text-sky-700" aria-hidden="true" />
            Período del reporte
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Mostrando {periodAttempts.length} intento
            {periodAttempts.length === 1 ? "" : "s"} de {reportPeriod.label}.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div>
            <span className="text-sm font-semibold text-slate-600">
              Agrupar por
            </span>
            <div
              role="group"
              aria-label="Seleccionar período del reporte"
              className="mt-2 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1"
            >
              {([
                ["day", "Día"],
                ["week", "Semana"],
              ] as const).map(([value, label]) => {
                const isActive = periodMode === value;

                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setPeriodMode(value)}
                    className={`h-9 rounded-md px-4 text-sm font-semibold transition ${
                      isActive
                        ? "bg-slate-950 text-white shadow-sm"
                        : "text-slate-600 hover:bg-white hover:text-slate-950"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="text-sm font-semibold text-slate-600">
            {periodMode === "day" ? "Fecha" : "Fecha dentro de la semana"}
            <input
              type="date"
              value={selectedDate}
              max={getCurrentEcuadorDateValue()}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="mt-2 block h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            />
          </label>
        </div>
      </div>

      {pdfError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {pdfError}
        </p>
      ) : null}

      <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-2">
            <UserRound className="h-5 w-5 text-slate-700" aria-hidden="true" />
            <div>
              <h3 className="text-base font-semibold text-slate-950">
                Reportes individuales
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Descarga un PDF por estudiante con historial, categorías,
                preguntas a revisar y no respondidas.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
          <div className="max-h-96 overflow-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="text-left text-xs font-semibold uppercase tracking-normal text-slate-500">
                  <th className="px-4 py-3">Estudiante</th>
                  <th className="px-4 py-3">Carrera</th>
                  <th className="px-4 py-3 text-right">Intentos</th>
                  <th className="px-4 py-3 text-right">Correctas</th>
                  <th className="px-4 py-3 text-right">Incorrectas</th>
                  <th className="px-4 py-3 text-right">Sin responder</th>
                  <th className="px-4 py-3 text-right">Reporte</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {studentReportRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-5 text-center text-sm text-slate-500"
                    >
                      No hay estudiantes disponibles para exportar.
                    </td>
                  </tr>
                ) : (
                  studentReportRows.map(({ student, attempts, totals }) => (
                    <tr key={student.id}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-950">
                          {student.fullName}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {student.email}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {student.careerLabel}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-700">
                        {attempts.length}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-emerald-700">
                        {totals.correct}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-red-700">
                        {totals.incorrect}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-amber-700">
                        {totals.unanswered}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => void exportStudentPdf(student)}
                          disabled={Boolean(exportingStudentId)}
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {exportingStudentId === student.id ? (
                            <Loader2
                              className="h-3.5 w-3.5 animate-spin"
                              aria-hidden="true"
                            />
                          ) : (
                            <FileText
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                          )}
                          PDF
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </article>

      <div className="grid gap-5 xl:grid-cols-2">
        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-violet-700" aria-hidden="true" />
              <div>
                <h3 className="text-base font-semibold text-slate-950">
                  Rendimiento por módulo
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Distribución de respuestas correctas, incorrectas y no
                  respondidas.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Correctas
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                Incorrectas
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                Sin responder
              </span>
            </div>
          </div>

          <div className="mt-5 space-y-5">
            {moduleAnalytics.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 p-5 text-sm text-slate-500">
                La gráfica aparecerá cuando existan respuestas registradas.
              </p>
            ) : (
              moduleAnalytics.slice(0, 6).map((item) => {
                const correctRate =
                  item.total > 0
                    ? Math.round((item.correct / item.total) * 100)
                    : 0;
                const incorrectRate =
                  item.total > 0
                    ? Math.round((item.incorrect / item.total) * 100)
                    : 0;
                const unansweredRate = Math.max(
                  0,
                  100 - correctRate - incorrectRate,
                );

                return (
                  <div key={item.category}>
                    <div className="mb-2 flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
                      <p className="font-medium text-slate-800">{item.category}</p>
                      <p className="text-xs text-slate-500">
                        {item.correct} correctas · {item.incorrect} incorrectas
                        · {item.unanswered} sin responder · {item.total}{" "}
                        respuestas
                      </p>
                    </div>
                    <div
                      role="img"
                      aria-label={`${item.category}: ${correctRate}% de respuestas correctas, ${incorrectRate}% incorrectas y ${unansweredRate}% sin responder.`}
                      className="flex h-4 overflow-hidden rounded-full bg-slate-100 ring-1 ring-inset ring-slate-200"
                    >
                      <div
                        className="bg-emerald-500 transition-[width]"
                        style={{ width: `${correctRate}%` }}
                      />
                      <div
                        className="bg-red-500 transition-[width]"
                        style={{ width: `${incorrectRate}%` }}
                      />
                      <div
                        className="bg-amber-400 transition-[width]"
                        style={{ width: `${unansweredRate}%` }}
                      />
                    </div>
                    <div className="mt-1.5 flex justify-between text-xs font-medium">
                      <span className="text-emerald-700">{correctRate}% correctas</span>
                      <span className="text-red-700">
                        {incorrectRate}% errores
                      </span>
                      <span className="text-amber-700">
                        {unansweredRate}% sin responder
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-sky-700" aria-hidden="true" />
            <h3 className="text-base font-semibold text-slate-950">
              Módulos con mayor dificultad
            </h3>
          </div>
          <div className="mt-4 space-y-3">
            {moduleAnalytics.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 p-5 text-sm text-slate-500">
                Aún no hay respuestas suficientes para calcular analítica.
              </p>
            ) : (
              moduleAnalytics.slice(0, 5).map((item) => (
                <div key={item.category} className="rounded-lg bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-950">
                      {item.category}
                    </p>
                    <p className="text-sm font-semibold text-red-700">
                      {formatScore(item.affectedRate)}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.incorrect} incorrectas · {item.unanswered} sin
                    responder · {item.total} respuestas
                  </p>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-emerald-700" aria-hidden="true" />
            <h3 className="text-base font-semibold text-slate-950">
              Preguntas que más fallan
            </h3>
          </div>
          <div className="mt-4 space-y-3">
            {questionAnalytics.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 p-5 text-sm text-slate-500">
                Las preguntas aparecerán cuando existan intentos registrados.
              </p>
            ) : (
              questionAnalytics.map((item) => (
                <div key={item.id} className="rounded-lg bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="line-clamp-2 text-sm font-semibold leading-6 text-slate-950">
                      {item.text}
                    </p>
                    <p className="shrink-0 text-sm font-semibold text-red-700">
                      {formatScore(item.affectedRate)}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.category} · {item.incorrect} incorrectas ·{" "}
                    {item.unanswered} sin responder de {item.total}
                  </p>
                </div>
              ))
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
