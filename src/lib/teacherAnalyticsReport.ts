import type { StudentCardData } from "@/components/StudentCard";

export type TeacherModuleAnalytics = {
  category: string;
  total: number;
  incorrect: number;
  correct: number;
  errorRate: number;
};

export type TeacherQuestionAnalytics = {
  id: string;
  text: string;
  category: string;
  total: number;
  incorrect: number;
  errorRate: number;
};

export type TeacherAnalyticsReportData = {
  students: StudentCardData[];
  modules: TeacherModuleAnalytics[];
  questions: TeacherQuestionAnalytics[];
  generatedAt?: Date;
};

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

export async function buildTeacherAnalyticsReportPdf({
  students,
  modules,
  questions,
  generatedAt = new Date(),
}: TeacherAnalyticsReportData) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const document = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });
  const pageWidth = document.internal.pageSize.getWidth();
  const pageHeight = document.internal.pageSize.getHeight();
  const margin = 12;
  const navy: [number, number, number] = [15, 23, 42];
  const blue: [number, number, number] = [3, 105, 161];
  const slate: [number, number, number] = [71, 85, 105];
  const lightSlate: [number, number, number] = [241, 245, 249];
  const totalAttempts = students.reduce(
    (total, student) => total + student.simulationsCount,
    0,
  );
  const totalAnswers = modules.reduce((total, module) => total + module.total, 0);
  const careerLabels = Array.from(
    new Set(students.map((student) => student.careerLabel).filter(Boolean)),
  );
  const careerLabel =
    careerLabels.length === 1 ? careerLabels[0] : "Carreras asignadas";

  document.setProperties({
    title: "Reporte docente CACES",
    subject: "Analítica académica de estudiantes",
    author: "CACES Simulador",
    creator: "CACES Simulador",
  });

  document.setFillColor(...navy);
  document.rect(0, 0, pageWidth, 27, "F");
  document.setTextColor(255, 255, 255);
  document.setFont("helvetica", "bold");
  document.setFontSize(18);
  document.text("Reporte docente CACES", margin, 12);
  document.setFont("helvetica", "normal");
  document.setFontSize(9);
  document.text(
    `Analítica académica - ${careerLabel} - ${new Intl.DateTimeFormat("es-EC", {
      dateStyle: "long",
      timeStyle: "short",
    }).format(generatedAt)}`,
    margin,
    20,
  );

  const summaryItems = [
    ["Estudiantes", String(students.length)],
    ["Intentos terminados", String(totalAttempts)],
    ["Promedio general", formatPercentage(getWeightedAverage(students))],
    ["Respuestas analizadas", String(totalAnswers)],
  ];
  const summaryGap = 4;
  const summaryWidth =
    (pageWidth - margin * 2 - summaryGap * (summaryItems.length - 1)) /
    summaryItems.length;

  summaryItems.forEach(([label, value], index) => {
    const x = margin + index * (summaryWidth + summaryGap);
    document.setFillColor(...lightSlate);
    document.roundedRect(x, 33, summaryWidth, 18, 2, 2, "F");
    document.setTextColor(...slate);
    document.setFont("helvetica", "normal");
    document.setFontSize(8);
    document.text(label, x + 4, 39);
    document.setTextColor(...navy);
    document.setFont("helvetica", "bold");
    document.setFontSize(13);
    document.text(value, x + 4, 47);
  });

  document.setTextColor(...navy);
  document.setFont("helvetica", "bold");
  document.setFontSize(11);
  document.text("Detalle de estudiantes", margin, 59);

  autoTable(document, {
    startY: 63,
    margin: { left: margin, right: margin, bottom: 14 },
    head: [
      [
        "Estudiante",
        "Correo",
        "Carrera",
        "Intentos",
        "Promedio",
        "Mejor",
        "Última actividad",
      ],
    ],
    body:
      students.length > 0
        ? students.map((student) => [
            student.fullName,
            student.email,
            student.careerLabel,
            student.simulationsCount,
            formatPercentage(student.averageScore),
            formatPercentage(student.bestScore),
            formatDate(student.lastActivity),
          ])
        : [["No hay estudiantes disponibles", "", "", "", "", "", ""]],
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
      valign: "middle",
    },
    headStyles: {
      fillColor: blue,
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 48 },
      1: { cellWidth: 66 },
      2: { cellWidth: 32 },
      3: { cellWidth: 20, halign: "right" },
      4: { cellWidth: 24, halign: "right" },
      5: { cellWidth: 24, halign: "right" },
      6: { cellWidth: 47 },
    },
  });

  const documentWithTable = document as typeof document & {
    lastAutoTable?: { finalY?: number };
  };

  function prepareSection(title: string, minimumSpace = 28) {
    let y = (documentWithTable.lastAutoTable?.finalY ?? 20) + 9;

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
    startY: prepareSection("Rendimiento por módulo"),
    margin: { left: margin, right: margin, bottom: 14 },
    head: [
      ["Módulo", "Respuestas", "Correctas", "Incorrectas", "Tasa de error"],
    ],
    body:
      modules.length > 0
        ? modules.map((module) => [
            module.category,
            module.total,
            module.correct,
            module.incorrect,
            formatPercentage(module.errorRate),
          ])
        : [["No hay respuestas registradas", 0, 0, 0, formatPercentage(0)]],
    theme: "grid",
    showHead: "everyPage",
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 2.2,
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
      0: { cellWidth: 175 },
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
    },
  });

  autoTable(document, {
    startY: prepareSection("Preguntas con mayor dificultad", 60),
    margin: { left: margin, right: margin, bottom: 14 },
    head: [
      ["Pregunta", "Módulo", "Respuestas", "Errores", "Tasa de error"],
    ],
    body:
      questions.length > 0
        ? questions.map((question) => [
            question.text,
            question.category,
            question.total,
            question.incorrect,
            formatPercentage(question.errorRate),
          ])
        : [["No hay respuestas registradas", "", 0, 0, formatPercentage(0)]],
    theme: "grid",
    showHead: "everyPage",
    rowPageBreak: "avoid",
    styles: {
      font: "helvetica",
      fontSize: 7.5,
      cellPadding: 2.2,
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
      0: { cellWidth: 105 },
      1: { cellWidth: 100 },
      2: { cellWidth: 22, halign: "right" },
      3: { cellWidth: 18, halign: "right" },
      4: { cellWidth: 25, halign: "right" },
    },
  });

  const totalPages = document.getNumberOfPages();

  for (let page = 1; page <= totalPages; page += 1) {
    document.setPage(page);
    document.setDrawColor(226, 232, 240);
    document.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);
    document.setTextColor(...slate);
    document.setFont("helvetica", "normal");
    document.setFontSize(7);
    document.text("CACES Simulador - Reporte docente", margin, pageHeight - 5.5);
    document.text(
      `Página ${page} de ${totalPages}`,
      pageWidth - margin,
      pageHeight - 5.5,
      { align: "right" },
    );
  }

  return document.output("arraybuffer");
}

export function getTeacherAnalyticsReportFilename(date = new Date()) {
  const datePart = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");

  return `reporte-docente-caces-${datePart}.pdf`;
}
