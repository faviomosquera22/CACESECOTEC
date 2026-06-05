"use client";

import type { OptionLetter, Question } from "@/lib/database.types";

type SimulationQuestionProps = {
  question: Question;
  selectedOption?: OptionLetter;
  onSelect: (option: OptionLetter) => void;
};

const optionKeys: OptionLetter[] = ["A", "B", "C", "D"];

export function SimulationQuestion({
  question,
  selectedOption,
  onSelect,
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
        {question.category ? (
          <span className="rounded-lg bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">
            {question.category}
          </span>
        ) : null}
        {question.difficulty ? (
          <span className="rounded-lg bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
            {question.difficulty}
          </span>
        ) : null}
      </div>

      <h2 className="mt-5 text-xl font-semibold leading-8 text-slate-950">
        {question.question_text}
      </h2>

      <div className="mt-6 grid gap-3">
        {optionKeys.map((option) => {
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
              <span className="pt-1 text-sm leading-6">{options[option]}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
