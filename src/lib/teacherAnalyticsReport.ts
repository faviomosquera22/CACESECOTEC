import type { StudentCardData } from "@/components/StudentCard";
import type { OptionLetter, Question } from "@/lib/database.types";
import {
  buildPerformanceCategoryInsights,
  buildPerformanceRecommendations,
} from "@/lib/performanceInsights";

type ReportQuestion = Pick<
  Question,
  "id" | "question_text" | "category" | "difficulty" | "correct_option"
>;

export type TeacherReportAnswer = {
  id?: string;
  simulation_id?: string;
  question_id: string;
  selected_option: OptionLetter | null;
  is_correct: boolean | null;
  answered_at?: string | null;
  student_id?: string | null;
  exam_slug?: string | null;
  attempt_id?: string | null;
  questions: ReportQuestion | null;
};

export type TeacherAttemptAnalytics = {
  id: string;
  student_id: string;
  exam_slug: string | null;
  finished_at: string | null;
  created_at: string | null;
  total_questions: number | null;
  correct_answers: number | null;
  incorrect_answers: number | null;
  unanswered_answers: number | null;
  score: number | null;
  time_used_seconds: number | null;
};

export type TeacherModuleAnalytics = {
  category: string;
  description?: string;
  focus?: string;
  total: number;
  incorrect: number;
  unanswered: number;
  correct: number;
  score: number;
  errorRate: number;
  omissionRate: number;
  affectedRate: number;
};

export type TeacherQuestionAnalytics = {
  id: string;
  text: string;
  category: string;
  difficulty?: string | null;
  total: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  errorRate: number;
  omissionRate: number;
  affectedRate: number;
};

export type TeacherAnalyticsReportData = {
  students: StudentCardData[];
  modules: TeacherModuleAnalytics[];
  questions: TeacherQuestionAnalytics[];
  attempts?: TeacherAttemptAnalytics[];
  answers?: TeacherReportAnswer[];
  generatedAt?: Date;
};

export type StudentAnalyticsReportData = {
  student: StudentCardData;
  attempts: TeacherAttemptAnalytics[];
  answers: TeacherReportAnswer[];
  modules: TeacherModuleAnalytics[];
  questions: TeacherQuestionAnalytics[];
  generatedAt?: Date;
};

type PdfDocument = Awaited<ReturnType<typeof createPdfDocument>>;

function formatPercentage(value: number) {
  return `${new Intl.NumberFormat("es-EC", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

function formatDate(value: string | null) {
  if (!value) {
    return "Sin actividad";
  }

  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDuration(seconds: number | null) {
  if (!seconds || seconds <= 0) {
    return "No registrado";
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours} h ${minutes} min`;
  }

  if (minutes > 0) {
    return `${minutes} min ${remainingSeconds} s`;
  }

  return `${remainingSeconds} s`;
}

function formatExamLabel(value: string | null | undefined) {
  if (value === "enfermeria") {
    return "Enfermería";
  }

  if (value === "psicologia") {
    return "Psicología";
  }

  return value?.trim() || "Sin carrera";
}

function getWeightedAverage(students: StudentCardData[]) {
  const totalAttempts = students.reduce(
    (total, student) => total + student.simulationsCount,
    0,
  );

  if (totalAttempts === 0) {
    return 0;
  }

  return (
    students.reduce(
      (total, student) =>
        total + student.averageScore * student.simulationsCount,
      0,
    ) / totalAttempts
  );
}

function getAnswerTotals(answers: TeacherReportAnswer[]) {
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

function getAttemptAverage(attempts: TeacherAttemptAnalytics[]) {
  const scoredAttempts = attempts.filter(
    (attempt) => typeof attempt.score === "number",
  );

  if (scoredAttempts.length === 0) {
    return 0;
  }

  return (
    scoredAttempts.reduce((total, attempt) => total + (attempt.score ?? 0), 0) /
    scoredAttempts.length
  );
}

function getBestAttemptScore(attempts: TeacherAttemptAnalytics[]) {
  return attempts.reduce(
    (best, attempt) =>
      typeof attempt.score === "number" ? Math.max(best, attempt.score) : best,
    0,
  );
}

function getAttemptDate(attempt: TeacherAttemptAnalytics) {
  return attempt.finished_at ?? attempt.created_at;
}

function getLatestAttemptDate(attempts: TeacherAttemptAnalytics[]) {
  return attempts
    .map(getAttemptDate)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null;
}

function getQuestionRows(questions: TeacherQuestionAnalytics[]) {
  return questions.length > 0
    ? questions.map((question) => [
        question.text,
        question.category,
        question.difficulty ?? "No registrada",
        question.total,
        question.correct,
        question.incorrect,
        question.unanswered,
        formatPercentage(question.affectedRate),
      ])
    : [["No hay respuestas registradas", "", "", 0, 0, 0, 0, formatPercentage(0)]];
}

function getModuleRows(modules: TeacherModuleAnalytics[]) {
  return modules.length > 0
    ? modules.map((module) => [
        module.category,
        module.focus ?? "Revisión de contenidos del área.",
        module.total,
        module.correct,
        module.incorrect,
        module.unanswered,
        formatPercentage(module.score),
        formatPercentage(module.affectedRate),
      ])
    : [["No hay respuestas registradas", "", 0, 0, 0, 0, formatPercentage(0), formatPercentage(0)]];
}

function getDatePart(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function getSafeFilePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60);
}

async function createPdfDocument(
  orientation: "portrait" | "landscape" = "landscape",
) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const document = new jsPDF({
    orientation,
    unit: "mm",
    format: "a4",
  });

  return { document, autoTable };
}

function addHeader({
  document,
  title,
  subtitle,
  pageWidth,
  margin,
  navy,
}: {
  document: PdfDocument["document"];
  title: string;
  subtitle: string;
  pageWidth: number;
  margin: number;
  navy: [number, number, number];
}) {
  document.setFillColor(...navy);
  document.rect(0, 0, pageWidth, 28, "F");
  document.setTextColor(255, 255, 255);
  document.setFont("helvetica", "bold");
  document.setFontSize(17);
  document.text(title, margin, 12);
  document.setFont("helvetica", "normal");
  document.setFontSize(9);
  document.text(subtitle, margin, 20);
}

function addSummaryCards({
  document,
  items,
  y,
  pageWidth,
  margin,
  navy,
  slate,
  lightSlate,
}: {
  document: PdfDocument["document"];
  items: [string, string][];
  y: number;
  pageWidth: number;
  margin: number;
  navy: [number, number, number];
  slate: [number, number, number];
  lightSlate: [number, number, number];
}) {
  const gap = 4;
  const width = (pageWidth - margin * 2 - gap * (items.length - 1)) / items.length;

  items.forEach(([label, value], index) => {
    const x = margin + index * (width + gap);
    document.setFillColor(...lightSlate);
    document.roundedRect(x, y, width, 18, 2, 2, "F");
    document.setTextColor(...slate);
    document.setFont("helvetica", "normal");
    document.setFontSize(8);
    document.text(label, x + 4, y + 6);
    document.setTextColor(...navy);
    document.setFont("helvetica", "bold");
    document.setFontSize(12);
    document.text(value, x + 4, y + 14);
  });
}

function addFooter({
  document,
  pageWidth,
  pageHeight,
  margin,
  slate,
  label,
}: {
  document: PdfDocument["document"];
  pageWidth: number;
  pageHeight: number;
  margin: number;
  slate: [number, number, number];
  label: string;
}) {
  const totalPages = document.getNumberOfPages();

  for (let page = 1; page <= totalPages; page += 1) {
    document.setPage(page);
    document.setDrawColor(226, 232, 240);
    document.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);
    document.setTextColor(...slate);
    document.setFont("helvetica", "normal");
    document.setFontSize(7);
    document.text(`CACES Simulador - ${label}`, margin, pageHeight - 5.5);
    document.text(
      `Página ${page} de ${totalPages}`,
      pageWidth - margin,
      pageHeight - 5.5,
      { align: "right" },
    );
  }
}

function buildCareerRows({
  students,
  attempts,
  answers,
}: {
  students: StudentCardData[];
  attempts: TeacherAttemptAnalytics[];
  answers: TeacherReportAnswer[];
}) {
  const careers = new Map<
    string,
    {
      label: string;
      studentIds: Set<string>;
      students: StudentCardData[];
      attempts: TeacherAttemptAnalytics[];
      answers: TeacherReportAnswer[];
    }
  >();

  students.forEach((student) => {
    const key = student.careerSlug ?? student.careerLabel;
    const current = careers.get(key) ?? {
      label: student.careerLabel,
      studentIds: new Set<string>(),
      students: [],
      attempts: [],
      answers: [],
    };
    current.studentIds.add(student.id);
    current.students.push(student);
    careers.set(key, current);
  });

  attempts.forEach((attempt) => {
    const career = Array.from(careers.values()).find((item) =>
      item.studentIds.has(attempt.student_id),
    );
    career?.attempts.push(attempt);
  });

  answers.forEach((answer) => {
    const career = Array.from(careers.values()).find(
      (item) => answer.student_id && item.studentIds.has(answer.student_id),
    );
    career?.answers.push(answer);
  });

  return Array.from(careers.values()).map((career) => {
    const totals = getAnswerTotals(career.answers);
    const attemptsCount =
      career.attempts.length ||
      career.students.reduce((total, student) => total + student.simulationsCount, 0);

    return [
      career.label,
      career.students.length,
      attemptsCount,
      formatPercentage(getWeightedAverage(career.students)),
      totals.total,
      totals.correct,
      totals.incorrect,
      totals.unanswered,
    ];
  });
}

export function buildTeacherModulesFromAnswers(
  answers: TeacherReportAnswer[],
): TeacherModuleAnalytics[] {
  return buildPerformanceCategoryInsights(answers).map((insight) => ({
    ...insight,
    errorRate:
      insight.total > 0
        ? Math.round((insight.incorrect / insight.total) * 10000) / 100
        : 0,
    omissionRate:
      insight.total > 0
        ? Math.round((insight.unanswered / insight.total) * 10000) / 100
        : 0,
    affectedRate:
      insight.total > 0
        ? Math.round(
            ((insight.incorrect + insight.unanswered) / insight.total) * 10000,
          ) / 100
        : 0,
  }));
}

export function buildTeacherQuestionsFromAnswers(
  answers: TeacherReportAnswer[],
  limit = 10,
): TeacherQuestionAnalytics[] {
  const questions = new Map<
    string,
    {
      id: string;
      text: string;
      category: string;
      difficulty?: string | null;
      total: number;
      correct: number;
      incorrect: number;
      unanswered: number;
    }
  >();

  answers.forEach((answer) => {
    const current = questions.get(answer.question_id) ?? {
      id: answer.question_id,
      text: answer.questions?.question_text ?? "Pregunta no disponible",
      category: answer.questions?.category?.trim() || "Sin categoría",
      difficulty: answer.questions?.difficulty ?? null,
      total: 0,
      correct: 0,
      incorrect: 0,
      unanswered: 0,
    };

    current.total += 1;
    if (answer.is_correct === true) {
      current.correct += 1;
    } else if (answer.selected_option === null) {
      current.unanswered += 1;
    } else {
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
      omissionRate:
        item.total > 0
          ? Math.round((item.unanswered / item.total) * 10000) / 100
          : 0,
      affectedRate:
        item.total > 0
          ? Math.round(
              ((item.incorrect + item.unanswered) / item.total) * 10000,
            ) / 100
          : 0,
    }))
    .filter((item) => item.total > 0)
    .sort(
      (left, right) =>
        right.affectedRate - left.affectedRate ||
        right.total - left.total ||
        left.text.localeCompare(right.text),
    )
    .slice(0, limit);
}

export async function buildTeacherAnalyticsReportPdf({
  students,
  modules,
  questions,
  attempts = [],
  answers = [],
  generatedAt = new Date(),
}: TeacherAnalyticsReportData) {
  const { document, autoTable } = await createPdfDocument("landscape");
  const pageWidth = document.internal.pageSize.getWidth();
  const pageHeight = document.internal.pageSize.getHeight();
  const margin = 12;
  const navy: [number, number, number] = [15, 23, 42];
  const blue: [number, number, number] = [3, 105, 161];
  const slate: [number, number, number] = [71, 85, 105];
  const lightSlate: [number, number, number] = [241, 245, 249];
  const totalAttempts =
    attempts.length ||
    students.reduce((total, student) => total + student.simulationsCount, 0);
  const totals = getAnswerTotals(answers);
  const careerLabels = Array.from(
    new Set(students.map((student) => student.careerLabel).filter(Boolean)),
  );
  const careerLabel =
    careerLabels.length === 1 ? careerLabels[0] : "Enfermería y Psicología";

  document.setProperties({
    title: "Reporte general docente CACES",
    subject: "Analítica académica de estudiantes",
    author: "CACES Simulador",
    creator: "CACES Simulador",
  });

  addHeader({
    document,
    title: "Reporte general de desempeño",
    subtitle: `Analítica académica - ${careerLabel} - ${new Intl.DateTimeFormat("es-EC", {
      dateStyle: "long",
      timeStyle: "short",
    }).format(generatedAt)}`,
    pageWidth,
    margin,
    navy,
  });

  addSummaryCards({
    document,
    y: 34,
    pageWidth,
    margin,
    navy,
    slate,
    lightSlate,
    items: [
      ["Estudiantes", String(students.length)],
      ["Intentos terminados", String(totalAttempts)],
      ["Promedio general", formatPercentage(getWeightedAverage(students))],
      ["Sin responder", String(totals.unanswered)],
      ["Respuestas analizadas", String(totals.total || modules.reduce((total, module) => total + module.total, 0))],
    ],
  });

  const documentWithTable = document as typeof document & {
    lastAutoTable?: { finalY?: number };
  };

  function prepareSection(title: string, minimumSpace = 32) {
    let y = (documentWithTable.lastAutoTable?.finalY ?? 55) + 9;

    if (y > pageHeight - minimumSpace) {
      document.addPage();
      y = 18;
    }

    document.setTextColor(...navy);
    document.setFont("helvetica", "bold");
    document.setFontSize(11);
    document.text(title, margin, y);
    return y + 4;
  }

  autoTable(document, {
    startY: 62,
    margin: { left: margin, right: margin, bottom: 14 },
    head: [
      [
        "Carrera",
        "Estudiantes",
        "Intentos",
        "Promedio",
        "Respuestas",
        "Correctas",
        "Incorrectas",
        "Sin responder",
      ],
    ],
    body: buildCareerRows({ students, attempts, answers }),
    theme: "grid",
    showHead: "everyPage",
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 2,
      textColor: navy,
      lineColor: [203, 213, 225],
      lineWidth: 0.15,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: blue,
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
    },
  });

  const answersByStudent = new Map<string, TeacherReportAnswer[]>();
  answers.forEach((answer) => {
    if (!answer.student_id) {
      return;
    }
    const current = answersByStudent.get(answer.student_id) ?? [];
    current.push(answer);
    answersByStudent.set(answer.student_id, current);
  });
  const attemptsByStudent = new Map<string, TeacherAttemptAnalytics[]>();
  attempts.forEach((attempt) => {
    const current = attemptsByStudent.get(attempt.student_id) ?? [];
    current.push(attempt);
    attemptsByStudent.set(attempt.student_id, current);
  });

  autoTable(document, {
    startY: prepareSection("Detalle de estudiantes", 60),
    margin: { left: margin, right: margin, bottom: 14 },
    head: [
      [
        "Estudiante",
        "Correo",
        "Carrera",
        "Intentos",
        "Promedio",
        "Mejor",
        "Correctas",
        "Incorrectas",
        "Sin responder",
        "Última actividad",
      ],
    ],
    body:
      students.length > 0
        ? students.map((student) => {
            const studentAnswers = answersByStudent.get(student.id) ?? [];
            const studentAttempts = attemptsByStudent.get(student.id) ?? [];
            const answerTotals = getAnswerTotals(studentAnswers);

            return [
              student.fullName,
              student.email,
              student.careerLabel,
              studentAttempts.length || student.simulationsCount,
              formatPercentage(
                studentAttempts.length > 0
                  ? getAttemptAverage(studentAttempts)
                  : student.averageScore,
              ),
              formatPercentage(
                studentAttempts.length > 0
                  ? getBestAttemptScore(studentAttempts)
                  : student.bestScore,
              ),
              answerTotals.correct,
              answerTotals.incorrect,
              answerTotals.unanswered,
              formatDate(getLatestAttemptDate(studentAttempts) ?? student.lastActivity),
            ];
          })
        : [["No hay estudiantes disponibles", "", "", "", "", "", "", "", "", ""]],
    theme: "grid",
    showHead: "everyPage",
    styles: {
      font: "helvetica",
      fontSize: 7.2,
      cellPadding: 1.8,
      textColor: navy,
      lineColor: [203, 213, 225],
      lineWidth: 0.15,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fillColor: navy,
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 43 },
      1: { cellWidth: 54 },
      2: { cellWidth: 28 },
      3: { cellWidth: 14, halign: "right" },
      4: { cellWidth: 17, halign: "right" },
      5: { cellWidth: 17, halign: "right" },
      6: { cellWidth: 18, halign: "right" },
      7: { cellWidth: 19, halign: "right" },
      8: { cellWidth: 20, halign: "right" },
      9: { cellWidth: 37 },
    },
  });

  autoTable(document, {
    startY: prepareSection("Rendimiento por categoría", 70),
    margin: { left: margin, right: margin, bottom: 14 },
    head: [
      [
        "Categoría",
        "Enfoque recomendado",
        "Total",
        "Correctas",
        "Incorrectas",
        "Sin responder",
        "Desempeño",
        "Alerta",
      ],
    ],
    body: getModuleRows(modules),
    theme: "grid",
    showHead: "everyPage",
    styles: {
      font: "helvetica",
      fontSize: 7.4,
      cellPadding: 2,
      textColor: navy,
      lineColor: [203, 213, 225],
      lineWidth: 0.15,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: blue,
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 62 },
      2: { cellWidth: 16, halign: "right" },
      3: { cellWidth: 17, halign: "right" },
      4: { cellWidth: 19, halign: "right" },
      5: { cellWidth: 21, halign: "right" },
      6: { cellWidth: 20, halign: "right" },
      7: { cellWidth: 22, halign: "right" },
    },
  });

  autoTable(document, {
    startY: prepareSection("Preguntas con mayor dificultad", 62),
    margin: { left: margin, right: margin, bottom: 14 },
    head: [
      [
        "Pregunta",
        "Categoría",
        "Dificultad",
        "Vistas",
        "Correctas",
        "Incorrectas",
        "Sin resp.",
        "Alerta",
      ],
    ],
    body: getQuestionRows(questions),
    theme: "grid",
    showHead: "everyPage",
    rowPageBreak: "avoid",
    styles: {
      font: "helvetica",
      fontSize: 7.2,
      cellPadding: 2,
      textColor: navy,
      lineColor: [203, 213, 225],
      lineWidth: 0.15,
      overflow: "linebreak",
      valign: "top",
    },
    headStyles: {
      fillColor: navy,
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 88 },
      1: { cellWidth: 54 },
      2: { cellWidth: 20 },
      3: { cellWidth: 18, halign: "right" },
      4: { cellWidth: 17, halign: "right" },
      5: { cellWidth: 19, halign: "right" },
      6: { cellWidth: 19, halign: "right" },
      7: { cellWidth: 22, halign: "right" },
    },
  });

  addFooter({
    document,
    pageWidth,
    pageHeight,
    margin,
    slate,
    label: "Reporte general docente",
  });

  return document.output("arraybuffer");
}

export async function buildStudentAnalyticsReportPdf({
  student,
  attempts,
  answers,
  modules,
  questions,
  generatedAt = new Date(),
}: StudentAnalyticsReportData) {
  const { document, autoTable } = await createPdfDocument("portrait");
  const pageWidth = document.internal.pageSize.getWidth();
  const pageHeight = document.internal.pageSize.getHeight();
  const margin = 12;
  const navy: [number, number, number] = [15, 23, 42];
  const blue: [number, number, number] = [3, 105, 161];
  const slate: [number, number, number] = [71, 85, 105];
  const lightSlate: [number, number, number] = [241, 245, 249];
  const totals = getAnswerTotals(answers);
  const sortedAttempts = [...attempts].sort(
    (left, right) =>
      Date.parse(getAttemptDate(right) ?? "") -
      Date.parse(getAttemptDate(left) ?? ""),
  );
  const recommendations = buildPerformanceRecommendations(answers).slice(0, 5);

  document.setProperties({
    title: `Reporte individual - ${student.fullName}`,
    subject: "Analítica académica individual",
    author: "CACES Simulador",
    creator: "CACES Simulador",
  });

  addHeader({
    document,
    title: "Reporte individual de estudiante",
    subtitle: `${student.fullName} - ${student.careerLabel} - ${new Intl.DateTimeFormat("es-EC", {
      dateStyle: "long",
      timeStyle: "short",
    }).format(generatedAt)}`,
    pageWidth,
    margin,
    navy,
  });

  addSummaryCards({
    document,
    y: 34,
    pageWidth,
    margin,
    navy,
    slate,
    lightSlate,
    items: [
      ["Intentos", String(sortedAttempts.length || student.simulationsCount)],
      ["Promedio", formatPercentage(sortedAttempts.length > 0 ? getAttemptAverage(sortedAttempts) : student.averageScore)],
      ["Mejor", formatPercentage(sortedAttempts.length > 0 ? getBestAttemptScore(sortedAttempts) : student.bestScore)],
      ["Sin responder", String(totals.unanswered)],
    ],
  });

  const documentWithTable = document as typeof document & {
    lastAutoTable?: { finalY?: number };
  };

  function prepareSection(title: string, minimumSpace = 30) {
    let y = (documentWithTable.lastAutoTable?.finalY ?? 56) + 9;

    if (y > pageHeight - minimumSpace) {
      document.addPage();
      y = 18;
    }

    document.setTextColor(...navy);
    document.setFont("helvetica", "bold");
    document.setFontSize(11);
    document.text(title, margin, y);
    return y + 4;
  }

  autoTable(document, {
    startY: 62,
    margin: { left: margin, right: margin, bottom: 14 },
    head: [["Campo", "Detalle"]],
    body: [
      ["Estudiante", student.fullName],
      ["Correo", student.email],
      ["Carrera", student.careerLabel],
      ["Última actividad", formatDate(getLatestAttemptDate(sortedAttempts) ?? student.lastActivity)],
      ["Respuestas analizadas", String(totals.total)],
      ["Correctas / Incorrectas / Sin responder", `${totals.correct} / ${totals.incorrect} / ${totals.unanswered}`],
    ],
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: 2.2,
      textColor: navy,
      lineColor: [203, 213, 225],
      lineWidth: 0.15,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: blue,
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 52, fontStyle: "bold" },
      1: { cellWidth: 134 },
    },
  });

  autoTable(document, {
    startY: prepareSection("Historial de intentos", 54),
    margin: { left: margin, right: margin, bottom: 14 },
    head: [["Fecha", "Simulador", "Puntaje", "Correctas", "Incorrectas", "Sin responder", "Tiempo"]],
    body:
      sortedAttempts.length > 0
        ? sortedAttempts.map((attempt) => [
            formatDate(getAttemptDate(attempt)),
            formatExamLabel(attempt.exam_slug ?? student.careerSlug),
            formatPercentage(attempt.score ?? 0),
            attempt.correct_answers ?? 0,
            attempt.incorrect_answers ?? 0,
            attempt.unanswered_answers ?? 0,
            formatDuration(attempt.time_used_seconds),
          ])
        : [["No hay intentos terminados", "", "", "", "", "", ""]],
    theme: "grid",
    showHead: "everyPage",
    styles: {
      font: "helvetica",
      fontSize: 7.8,
      cellPadding: 2,
      textColor: navy,
      lineColor: [203, 213, 225],
      lineWidth: 0.15,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: navy,
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 34 },
      1: { cellWidth: 30 },
      2: { cellWidth: 24, halign: "right" },
      3: { cellWidth: 24, halign: "right" },
      4: { cellWidth: 25, halign: "right" },
      5: { cellWidth: 27, halign: "right" },
      6: { cellWidth: 22, halign: "right" },
    },
  });

  autoTable(document, {
    startY: prepareSection("Desempeño por categoría", 60),
    margin: { left: margin, right: margin, bottom: 14 },
    head: [["Categoría", "Total", "Correctas", "Incorrectas", "Sin responder", "Desempeño", "Enfoque"]],
    body:
      modules.length > 0
        ? modules.map((module) => [
            module.category,
            module.total,
            module.correct,
            module.incorrect,
            module.unanswered,
            formatPercentage(module.score),
            module.focus ?? "Revisión de contenidos del área.",
          ])
        : [["No hay respuestas registradas", 0, 0, 0, 0, formatPercentage(0), ""]],
    theme: "grid",
    showHead: "everyPage",
    styles: {
      font: "helvetica",
      fontSize: 7.5,
      cellPadding: 2,
      textColor: navy,
      lineColor: [203, 213, 225],
      lineWidth: 0.15,
      overflow: "linebreak",
      valign: "top",
    },
    headStyles: {
      fillColor: blue,
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 16, halign: "right" },
      2: { cellWidth: 18, halign: "right" },
      3: { cellWidth: 20, halign: "right" },
      4: { cellWidth: 24, halign: "right" },
      5: { cellWidth: 20, halign: "right" },
      6: { cellWidth: 38 },
    },
  });

  autoTable(document, {
    startY: prepareSection("Preguntas a revisar", 62),
    margin: { left: margin, right: margin, bottom: 14 },
    head: [["Pregunta", "Categoría", "Incorrectas", "Sin responder", "Alerta"]],
    body:
      questions.length > 0
        ? questions.map((question) => [
            question.text,
            question.category,
            question.incorrect,
            question.unanswered,
            formatPercentage(question.affectedRate),
          ])
        : [["No hay preguntas pendientes de revisión", "", 0, 0, formatPercentage(0)]],
    theme: "grid",
    showHead: "everyPage",
    rowPageBreak: "avoid",
    styles: {
      font: "helvetica",
      fontSize: 7.3,
      cellPadding: 2,
      textColor: navy,
      lineColor: [203, 213, 225],
      lineWidth: 0.15,
      overflow: "linebreak",
      valign: "top",
    },
    headStyles: {
      fillColor: navy,
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 74 },
      1: { cellWidth: 54 },
      2: { cellWidth: 20, halign: "right" },
      3: { cellWidth: 23, halign: "right" },
      4: { cellWidth: 15, halign: "right" },
    },
  });

  autoTable(document, {
    startY: prepareSection("Recomendaciones", 42),
    margin: { left: margin, right: margin, bottom: 14 },
    head: [["Prioridad sugerida"]],
    body:
      recommendations.length > 0
        ? recommendations.map((recommendation) => [recommendation])
        : [["No hay recomendaciones disponibles todavía."]],
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 2.4,
      textColor: navy,
      lineColor: [203, 213, 225],
      lineWidth: 0.15,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: blue,
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
  });

  addFooter({
    document,
    pageWidth,
    pageHeight,
    margin,
    slate,
    label: "Reporte individual",
  });

  return document.output("arraybuffer");
}

export function getTeacherAnalyticsReportFilename(date = new Date()) {
  return `reporte-general-caces-${getDatePart(date)}.pdf`;
}

export function getTeacherStudentReportFilename(
  student: StudentCardData,
  date = new Date(),
) {
  return `reporte-${getSafeFilePart(student.fullName || "estudiante")}-${getDatePart(date)}.pdf`;
}
