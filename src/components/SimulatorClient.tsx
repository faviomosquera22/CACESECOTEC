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
  MessageSquare,
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
  draftStorageKey?: string;
};

const OLD_SIMULATION_SECONDS = 60 * 60;
const SIMULATION_SECONDS = 120 * 60;
const DRAFT_VERSION = 2;

type SimulationDraft = {
  version: number;
  answers: Partial<Record<string, OptionLetter>>;
  comments: Record<string, string>;
  currentIndex: number;
  timeLeft: number;
  simulationSeconds?: number;
  startedAt: string;
  updatedAt: string;
};

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
  draftStorageKey = `simulation-draft:${studentId}`,
}: SimulatorClientProps) {
  const router = useRouter();
  const startedAtRef = useRef(new Date());
  const finishedRef = useRef(false);
  const [hasHydratedDraft, setHasHydratedDraft] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Partial<Record<string, OptionLetter>>>(
    {},
  );
  const [questionComments, setQuestionComments] = useState<
    Record<string, string>
  >({});
  const [timeLeft, setTimeLeft] = useState(SIMULATION_SECONDS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showFinishDialog, setShowFinishDialog] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState("Autoguardado listo");

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
        const comments = Object.fromEntries(
          Object.entries(questionComments)
            .map(([questionId, comment]) => [questionId, comment.trim()])
            .filter(([, comment]) => comment.length > 0),
        );
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
            comments,
          }),
        );
        writeLocalSimulationSummary(studentId, localSimulation);
        window.localStorage.removeItem(draftStorageKey);

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

      const comments = Object.fromEntries(
        Object.entries(questionComments)
          .map(([questionId, comment]) => [questionId, comment.trim()])
          .filter(([, comment]) => comment.length > 0),
      );

      if (Object.keys(comments).length > 0) {
        window.localStorage.setItem(
          `simulation-question-comments:${simulation.id}`,
          JSON.stringify({
            studentId,
            simulationId: simulation.id,
            comments,
            updatedAt: finishedAt.toISOString(),
          }),
        );
      }

      window.localStorage.removeItem(draftStorageKey);
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
    questionComments,
    questions,
    router,
    draftStorageKey,
    studentId,
    timeLeft,
  ]);

  useEffect(() => {
    queueMicrotask(() => {
      const rawDraft = window.localStorage.getItem(draftStorageKey);
      const questionIds = new Set(questions.map((question) => question.id));

      if (!rawDraft) {
        setHasHydratedDraft(true);
        return;
      }

      try {
        const draft = JSON.parse(rawDraft) as SimulationDraft;

        if (![1, DRAFT_VERSION].includes(draft.version)) {
          window.localStorage.removeItem(draftStorageKey);
          setHasHydratedDraft(true);
          return;
        }

        const restoredAnswers = Object.fromEntries(
          Object.entries(draft.answers ?? {}).filter(([questionId]) =>
            questionIds.has(questionId),
          ),
        ) as Partial<Record<string, OptionLetter>>;
        const restoredComments = Object.fromEntries(
          Object.entries(draft.comments ?? {}).filter(([questionId]) =>
            questionIds.has(questionId),
          ),
        );

        setAnswers(restoredAnswers);
        setQuestionComments(restoredComments);
        const firstUnansweredIndex = questions.findIndex(
          (question) => !restoredAnswers[question.id],
        );
        setCurrentIndex(
          firstUnansweredIndex === -1
            ? questions.length - 1
            : firstUnansweredIndex,
        );
        const migratedTimeLeft =
          draft.version === 1
            ? (draft.timeLeft ?? OLD_SIMULATION_SECONDS) +
              (SIMULATION_SECONDS - OLD_SIMULATION_SECONDS)
            : (draft.timeLeft ?? SIMULATION_SECONDS);

        setTimeLeft(Math.min(SIMULATION_SECONDS, Math.max(0, migratedTimeLeft)));
        if (draft.startedAt) {
          startedAtRef.current = new Date(draft.startedAt);
        }
        setAutoSaveStatus("Borrador recuperado");
      } catch {
        window.localStorage.removeItem(draftStorageKey);
      } finally {
        setHasHydratedDraft(true);
      }
    });
  }, [draftStorageKey, questions]);

  useEffect(() => {
    if (!hasHydratedDraft || finishedRef.current) {
      return;
    }

    const draft: SimulationDraft = {
      version: DRAFT_VERSION,
      answers,
      comments: questionComments,
      currentIndex,
      timeLeft,
      simulationSeconds: SIMULATION_SECONDS,
      startedAt: startedAtRef.current.toISOString(),
      updatedAt: new Date().toISOString(),
    };

    window.localStorage.setItem(draftStorageKey, JSON.stringify(draft));
    setAutoSaveStatus("Guardado automáticamente");
  }, [
    answers,
    currentIndex,
    draftStorageKey,
    hasHydratedDraft,
    questionComments,
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
    if (isSubmitting || answers[currentQuestion.id]) {
      return;
    }

    setAnswers((currentAnswers) => ({
      ...currentAnswers,
      [currentQuestion.id]: option,
    }));
    setCurrentIndex((index) => Math.min(questions.length - 1, index + 1));
  }

  function updateQuestionComment(comment: string) {
    setQuestionComments((currentComments) => ({
      ...currentComments,
      [currentQuestion.id]: comment,
    }));
  }

  function goToNext() {
    if (!answers[currentQuestion.id]) {
      return;
    }

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
            <p className="mt-1 text-xs font-medium text-emerald-700">
              {autoSaveStatus}
            </p>
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
              disabled
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Anterior
            </button>
            <button
              type="button"
              onClick={goToNext}
              disabled={
                !answers[currentQuestion.id] ||
                currentIndex === questions.length - 1 ||
                isSubmitting
              }
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
                <div
                  key={question.id}
                  aria-current={isCurrent ? "step" : undefined}
                  aria-label={`Pregunta ${index + 1}`}
                  className={`flex aspect-square min-h-10 items-center justify-center rounded-lg border text-sm font-semibold ${
                    isCurrent
                      ? "border-slate-950 bg-slate-950 text-white"
                      : isAnswered
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-white text-slate-500"
                  }`}
                >
                  {index + 1}
                </div>
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
          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <label
              htmlFor={`question-comment-${currentQuestion.id}`}
              className="flex items-center gap-2 text-sm font-semibold text-slate-700"
            >
              <MessageSquare className="h-4 w-4 text-sky-700" aria-hidden="true" />
              Duda o comentario
            </label>
            <textarea
              id={`question-comment-${currentQuestion.id}`}
              value={questionComments[currentQuestion.id] ?? ""}
              onChange={(event) => updateQuestionComment(event.target.value)}
              rows={4}
              data-allow-selection="true"
              placeholder="Marca una duda para revisarla después."
              className="mt-3 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            />
          </div>
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
