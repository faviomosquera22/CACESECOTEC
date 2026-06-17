"use client";

import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import type {
  OptionLetter,
  Question,
  SimulationAnswerWithQuestion,
} from "@/lib/database.types";

type ResultReviewListProps = {
  answers: SimulationAnswerWithQuestion[];
};

function getOptionText(question: Question | null, option?: OptionLetter | null) {
  if (!question || !option) {
    return "Sin responder";
  }

  const optionText = {
    A: question.option_a,
    B: question.option_b,
    C: question.option_c,
    D: question.option_d,
  }[option];

  return `${option}. ${optionText}`;
}

function punctuate(sentence: string) {
  const trimmedSentence = sentence.trim();

  if (/[.!?]$/.test(trimmedSentence)) {
    return trimmedSentence;
  }

  return `${trimmedSentence}.`;
}

function ReviewCard({
  answer,
  questionNumber,
}: {
  answer: SimulationAnswerWithQuestion;
  questionNumber: number;
}) {
  const question = answer.questions;
  const isCorrect = answer.is_correct === true;
  const selectedOption = answer.selected_option;
  const correctOption = question?.correct_option ?? null;
  const selectedText = getOptionText(question, selectedOption);
  const correctText = getOptionText(question, correctOption);
  const explanation = question?.explanation?.trim();

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h4 className="text-base font-semibold leading-7 text-slate-950">
          {questionNumber}. {question?.question_text ?? "Pregunta no disponible"}
        </h4>
        <span
          className={`inline-flex w-fit items-center gap-2 rounded-lg px-3 py-1 text-sm font-semibold ${
            isCorrect
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {isCorrect ? (
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          ) : (
            <XCircle className="h-4 w-4" aria-hidden="true" />
          )}
          {isCorrect ? "Correcta" : "Incorrecta"}
        </span>
      </div>

      <dl className="mt-5 grid gap-3 text-sm md:grid-cols-2">
        <div className="rounded-lg bg-slate-50 p-4">
          <dt className="font-semibold text-slate-500">
            Respuesta seleccionada
          </dt>
          <dd className="mt-1 leading-6 text-slate-950">{selectedText}</dd>
        </div>
        <div className="rounded-lg bg-slate-50 p-4">
          <dt className="font-semibold text-slate-500">Respuesta correcta</dt>
          <dd className="mt-1 leading-6 text-slate-950">{correctText}</dd>
        </div>
      </dl>

      <div
        className={`mt-4 rounded-lg border p-4 text-sm leading-6 ${
          isCorrect
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-red-200 bg-red-50 text-red-800"
        }`}
      >
        <p className="font-semibold">
          {isCorrect ? "Feedback" : "Por qué estuvo incorrecta"}
        </p>
        <p className="mt-2">
          {isCorrect
            ? punctuate(
                `Correcto. La opción marcada por el banco es ${correctText}`,
              )
            : selectedOption
              ? `${punctuate(
                  `La opción correcta marcada por el banco es ${correctText}`,
                )} ${punctuate(`Tu selección fue ${selectedText}`)}`
              : punctuate(
                  `No seleccionaste respuesta. La opción correcta marcada por el banco es ${correctText}`,
                )}
        </p>
        <div className="mt-3 rounded-lg bg-white/75 p-3 text-slate-800">
          <p className="font-semibold">Por qué esta respuesta es correcta</p>
          <p className="mt-1">
            {explanation
              ? explanation
              : punctuate(
                  `El banco marca ${correctText} como respuesta correcta para esta pregunta`,
                )}
          </p>
        </div>
      </div>
    </article>
  );
}

type ReviewFilter = "incorrect" | "correct";

export function ResultReviewList({ answers }: ResultReviewListProps) {
  const incorrectAnswers = answers.filter((answer) => answer.is_correct !== true);
  const correctAnswers = answers.filter((answer) => answer.is_correct === true);
  const [activeFilter, setActiveFilter] = useState<ReviewFilter>(
    incorrectAnswers.length > 0 ? "incorrect" : "correct",
  );
  const visibleAnswers =
    activeFilter === "incorrect" ? incorrectAnswers : correctAnswers;
  const emptyMessage =
    activeFilter === "incorrect"
      ? "No tuviste preguntas incorrectas."
      : "No tuviste preguntas correctas.";
  const title =
    activeFilter === "incorrect"
      ? `Preguntas incorrectas (${incorrectAnswers.length})`
      : `Preguntas correctas (${correctAnswers.length})`;

  const questionNumbers = new Map(
    answers.map((answer, index) => [answer.id, index + 1]),
  );

  const filterOptions: {
    key: ReviewFilter;
    label: string;
    count: number;
    icon: typeof XCircle;
    activeClassName: string;
    inactiveClassName: string;
  }[] = [
    {
      key: "incorrect",
      label: "Incorrectas",
      count: incorrectAnswers.length,
      icon: XCircle,
      activeClassName: "border-red-200 bg-red-50 text-red-700",
      inactiveClassName: "border-slate-200 bg-white text-slate-600",
    },
    {
      key: "correct",
      label: "Correctas",
      count: correctAnswers.length,
      icon: CheckCircle2,
      activeClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
      inactiveClassName: "border-slate-200 bg-white text-slate-600",
    },
  ];

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xl font-semibold tracking-normal text-slate-950">
            Revisión de respuestas
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Selecciona un grupo para revisar solo esas preguntas.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {filterOptions.map((option) => {
            const Icon = option.icon;
            const isActive = activeFilter === option.key;

            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setActiveFilter(option.key)}
                aria-pressed={isActive}
                className={`inline-flex h-12 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition hover:bg-slate-50 ${
                  isActive ? option.activeClassName : option.inactiveClassName
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {option.label}
                <span className="rounded-lg bg-white/80 px-2 py-0.5 text-base text-slate-950">
                  {option.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h4 className="mb-4 text-lg font-semibold tracking-normal text-slate-950">
          {title}
        </h4>
        {visibleAnswers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
            {emptyMessage}
          </div>
        ) : (
          <div className="space-y-4">
            {visibleAnswers.map((answer) => (
              <ReviewCard
                key={answer.id}
                answer={answer}
                questionNumber={questionNumbers.get(answer.id) ?? 0}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
