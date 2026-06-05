"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import type { OptionLetter, Question } from "@/lib/database.types";
import { writeLocalSimulationSummary } from "@/lib/localSimulationStorage";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { SimulationQuestion } from "@/components/SimulationQuestion";

type SimulatorClientProps = {
  questions: Question[];
  studentId: string;
  persistenceMode?: "supabase" | "local";
};

const SIMULATION_SECONDS = 60 * 60;

function formatTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
    .toString()
    .padStart(2, "0")}`;
}

export function SimulatorClient({
  questions,
  studentId,
  persistenceMode = "supabase",
}: SimulatorClientProps) {
  const router = useRouter();
  const startedAtRef = useRef(new Date());
  const finishedRef = useRef(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Partial<Record<string, OptionLetter>>>(
    {},
  );
  const [timeLeft, setTimeLeft] = useState(SIMULATION_SECONDS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const currentQuestion = questions[currentIndex];
  const selectedCount = questions.filter((question) => answers[question.id])
    .length;
  const allAnswered = selectedCount === questions.length;
  const progressPercentage = ((currentIndex + 1) / questions.length) * 100;

  const finishSimulation = useCallback(async () => {
    if (finishedRef.current || isSubmitting) {
      return;
    }

    finishedRef.current = true;
    setIsSubmitting(true);
    setError("");

    try {
      const finishedAt = new Date();
      const totalQuestions = questions.length;
      const correctAnswers = questions.reduce((total, question) => {
        return total + (answers[question.id] === question.correct_option ? 1 : 0);
      }, 0);
      const incorrectAnswers = totalQuestions - correctAnswers;
      const score =
        totalQuestions > 0
          ? Math.round((correctAnswers / totalQuestions) * 10000) / 100
          : 0;
      const timeUsedSeconds = Math.max(0, SIMULATION_SECONDS - timeLeft);

      if (persistenceMode === "local") {
        const simulationId = `local-${Date.now()}`;
        const localSimulation = {
          id: simulationId,
          student_id: studentId,
          started_at: startedAtRef.current.toISOString(),
          finished_at: finishedAt.toISOString(),
          total_questions: totalQuestions,
          correct_answers: correctAnswers,
          incorrect_answers: incorrectAnswers,
          score,
          time_used_seconds: timeUsedSeconds,
          status: "finished",
          created_at: finishedAt.toISOString(),
        };
        const localAnswers = questions.map((question) => {
          const selectedOption = answers[question.id] ?? null;

          return {
            id: `${simulationId}-${question.id}`,
            simulation_id: simulationId,
            question_id: question.id,
            selected_option: selectedOption,
            is_correct: selectedOption === question.correct_option,
            answered_at: finishedAt.toISOString(),
            questions: question,
          };
        });

        window.localStorage.setItem(
          `local-simulation:${simulationId}`,
          JSON.stringify({
            simulation: localSimulation,
            answers: localAnswers,
          }),
        );
        writeLocalSimulationSummary(studentId, localSimulation);

        router.push(`/student/results/${simulationId}`);
        return;
      }

      const supabase = getSupabaseBrowserClient();

      const { data: simulation, error: simulationError } = await supabase
        .from("simulations")
        .insert({
          student_id: studentId,
          started_at: startedAtRef.current.toISOString(),
          finished_at: finishedAt.toISOString(),
          total_questions: totalQuestions,
          correct_answers: correctAnswers,
          incorrect_answers: incorrectAnswers,
          score,
          time_used_seconds: timeUsedSeconds,
          status: "finished",
        })
        .select("id")
        .single();

      if (simulationError || !simulation) {
        throw new Error("No se pudo guardar la simulación.");
      }

      const answerRows = questions.map((question) => {
        const selectedOption = answers[question.id] ?? null;

        return {
          simulation_id: simulation.id,
          question_id: question.id,
          selected_option: selectedOption,
          is_correct: selectedOption === question.correct_option,
          answered_at: finishedAt.toISOString(),
        };
      });

      const { error: answersError } = await supabase
        .from("simulation_answers")
        .insert(answerRows);

      if (answersError) {
        throw new Error("No se pudieron guardar las respuestas.");
      }

      router.push(`/student/results/${simulation.id}`);
      router.refresh();
    } catch (caughtError) {
      finishedRef.current = false;
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "No se pudo finalizar la simulación.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    answers,
    isSubmitting,
    persistenceMode,
    questions,
    router,
    studentId,
    timeLeft,
  ]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTimeLeft((currentTime) => Math.max(0, currentTime - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (timeLeft === 0) {
      void finishSimulation();
    }
  }, [finishSimulation, timeLeft]);

  useEffect(() => {
    if (!allAnswered || isSubmitting || finishedRef.current) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void finishSimulation();
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [allAnswered, finishSimulation, isSubmitting]);

  const answeredLabel = useMemo(
    () => `${selectedCount} de ${questions.length} respondidas`,
    [questions.length, selectedCount],
  );

  function selectAnswer(option: OptionLetter) {
    setAnswers((currentAnswers) => ({
      ...currentAnswers,
      [currentQuestion.id]: option,
    }));
  }

  function goToPrevious() {
    setCurrentIndex((index) => Math.max(0, index - 1));
  }

  function goToNext() {
    setCurrentIndex((index) => Math.min(questions.length - 1, index + 1));
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500">
              Pregunta {currentIndex + 1} de {questions.length}
            </p>
            <p className="mt-2 text-sm text-slate-600">{answeredLabel}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-slate-950 px-4 py-2 text-lg font-semibold tabular-nums text-white">
              {formatTimer(timeLeft)}
            </div>
            <button
              type="button"
              onClick={() => void finishSimulation()}
              disabled={isSubmitting || allAnswered}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              {isSubmitting || allAnswered
                ? "Finalizando..."
                : "Finalizar simulación"}
            </button>
          </div>
        </div>

        <div className="mt-5 h-2 overflow-hidden rounded-lg bg-slate-100">
          <div
            className="h-full rounded-lg bg-sky-500 transition-all"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </section>

      {error ? (
        <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{error}</p>
        </div>
      ) : null}

      <SimulationQuestion
        question={currentQuestion}
        selectedOption={answers[currentQuestion.id]}
        onSelect={selectAnswer}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={goToPrevious}
          disabled={currentIndex === 0 || isSubmitting}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Anterior
        </button>
        <button
          type="button"
          onClick={goToNext}
          disabled={
            currentIndex === questions.length - 1 || isSubmitting || allAnswered
          }
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Siguiente
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
