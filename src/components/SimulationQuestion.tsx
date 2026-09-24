"use client";

import Image from "next/image";
import type { OptionLetter, Question } from "@/lib/database.types";

type SimulationQuestionProps = {
  question: Question;
  selectedOption?: OptionLetter;
  onSelect: (option: OptionLetter) => void;
  writtenAnswer?: string;
  onWrite?: (value: string) => void;
  onConfirmWritten?: () => void;
  disabled?: boolean;
};

const optionKeys: OptionLetter[] = ["A", "B", "C", "D"];

export function SimulationQuestion({
  question,
  selectedOption,
  onSelect,
  writtenAnswer = "",
  onWrite,
  onConfirmWritten,
  disabled = false,
}: SimulationQuestionProps) {
  const options: Record<OptionLetter, string> = {
    A: question.option_a,
    B: question.option_b,
    C: question.option_c,
    D: question.option_d,
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap gap-2">
        {question.component ? (
          <span className="rounded-lg bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">
            Componente: {question.component}
          </span>
        ) : null}
        {question.subcomponent ? (
          <span className="rounded-lg bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
            Subcomponente: {question.subcomponent}
          </span>
        ) : null}
        {!question.component && !question.subcomponent && question.category ? (
          <span className="rounded-lg bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">
            {question.category}
          </span>
        ) : null}
      </div>

      <h2 className="mt-5 text-xl font-semibold leading-8 text-slate-950">
        {question.question_text}
      </h2>

      {question.image_url ? (
        <figure className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-3">
          <Image
            src={question.image_url}
            alt={question.image_alt ?? "Recurso gráfico de la pregunta"}
            width={question.image_width ?? 960}
            height={question.image_height ?? 640}
            sizes="(max-width: 768px) 100vw, 800px"
            className="mx-auto h-auto max-h-[34rem] w-full object-contain"
          />
        </figure>
      ) : null}

      {question.source_format === "answer-only" ? (
        <form className="mt-6 grid gap-3" onSubmit={(event) => {
          event.preventDefault();
          if (!disabled && !selectedOption && writtenAnswer.trim()) onConfirmWritten?.();
        }}>
          <label htmlFor={`written-${question.id}`} className="font-semibold text-slate-800">Tu respuesta</label>
          <input id={`written-${question.id}`} type="text" value={writtenAnswer}
            onChange={(event) => onWrite?.(event.target.value)} maxLength={500}
            disabled={disabled || Boolean(selectedOption)} autoComplete="off"
            placeholder="Escribe tu respuesta"
            className="rounded-lg border border-slate-300 px-4 py-3 text-slate-950 disabled:bg-slate-100" />
          <p className="text-sm text-slate-600">Confirma tu respuesta para guardarla como respondida. Después no podrás modificarla.</p>
          <button type="submit" disabled={disabled || Boolean(selectedOption) || !writtenAnswer.trim()}
            className="rounded-lg bg-sky-700 px-4 py-3 font-semibold text-white disabled:opacity-50">
            {selectedOption ? "Respuesta confirmada" : "Confirmar respuesta"}
          </button>
        </form>
      ) : <div className="mt-6 grid gap-3">
        {optionKeys.filter((option) => options[option]?.trim()).map((option) => {
          const isSelected = selectedOption === option;

          return (
            <button
              key={option}
              type="button"
              aria-label={`Opción ${option}: ${options[option]}`}
              data-option={option}
              onClick={() => onSelect(option)}
              className={`flex min-h-14 w-full items-start gap-4 rounded-lg border px-4 py-3 text-left transition ${
                isSelected
                  ? "border-sky-400 bg-sky-50 text-sky-950 shadow-sm"
                  : "border-slate-200 bg-white text-slate-700 hover:border-sky-200 hover:bg-sky-50"
              }`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold ${
                  isSelected
                    ? "bg-sky-700 text-white"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {option}
              </span>
              <span className="pt-1 text-sm leading-6">
                {options[option]}
              </span>
            </button>
          );
        })}
      </div>}
    </section>
  );
}
