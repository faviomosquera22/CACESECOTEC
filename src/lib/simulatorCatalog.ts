import type { LucideIcon } from "lucide-react";
import { Brain, Stethoscope } from "lucide-react";

export type SimulatorExamType = "enfermeria" | "psicologia";

export type SimulatorExamConfig = {
  slug: SimulatorExamType;
  title: string;
  shortTitle: string;
  description: string;
  structure: string[];
  categoryKeywords: string[];
  icon: LucideIcon;
};

export const simulatorExams: SimulatorExamConfig[] = [
  {
    slug: "enfermeria",
    title: "Simulador Enfermería",
    shortTitle: "Enfermería",
    description:
      "Práctica orientada a valorar razonamiento clínico, cuidado integral, seguridad del paciente y toma de decisiones en escenarios frecuentes de enfermería.",
    structure: [
      "Cuidado del adulto, materno infantil, salud comunitaria y fundamentos profesionales.",
      "Preguntas de opción múltiple con una sola respuesta correcta.",
      "100 preguntas y temporizador de 90 minutos.",
    ],
    categoryKeywords: ["enfermeria", "enfermería", "nursing"],
    icon: Stethoscope,
  },
  {
    slug: "psicologia",
    title: "Simulador Psicología",
    shortTitle: "Psicología",
    description:
      "Práctica con una selección rotativa del banco de Psicología según los componentes habilitados por tu docente.",
    structure: [
      "Cinco componentes de Psicología Clínica organizados en 12 subcomponentes.",
      "Preguntas de opción múltiple con una sola respuesta correcta.",
      "Hasta 100 preguntas según los componentes activos, con temporizador de 90 minutos.",
    ],
    categoryKeywords: ["psicologia", "psicología", "psychology", "clinica"],
    icon: Brain,
  },
];

export function getSimulatorExam(slug: string) {
  return simulatorExams.find((exam) => exam.slug === slug);
}
