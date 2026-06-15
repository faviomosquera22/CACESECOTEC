"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  ListChecks,
  X,
} from "lucide-react";
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

function getTimeAlert(seconds: number) {
  if (seconds <= 60) {
    return {
      tone: "border-red-200 bg-red-50 text-red-800",
      message: "Queda 1 minuto. Finaliza con calma y revisa lo esencial.",
    };
  }

  if (seconds <= 5 * 60) {
    return {
      tone: "border-amber-200 bg-amber-50 text-amber-800",
      message: "Quedan 5 minutos. Prioriza las preguntas pendientes.",
    };
  }

  if (seconds <= 10 * 60) {
    return {
      tone: "border-sky-200 bg-sky-50 text-sky-800",
      message: "Quedan 10 minutos. Revisa tu avance antes de continuar.",
    };
  }

  return null;
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
  const [showFinishDialog, setShowFinishDialog] = useState(false);

  const currentQuestion = questions[currentIndex];
  const selectedCount = questions.filter((question) => answers[question.id])
    .length;
  const unansweredCount = questions.length - selectedCount;
  const allAnswered = selectedCount === questions.length;
  const progressPercentage = ((currentIndex + 1) / questions.length) * 100;
  const timeAlert = getTimeAlert(timeLeft);

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

  function requestFinishSimulation() {
    setShowFinishDialog(true);
  }

  function confirmFinishSimulation() {
    setShowFinishDialog(false);
    void finishSimulation();
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
              onClick={requestFinishSimulation}
              disabled={isSubmitting}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              {isSubmitting ? "Finalizando..." : "Finalizar simulación"}
            </button>
          </div>
        </div>

        <div className="mt-5 h-2 overflow-hidden rounded-lg bg-slate-100">
          <div
            className="h-full rounded-lg bg-sky-500 transition-all"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        {timeAlert ? (
          <div
            className={`mt-4 flex items-start gap-3 rounded-lg border p-3 text-sm ${timeAlert.tone}`}
          >
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            <p>{timeAlert.message}</p>
          </div>
        ) : null}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-6">
          {error ? (
            <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
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
              disabled={currentIndex === questions.length - 1 || isSubmitting}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Siguiente
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <aside className="h-fit rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-sky-700" aria-hidden="true" />
            <h3 className="text-base font-semibold text-slate-950">
              Mapa de preguntas
            </h3>
          </div>
          <div className="mt-4 grid grid-cols-5 gap-2">
            {questions.map((question, index) => {
              const isCurrent = index === currentIndex;
              const isAnswered = Boolean(answers[question.id]);

              return (
                <button
                  key={question.id}
                  type="button"
                  onClick={() => setCurrentIndex(index)}
                  disabled={isSubmitting}
                  aria-label={`Ir a la pregunta ${index + 1}`}
                  className={`flex aspect-square min-h-10 items-center justify-center rounded-lg border text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    isCurrent
                      ? "border-slate-950 bg-slate-950 text-white"
                      : isAnswered
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300"
                        : "border-slate-200 bg-white text-slate-500 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
                  }`}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-emerald-50 p-3 text-emerald-800">
              <dt className="font-semibold">Respondidas</dt>
              <dd className="mt-1 text-xl font-semibold">{selectedCount}</dd>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 text-slate-700">
              <dt className="font-semibold">Pendientes</dt>
              <dd className="mt-1 text-xl font-semibold">{unansweredCount}</dd>
            </div>
          </dl>
        </aside>
      </div>

      {showFinishDialog ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 px-4 py-6 backdrop-blur-sm">
          <div
            aria-modal="true"
            className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-5 shadow-2xl"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 ring-1 ring-amber-100">
                  <Clock3 className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">
                    Finalizar simulación
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {allAnswered
                      ? "Todas las preguntas tienen respuesta. Puedes finalizar cuando estés listo."
                      : `Tienes ${unansweredCount} preguntas sin responder. Si finalizas ahora, quedarán como incorrectas.`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFinishDialog(false)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                aria-label="Cerrar confirmación"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowFinishDialog(false)}
                className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Seguir revisando
              </button>
              <button
                type="button"
                onClick={confirmFinishSimulation}
                disabled={isSubmitting}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Confirmar finalización
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
