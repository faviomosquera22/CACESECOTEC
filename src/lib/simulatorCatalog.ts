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
      "100 preguntas y temporizador de 120 minutos.",
    ],
    categoryKeywords: ["enfermeria", "enfermería", "nursing"],
    icon: Stethoscope,
  },
  {
    slug: "psicologia",
    title: "Simulador Psicología",
    shortTitle: "Psicología",
    description:
      "Práctica enfocada en evaluación psicológica, intervención, ética profesional, psicopatología y análisis de casos aplicados.",
    structure: [
      "Intervenciones clínicas, evaluación, psicopatología, ética y abordaje psicosocial.",
      "Preguntas de opción múltiple con una sola respuesta correcta.",
      "100 preguntas distribuidas según la ponderación del banco de Psicología Clínica.",
    ],
    categoryKeywords: ["psicologia", "psicología", "psychology", "clinica"],
    icon: Brain,
  },
];

export function getSimulatorExam(slug: string) {
  return simulatorExams.find((exam) => exam.slug === slug);
}
