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
  index,
}: {
  answer: SimulationAnswerWithQuestion;
  index: number;
}) {
  const question = answer.questions;
  const isCorrect = answer.is_correct === true;
  const selectedOption = answer.selected_option;
  const correctOption = question?.correct_option ?? null;
  const selectedText = getOptionText(question, selectedOption);
  const correctText = getOptionText(question, correctOption);

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h4 className="text-base font-semibold leading-7 text-slate-950">
          {index + 1}. {question?.question_text ?? "Pregunta no disponible"}
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
        {question?.explanation ? (
          <p className="mt-2 text-slate-700">{question.explanation}</p>
        ) : null}
      </div>
    </article>
  );
}

function ReviewSection({
  title,
  answers,
  emptyMessage,
}: {
  title: string;
  answers: SimulationAnswerWithQuestion[];
  emptyMessage: string;
}) {
  return (
    <section>
      <h3 className="mb-4 text-xl font-semibold tracking-normal text-slate-950">
        {title}
      </h3>
      {answers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-4">
          {answers.map((answer, index) => (
            <ReviewCard key={answer.id} answer={answer} index={index} />
          ))}
        </div>
      )}
    </section>
  );
}

export function ResultReviewList({ answers }: ResultReviewListProps) {
  const incorrectAnswers = answers.filter((answer) => answer.is_correct !== true);
  const correctAnswers = answers.filter((answer) => answer.is_correct === true);

  return (
    <div className="space-y-8">
      <ReviewSection
        title={`Preguntas incorrectas (${incorrectAnswers.length})`}
        answers={incorrectAnswers}
        emptyMessage="No tuviste preguntas incorrectas."
      />
      <ReviewSection
        title={`Preguntas correctas (${correctAnswers.length})`}
        answers={correctAnswers}
        emptyMessage="No tuviste preguntas correctas."
      />
    </div>
  );
}
