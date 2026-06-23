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

function isGenericImportedExplanation(explanation?: string | null) {
  if (!explanation) {
    return true;
  }

  return (
    /respuesta importada del banco caces/i.test(explanation) ||
    /los distractores son menos adecuados porque omiten evaluaci[oó]n, encuadre, evidencia, seguridad o pertinencia cl[ií]nica/i.test(
      explanation,
    )
  );
}

function getCaseEvidence(question: Question | null) {
  const questionText = question?.question_text
    .replace(/\s+/g, " ")
    .trim();

  if (!questionText) {
    return null;
  }

  // En los casos clínicos, la última pregunta suele empezar con "¿". Todo lo
  // anterior contiene los signos, síntomas o antecedentes que sustentan la respuesta.
  const lastQuestionStart = questionText.lastIndexOf("¿");
  const evidence =
    lastQuestionStart > 0
      ? questionText.slice(0, lastQuestionStart).trim()
      : questionText;

  return evidence || null;
}

function getLogicalReason(question: Question | null, correctText: string) {
  const questionText = question?.question_text ?? "";
  const normalizedQuestion = questionText.toLowerCase();

  if (
    /\b(excepto|incorrecta|incorrecto|no debería|no corresponde)\b/.test(
      normalizedQuestion,
    )
  ) {
    return `La opción ${correctText} es correcta porque el enunciado pide identificar la excepción o la alternativa que no corresponde al criterio evaluado`;
  }

  if (/\bprioritari[oa]\b/.test(normalizedQuestion)) {
    return `La opción ${correctText} es correcta porque atiende primero el problema de mayor riesgo o la necesidad más urgente descrita en el caso`;
  }

  if (/\bdiagn[oó]stico\b/.test(normalizedQuestion)) {
    return `La opción ${correctText} es correcta porque coincide con los signos, síntomas y datos clínicos descritos en el enunciado`;
  }

  if (
    /\b(intervenci[oó]n|cuidado|actividad|acci[oó]n|procedimiento)\b/.test(
      normalizedQuestion,
    )
  ) {
    return `La opción ${correctText} es correcta porque es la acción que responde de forma directa a la necesidad, fase o procedimiento solicitado en el caso`;
  }

  if (/\b(complete|completa|llenado|enunciado)\b/.test(normalizedQuestion)) {
    return `La opción ${correctText} es correcta porque completa el enunciado de manera coherente con el concepto evaluado`;
  }

  if (
    /\b(dispositivo|ox[ií]geno|litros|fio2|saturaci[oó]n)\b/.test(
      normalizedQuestion,
    )
  ) {
    return `La opción ${correctText} es correcta porque corresponde al criterio técnico solicitado por los datos respiratorios del caso`;
  }

  if (
    /\b(concepto|definici[oó]n|m[eé]todo|clasificaci[oó]n)\b/.test(
      normalizedQuestion,
    )
  ) {
    return `La opción ${correctText} es correcta porque corresponde al concepto específico que el enunciado pide identificar`;
  }

  return `La opción ${correctText} es correcta porque responde directamente al criterio central planteado en el enunciado`;
}

function getSelectedContrast(
  question: Question | null,
  selectedOption: OptionLetter | null,
  correctOption: OptionLetter | null,
) {
  if (!selectedOption) {
    return "Al no marcar una alternativa, la pregunta queda como incorrecta.";
  }

  if (selectedOption === correctOption) {
    return "";
  }

  const selectedText = getOptionText(question, selectedOption);

  return `Tu selección (${selectedText}) no cumple ese mismo criterio del enunciado.`;
}

function getIncorrectReason(
  question: Question | null,
  selectedOption: OptionLetter | null,
  correctOption: OptionLetter | null,
) {
  const correctText = getOptionText(question, correctOption);

  if (!selectedOption) {
    return `No marcaste una alternativa. Los datos del enunciado sustentan ${correctText}, por eso esa era la respuesta que debías seleccionar.`;
  }

  const selectedText = getOptionText(question, selectedOption);
  const evidence = getCaseEvidence(question);

  return [
    `La opción ${selectedText} es incorrecta porque no corresponde a los datos que plantea el enunciado.`,
    evidence
      ? `El dato que determina la respuesta es: “${evidence}”.`
      : null,
    `Esos datos sustentan ${correctText}; por eso no corresponde seleccionar ${selectedText}.`,
  ]
    .filter(Boolean)
    .join(" ");
}

function getAnswerExplanation(
  question: Question | null,
  selectedOption: OptionLetter | null,
  correctOption: OptionLetter | null,
) {
  const explanation = question?.explanation?.trim();

  if (explanation && !isGenericImportedExplanation(explanation)) {
    return punctuate(explanation);
  }

  const correctText = getOptionText(question, correctOption);
  const logicalReason = punctuate(getLogicalReason(question, correctText));
  const selectedContrast = getSelectedContrast(
    question,
    selectedOption,
    correctOption,
  );

  return selectedContrast
    ? `${logicalReason} ${punctuate(selectedContrast)}`
    : logicalReason;
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
  const explanation = getAnswerExplanation(
    question,
    selectedOption,
    correctOption,
  );
  const incorrectReason = getIncorrectReason(
    question,
    selectedOption,
    correctOption,
  );

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
        {isCorrect ? (
          <div className="mt-3 rounded-lg bg-white/75 p-3 text-slate-800">
            <p className="font-semibold">Fundamento</p>
            <p className="mt-1">{explanation}</p>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="rounded-lg bg-white/75 p-3 text-slate-800">
              <p className="font-semibold">Por qué tu respuesta no aplica</p>
              <p className="mt-1">{incorrectReason}</p>
            </div>
            <div className="rounded-lg bg-white/75 p-3 text-slate-800">
              <p className="font-semibold">Por qué la correcta sí aplica</p>
              <p className="mt-1">{explanation}</p>
            </div>
          </div>
        )}
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
