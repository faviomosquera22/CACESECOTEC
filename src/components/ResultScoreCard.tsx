import { CheckCircle2, CircleMinus, Clock3, Trophy, XCircle } from "lucide-react";
import type {
  Simulation,
  SimulationAnswerWithQuestion,
} from "@/lib/database.types";
import { formatDate, formatDuration, formatScore } from "@/lib/format";

type ResultScoreCardProps = {
  simulation: Simulation;
  answers?: SimulationAnswerWithQuestion[];
  note?: string;
};

function getScoreTone(score: number) {
  if (score >= 70) {
    return {
      text: "text-emerald-700",
      bar: "bg-emerald-500",
      label: "Buen desempeño",
    };
  }

  if (score >= 50) {
    return {
      text: "text-sky-700",
      bar: "bg-sky-500",
      label: "En progreso",
    };
  }

  return {
    text: "text-red-700",
    bar: "bg-red-500",
    label: "Necesita refuerzo",
  };
}

function getAnswerCounts(
  simulation: Simulation,
  answers?: SimulationAnswerWithQuestion[],
) {
  const total = simulation.total_questions ?? answers?.length ?? 0;

  if (answers && answers.length > 0) {
    const correct = answers.filter((answer) => answer.is_correct === true)
      .length;
    const unanswered = answers.filter((answer) => !answer.selected_option)
      .length;
    const incorrect = answers.filter(
      (answer) => answer.selected_option && answer.is_correct !== true,
    ).length;

    return { correct, incorrect, unanswered, total };
  }

  const correct = simulation.correct_answers ?? 0;
  const incorrect = simulation.incorrect_answers ?? 0;
  const unanswered = Math.max(0, total - correct - incorrect);

  return { correct, incorrect, unanswered, total };
}

export function ResultScoreCard({
  simulation,
  answers,
  note,
}: ResultScoreCardProps) {
  const score = simulation.score ?? 0;
  const counts = getAnswerCounts(simulation, answers);
  const scoreTone = getScoreTone(score);
  const progressWidth = Math.min(100, Math.max(0, score));

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-sky-700">
            Resultado de la simulación
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-2">
            <h2
              className={`text-5xl font-semibold tracking-normal ${scoreTone.text}`}
            >
              {formatScore(score)}
            </h2>
            <span className="mb-2 inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
              <Trophy className="h-4 w-4" aria-hidden="true" />
              {scoreTone.label}
            </span>
          </div>
        </div>
        <p className="text-sm leading-6 text-slate-500">
          Finalizada el{" "}
          <span className="font-semibold text-slate-700">
            {formatDate(simulation.finished_at ?? simulation.created_at)}
          </span>
        </p>
      </div>

      <div className="mt-6 h-3 overflow-hidden rounded-lg bg-slate-100">
        <div
          className={`h-full rounded-lg ${scoreTone.bar}`}
          style={{ width: `${progressWidth}%` }}
        />
      </div>

      <dl className="mt-6 grid gap-5 border-t border-slate-100 pt-5 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <dt className="flex items-center gap-2 text-sm font-semibold text-slate-500">
            <CheckCircle2
              className="h-4 w-4 text-emerald-600"
              aria-hidden="true"
            />
            Correctas
          </dt>
          <dd className="mt-2 text-2xl font-semibold text-slate-950">
            {counts.correct}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-2 text-sm font-semibold text-slate-500">
            <XCircle className="h-4 w-4 text-red-600" aria-hidden="true" />
            Incorrectas
          </dt>
          <dd className="mt-2 text-2xl font-semibold text-slate-950">
            {counts.incorrect}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-2 text-sm font-semibold text-slate-500">
            <CircleMinus className="h-4 w-4 text-amber-600" aria-hidden="true" />
            No respondidas
          </dt>
          <dd className="mt-2 text-2xl font-semibold text-slate-950">
            {counts.unanswered}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-semibold text-slate-500">
            Total de preguntas
          </dt>
          <dd className="mt-2 text-2xl font-semibold text-slate-950">
            {counts.total}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-2 text-sm font-semibold text-slate-500">
            <Clock3 className="h-4 w-4 text-sky-600" aria-hidden="true" />
            Tiempo utilizado
          </dt>
          <dd className="mt-2 text-2xl font-semibold text-slate-950">
            {formatDuration(simulation.time_used_seconds)}
          </dd>
        </div>
      </dl>

      {note ? (
        <p className="mt-5 border-t border-slate-100 pt-4 text-sm leading-6 text-slate-500">
          {note}
        </p>
      ) : null}
    </section>
  );
}
