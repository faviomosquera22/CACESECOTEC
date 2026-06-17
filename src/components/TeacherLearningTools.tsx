"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import type { StudentCardData } from "@/components/StudentCard";
import { formatScore } from "@/lib/format";
import {
  getLocalSimulationIndexKey,
  subscribeToLocalSimulationChanges,
} from "@/lib/localSimulationStorage";
import type { OptionLetter, Question } from "@/lib/database.types";

export type TeacherQuestionAnswerRecord = {
  question_id: string;
  selected_option: OptionLetter | null;
  is_correct: boolean | null;
  questions: Pick<
    Question,
    "id" | "question_text" | "category" | "difficulty" | "correct_option"
  > | null;
};

type TeacherLearningToolsProps = {
  students: StudentCardData[];
  serverAnswers: TeacherQuestionAnswerRecord[];
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

function readLocalAnswers(students: StudentCardData[]) {
  if (typeof window === "undefined") {
    return [];
  }

  return students.flatMap((student) => {
    const summaries = readJsonArray<{ id: string }>(
      window.localStorage.getItem(getLocalSimulationIndexKey(student.id)),
    );

    return summaries.flatMap((summary) => {
      const rawPayload = window.localStorage.getItem(
        `local-simulation:${summary.id}`,
      );

      if (!rawPayload) {
        return [];
      }

      try {
        const payload = JSON.parse(rawPayload) as {
          answers?: TeacherQuestionAnswerRecord[];
        };

        return payload.answers ?? [];
      } catch {
        return [];
      }
    });
  });
}

function csvValue(value: string | number | null | undefined) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadBlob(filename: string, content: string, type: string) {
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

export function TeacherLearningTools({
  students,
  serverAnswers,
}: TeacherLearningToolsProps) {
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

  const allAnswers = useMemo(() => {
    void localStorageSnapshot;
    return [...serverAnswers, ...readLocalAnswers(students)];
  }, [localStorageSnapshot, serverAnswers, students]);

  const moduleAnalytics = useMemo(() => {
    const modules = new Map<
      string,
      { category: string; total: number; incorrect: number; correct: number }
    >();

    allAnswers.forEach((answer) => {
      const category = answer.questions?.category?.trim() || "Sin categoría";
      const current = modules.get(category) ?? {
        category,
        total: 0,
        incorrect: 0,
        correct: 0,
      };

      current.total += 1;
      if (answer.is_correct === true) {
        current.correct += 1;
      } else {
        current.incorrect += 1;
      }
      modules.set(category, current);
    });

    return Array.from(modules.values())
      .map((item) => ({
        ...item,
        errorRate:
          item.total > 0
            ? Math.round((item.incorrect / item.total) * 10000) / 100
            : 0,
      }))
      .sort(
        (left, right) =>
          right.errorRate - left.errorRate ||
          right.total - left.total ||
          left.category.localeCompare(right.category),
      );
  }, [allAnswers]);

  const questionAnalytics = useMemo(() => {
    const questions = new Map<
      string,
      {
        id: string;
        text: string;
        category: string;
        total: number;
        incorrect: number;
      }
    >();

    allAnswers.forEach((answer) => {
      const current = questions.get(answer.question_id) ?? {
        id: answer.question_id,
        text: answer.questions?.question_text ?? "Pregunta no disponible",
        category: answer.questions?.category?.trim() || "Sin categoría",
        total: 0,
        incorrect: 0,
      };

      current.total += 1;
      if (answer.is_correct !== true) {
        current.incorrect += 1;
      }
      questions.set(answer.question_id, current);
    });

    return Array.from(questions.values())
      .map((item) => ({
        ...item,
        errorRate:
          item.total > 0
            ? Math.round((item.incorrect / item.total) * 10000) / 100
            : 0,
      }))
      .filter((item) => item.total > 0)
      .sort(
        (left, right) =>
          right.errorRate - left.errorRate ||
          right.total - left.total ||
          left.text.localeCompare(right.text),
      )
      .slice(0, 6);
  }, [allAnswers]);

  function exportCsv() {
    const rows = [
      [
        "Estudiante",
        "Correo",
        "Carrera",
        "Simulaciones",
        "Promedio",
        "Mejor puntaje",
        "Última actividad",
      ],
      ...students.map((student) => [
        student.fullName,
        student.email,
        student.careerLabel,
        student.simulationsCount,
        formatScore(student.averageScore),
        formatScore(student.bestScore),
        student.lastActivity ?? "",
      ]),
      [],
      ["Módulo", "Respuestas", "Correctas", "Incorrectas", "Tasa de error"],
      ...moduleAnalytics.map((item) => [
        item.category,
        item.total,
        item.correct,
        item.incorrect,
        formatScore(item.errorRate),
      ]),
    ];

    downloadBlob(
      "reporte-docente-caces.csv",
      rows.map((row) => row.map(csvValue).join(",")).join("\n"),
      "text/csv;charset=utf-8",
    );
  }

  function exportExcel() {
    const studentRows = students
      .map(
        (student) =>
          `<tr><td>${escapeHtml(student.fullName)}</td><td>${escapeHtml(
            student.email,
          )}</td><td>${escapeHtml(student.careerLabel)}</td><td>${
            student.simulationsCount
          }</td><td>${escapeHtml(formatScore(student.averageScore))}</td><td>${escapeHtml(
            formatScore(student.bestScore),
          )}</td></tr>`,
      )
      .join("");
    const moduleRows = moduleAnalytics
      .map(
        (item) =>
          `<tr><td>${escapeHtml(item.category)}</td><td>${item.total}</td><td>${item.correct}</td><td>${item.incorrect}</td><td>${escapeHtml(
            formatScore(item.errorRate),
          )}</td></tr>`,
      )
      .join("");
    const workbook = `<html><body><h1>Reporte docente CACES</h1><h2>Estudiantes</h2><table border="1"><tr><th>Estudiante</th><th>Correo</th><th>Carrera</th><th>Simulaciones</th><th>Promedio</th><th>Mejor</th></tr>${studentRows}</table><h2>Analítica por módulo</h2><table border="1"><tr><th>Módulo</th><th>Respuestas</th><th>Correctas</th><th>Incorrectas</th><th>Tasa de error</th></tr>${moduleRows}</table></body></html>`;

    downloadBlob(
      "reporte-docente-caces.xls",
      workbook,
      "application/vnd.ms-excel;charset=utf-8",
    );
  }

  function exportPdf() {
    const reportWindow = window.open("", "_blank", "noopener,noreferrer");

    if (!reportWindow) {
      return;
    }

    reportWindow.document.write(`
      <html>
        <head>
          <title>Reporte docente CACES</title>
          <style>
            body { font-family: Arial, sans-serif; color: #0f172a; padding: 24px; }
            table { border-collapse: collapse; width: 100%; margin-top: 16px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; font-size: 12px; }
            th { background: #0f172a; color: white; }
            h1, h2 { margin-bottom: 8px; }
          </style>
        </head>
        <body>
          <h1>Reporte docente CACES</h1>
          <p>Total de estudiantes: ${students.length}</p>
          <h2>Módulos con mayor error</h2>
          <table>
            <tr><th>Módulo</th><th>Respuestas</th><th>Incorrectas</th><th>Tasa de error</th></tr>
            ${moduleAnalytics
              .map(
                (item) =>
                  `<tr><td>${escapeHtml(item.category)}</td><td>${item.total}</td><td>${item.incorrect}</td><td>${escapeHtml(
                    formatScore(item.errorRate),
                  )}</td></tr>`,
              )
              .join("")}
          </table>
        </body>
      </html>
    `);
    reportWindow.document.close();
    reportWindow.print();
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
            onClick={exportPdf}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            PDF
          </button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
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
                      {formatScore(item.errorRate)}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.incorrect} errores de {item.total} respuestas
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
                      {formatScore(item.errorRate)}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.category} · {item.incorrect} errores de {item.total}
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
