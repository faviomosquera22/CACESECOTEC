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
import type { Json, OptionLetter, Question } from "@/lib/database.types";
import {
  CLOUD_SIMULATION_RESULTS_METADATA_KEY,
  CLOUD_SIMULATIONS_METADATA_KEY,
  mergeSimulationRecords,
  parseCloudSimulationResults,
  parseCloudSimulationRecords,
  type CloudSimulationAnswerRecord,
  type CloudSimulationResultRecord,
} from "@/lib/cloudSimulationStorage";
import { writeLocalSimulationSummary } from "@/lib/localSimulationStorage";
import { getFreshSupabaseUser } from "@/lib/supabaseAuthMetadata";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { buildSimulationAttemptInsert } from "@/lib/supabaseSimulationAttempts";
import { SimulationQuestion } from "@/components/SimulationQuestion";

type SimulatorClientProps = {
  questions: Question[];
  studentId: string;
  examSlug: string;
  persistenceMode?: "supabase" | "local";
  draftStorageKey?: string;
};

const OLD_SIMULATION_SECONDS = 60 * 60;
const SIMULATION_SECONDS = 120 * 60;
const DRAFT_VERSION = 2;
const LEGACY_DRAFT_PREFIX = "draft";
const LEGACY_DRAFT_DONE_PREFIX = "draft_done";

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

function getFirstUnansweredIndex(
  questions: Question[],
  answers: Partial<Record<string, OptionLetter>>,
) {
  const firstUnansweredIndex = questions.findIndex(
    (question) => !answers[question.id],
  );

  return firstUnansweredIndex === -1
    ? Math.max(0, questions.length - 1)
    : firstUnansweredIndex;
}

function getRemainingSeconds(startedAt: Date) {
  const elapsedSeconds = Math.floor((Date.now() - startedAt.getTime()) / 1000);

  return Math.min(
    SIMULATION_SECONDS,
    Math.max(0, SIMULATION_SECONDS - elapsedSeconds),
  );
}

function parseLocalDraft(rawDraft: string | null, questionIds: Set<string>) {
  if (!rawDraft) {
    return null;
  }

  try {
    const draft = JSON.parse(rawDraft) as SimulationDraft;

    if (![1, DRAFT_VERSION].includes(draft.version)) {
      return null;
    }

    const answers = Object.fromEntries(
      Object.entries(draft.answers ?? {}).filter(([questionId]) =>
        questionIds.has(questionId),
      ),
    ) as Partial<Record<string, OptionLetter>>;
    const comments = Object.fromEntries(
      Object.entries(draft.comments ?? {}).filter(([questionId]) =>
        questionIds.has(questionId),
      ),
    );
    const timeLeft =
      draft.version === 1
        ? (draft.timeLeft ?? OLD_SIMULATION_SECONDS) +
          (SIMULATION_SECONDS - OLD_SIMULATION_SECONDS)
        : (draft.timeLeft ?? SIMULATION_SECONDS);

    return {
      answers,
      comments,
      startedAt: draft.startedAt ? new Date(draft.startedAt) : new Date(),
      timeLeft: Math.min(SIMULATION_SECONDS, Math.max(0, timeLeft)),
    };
  } catch {
    return null;
  }
}

function parseStoredDraft(value: unknown, questionIds: Set<string>) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const draft = value as Partial<SimulationDraft>;
  const answers = Object.fromEntries(
    Object.entries(draft.answers ?? {}).filter(
      ([questionId, option]) =>
        questionIds.has(questionId) &&
        ["A", "B", "C", "D"].includes(String(option)),
    ),
  ) as Partial<Record<string, OptionLetter>>;
  const comments = Object.fromEntries(
    Object.entries(draft.comments ?? {}).filter(([questionId]) =>
      questionIds.has(questionId),
    ),
  );
  const startedAt =
    typeof draft.startedAt === "string" ? new Date(draft.startedAt) : new Date();
  const timeLeft =
    typeof draft.timeLeft === "number"
      ? Math.min(SIMULATION_SECONDS, Math.max(0, draft.timeLeft))
      : getRemainingSeconds(startedAt);

  return {
    answers,
    comments,
    startedAt,
    timeLeft,
  };
}

function encodeDraftStatus(examSlug: string, draft: SimulationDraft) {
  try {
    const json = JSON.stringify(draft);
    const bytes = new TextEncoder().encode(json);
    const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");

    return `${LEGACY_DRAFT_PREFIX}:${examSlug}:${window.btoa(binary)}`;
  } catch {
    return null;
  }
}

function parseDraftStatus(
  status: string | null | undefined,
  examSlug: string,
  questionIds: Set<string>,
) {
  const prefix = `${LEGACY_DRAFT_PREFIX}:${examSlug}:`;

  if (!status?.startsWith(prefix)) {
    return null;
  }

  try {
    const binary = window.atob(status.slice(prefix.length));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);

    return parseStoredDraft(JSON.parse(json), questionIds);
  } catch {
    return null;
  }
}

async function deleteRemoteDraft(studentId: string, examSlug: string) {
  try {
    const supabase = getSupabaseBrowserClient();
    await supabase
      .from("simulation_drafts")
      .delete()
      .eq("student_id", studentId)
      .eq("exam_slug", examSlug);
  } catch {
    // The local fallback still works if the draft table is not installed yet.
  }
}

function getAuthDrafts(metadata: Record<string, unknown> | null | undefined) {
  const drafts = metadata?.simulationDrafts;

  if (!drafts || typeof drafts !== "object" || Array.isArray(drafts)) {
    return {};
  }

  return drafts as Record<string, unknown>;
}

async function readAuthDraft(examSlug: string, questionIds: Set<string>) {
  try {
    const user = await getFreshSupabaseUser();

    if (!user) {
      return null;
    }

    const drafts = getAuthDrafts(user.user_metadata);

    return parseStoredDraft(drafts[examSlug], questionIds);
  } catch {
    return null;
  }
}

async function writeAuthDraft(examSlug: string, draft: SimulationDraft) {
  try {
    const supabase = getSupabaseBrowserClient();
    const user = await getFreshSupabaseUser();

    if (!user) {
      return false;
    }

    const drafts = getAuthDrafts(user.user_metadata);
    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        ...user.user_metadata,
        simulationDrafts: {
          ...drafts,
          [examSlug]: draft,
        },
      },
    });

    return !updateError;
  } catch {
    return false;
  }
}

async function deleteAuthDraft(examSlug: string) {
  try {
    const supabase = getSupabaseBrowserClient();
    const user = await getFreshSupabaseUser();

    if (!user) {
      return;
    }

    const drafts = getAuthDrafts(user.user_metadata);
    const nextDrafts = { ...drafts };
    delete nextDrafts[examSlug];

    await supabase.auth.updateUser({
      data: {
        ...user.user_metadata,
        simulationDrafts: nextDrafts,
      },
    });
  } catch {
    // Auth metadata is a fallback sync channel.
  }
}

async function writeAuthSimulationResult(result: CloudSimulationResultRecord) {
  try {
    const supabase = getSupabaseBrowserClient();
    const user = await getFreshSupabaseUser();

    if (!user) {
      return false;
    }

    const existingSummaries = parseCloudSimulationRecords(user.user_metadata);
    const existingResults = parseCloudSimulationResults(user.user_metadata);
    const nextSummaries = mergeSimulationRecords([
      result.simulation,
      ...existingSummaries,
    ]).slice(0, 50);
    const nextResults = [
      result,
      ...existingResults.filter(
        (item) => item.simulation.id !== result.simulation.id,
      ),
    ].slice(0, 10);
    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        ...user.user_metadata,
        [CLOUD_SIMULATIONS_METADATA_KEY]: nextSummaries,
        [CLOUD_SIMULATION_RESULTS_METADATA_KEY]: nextResults,
      },
    });

    return !updateError;
  } catch {
    return false;
  }
}

async function markLegacyDraftDone(studentId: string, examSlug: string) {
  try {
    const supabase = getSupabaseBrowserClient();
    await supabase.from("simulations").insert({
      student_id: studentId,
      started_at: new Date().toISOString(),
      status: `${LEGACY_DRAFT_DONE_PREFIX}:${examSlug}`,
    });
  } catch {
    // This marker only prevents old fallback drafts from reopening.
  }
}

export function SimulatorClient({
  questions,
  studentId,
  examSlug,
  persistenceMode = "supabase",
  draftStorageKey = `simulation-draft:${studentId}`,
}: SimulatorClientProps) {
  const router = useRouter();
  const startedAtRef = useRef(new Date());
  const finishedRef = useRef(false);
  const activeSimulationIdRef = useRef<string | null>(null);
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
  const remoteDraftStatus = `in_progress:${examSlug}`;

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
      const comments = Object.fromEntries(
        Object.entries(questionComments)
          .map(([questionId, comment]) => [questionId, comment.trim()])
          .filter(([, comment]) => comment.length > 0),
      );

      try {
        const supabase = getSupabaseBrowserClient();
        const { data: storedAttempt, error: storedAttemptError } = await supabase
          .from("simulation_attempts")
          .insert(
            buildSimulationAttemptInsert({
              studentId,
              examSlug,
              startedAt: startedAtRef.current.toISOString(),
              finishedAt: finishedAt.toISOString(),
              totalQuestions,
              correctAnswers,
              incorrectAnswers,
              score,
              timeUsedSeconds,
              questions,
              selectedAnswers: answers,
              comments,
            }),
          )
          .select("id")
          .single();

        if (!storedAttemptError && storedAttempt) {
          window.localStorage.removeItem(draftStorageKey);
          await deleteRemoteDraft(studentId, examSlug);
          await deleteAuthDraft(examSlug);
          activeSimulationIdRef.current = null;
          router.push(`/student/results/${storedAttempt.id}`);
          router.refresh();
          return;
        }
      } catch {
        // Continue with the legacy/local fallback if the storage table is pending.
      }

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
        const cloudAnswers: CloudSimulationAnswerRecord[] = localAnswers.map(
          (answer) => ({
            id: answer.id,
            simulation_id: answer.simulation_id,
            question_id: answer.question_id,
            selected_option: answer.selected_option,
            is_correct: answer.is_correct,
            answered_at: answer.answered_at,
          }),
        );

        window.localStorage.setItem(
          `local-simulation:${simulationId}`,
          JSON.stringify({
            simulation: localSimulation,
            answers: localAnswers,
            comments,
          }),
        );
        writeLocalSimulationSummary(studentId, localSimulation);
        await writeAuthSimulationResult({
          simulation: localSimulation,
          answers: cloudAnswers,
          comments,
        });
        window.localStorage.removeItem(draftStorageKey);
        await deleteRemoteDraft(studentId, examSlug);
        await deleteAuthDraft(examSlug);
        await markLegacyDraftDone(studentId, examSlug);

        router.push(`/student/results/${simulationId}`);
        return;
      }

      const supabase = getSupabaseBrowserClient();
      const activeSimulationId = activeSimulationIdRef.current;

      let simulationId: string | null = activeSimulationId;

      if (!simulationId) {
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

        simulationId = simulation.id;
      }

      if (!simulationId) {
        throw new Error("No se pudo preparar la simulación.");
      }

      const { data: existingAnswerRows } = await supabase
        .from("simulation_answers")
        .select("question_id")
        .eq("simulation_id", simulationId);
      const existingQuestionIds = new Set(
        (existingAnswerRows ?? []).map((answer) => answer.question_id),
      );
      const answerRows = questions
        .filter((question) => !existingQuestionIds.has(question.id))
        .map((question) => {
          const selectedOption = answers[question.id] ?? null;

          return {
            simulation_id: simulationId,
            question_id: question.id,
            selected_option: selectedOption,
            is_correct: selectedOption === question.correct_option,
            answered_at: finishedAt.toISOString(),
          };
        });

      if (answerRows.length > 0) {
        const { error: answersError } = await supabase
          .from("simulation_answers")
          .insert(answerRows);

        if (answersError) {
          throw new Error("No se pudieron guardar las respuestas.");
        }
      }

      if (activeSimulationId) {
        const { error: simulationError } = await supabase
          .from("simulations")
          .update({
            finished_at: finishedAt.toISOString(),
            total_questions: totalQuestions,
            correct_answers: correctAnswers,
            incorrect_answers: incorrectAnswers,
            score,
            time_used_seconds: timeUsedSeconds,
            status: "finished",
          })
          .eq("id", activeSimulationId)
          .eq("student_id", studentId);

        if (simulationError) {
          throw new Error("No se pudo finalizar la simulación.");
        }
      }

      if (Object.keys(comments).length > 0) {
        window.localStorage.setItem(
          `simulation-question-comments:${simulationId}`,
          JSON.stringify({
            studentId,
            simulationId,
            comments,
            updatedAt: finishedAt.toISOString(),
          }),
        );
      }

      window.localStorage.removeItem(draftStorageKey);
      const cloudSimulation = {
        id: simulationId,
        finished_at: finishedAt.toISOString(),
        created_at: finishedAt.toISOString(),
        total_questions: totalQuestions,
        correct_answers: correctAnswers,
        incorrect_answers: incorrectAnswers,
        score,
        time_used_seconds: timeUsedSeconds,
      };
      const cloudAnswers: CloudSimulationAnswerRecord[] = questions.map(
        (question) => {
          const selectedOption = answers[question.id] ?? null;

          return {
            id: `${simulationId}-${question.id}`,
            simulation_id: simulationId,
            question_id: question.id,
            selected_option: selectedOption,
            is_correct: selectedOption === question.correct_option,
            answered_at: finishedAt.toISOString(),
          };
        },
      );
      await writeAuthSimulationResult({
        simulation: cloudSimulation,
        answers: cloudAnswers,
        comments,
      });
      await deleteRemoteDraft(studentId, examSlug);
      await deleteAuthDraft(examSlug);
      await markLegacyDraftDone(studentId, examSlug);
      activeSimulationIdRef.current = null;
      router.push(`/student/results/${simulationId}`);
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
    examSlug,
    studentId,
    timeLeft,
  ]);

  useEffect(() => {
    let isMounted = true;

    queueMicrotask(async () => {
      const questionIds = new Set(questions.map((question) => question.id));
      const rawDraft = window.localStorage.getItem(draftStorageKey);
      const localDraft = parseLocalDraft(rawDraft, questionIds);

      function applyDraft(
        restoredAnswers: Partial<Record<string, OptionLetter>>,
        restoredComments: Record<string, string>,
        restoredStartedAt: Date,
        restoredTimeLeft: number,
      ) {
        if (!isMounted) {
          return;
        }

        setAnswers(restoredAnswers);
        setQuestionComments(restoredComments);
        setCurrentIndex(getFirstUnansweredIndex(questions, restoredAnswers));
        setTimeLeft(restoredTimeLeft);
        startedAtRef.current = restoredStartedAt;
      }

      try {
        const supabase = getSupabaseBrowserClient();
        const { data: remoteDraft } = await supabase
          .from("simulation_drafts")
          .select("draft")
          .eq("student_id", studentId)
          .eq("exam_slug", examSlug)
          .maybeSingle();
        const parsedRemoteDraft = parseStoredDraft(
          remoteDraft?.draft,
          questionIds,
        );

        if (parsedRemoteDraft) {
          applyDraft(
            parsedRemoteDraft.answers,
            parsedRemoteDraft.comments,
            parsedRemoteDraft.startedAt,
            getRemainingSeconds(parsedRemoteDraft.startedAt),
          );
          setAutoSaveStatus("Progreso sincronizado");

          if (isMounted) {
            setHasHydratedDraft(true);
          }
          return;
        }
      } catch {
        // Continue with existing local/in-progress fallbacks.
      }

      const authDraft = await readAuthDraft(examSlug, questionIds);

      if (authDraft) {
        applyDraft(
          authDraft.answers,
          authDraft.comments,
          authDraft.startedAt,
          getRemainingSeconds(authDraft.startedAt),
        );
        setAutoSaveStatus("Progreso sincronizado");

        if (isMounted) {
          setHasHydratedDraft(true);
        }
        return;
      }

      try {
        const supabase = getSupabaseBrowserClient();
        const [
          { data: draftRows },
          { data: finishedRows },
          { data: doneRows },
        ] = await Promise.all([
          supabase
            .from("simulations")
            .select("status, created_at")
            .eq("student_id", studentId)
            .like("status", `${LEGACY_DRAFT_PREFIX}:${examSlug}:%`)
            .order("created_at", { ascending: false })
            .limit(1),
          supabase
            .from("simulations")
            .select("created_at")
            .eq("student_id", studentId)
            .or("status.eq.finished,status.is.null")
            .order("created_at", { ascending: false })
            .limit(1),
          supabase
            .from("simulations")
            .select("created_at")
            .eq("student_id", studentId)
            .eq("status", `${LEGACY_DRAFT_DONE_PREFIX}:${examSlug}`)
            .order("created_at", { ascending: false })
            .limit(1),
        ]);
        const legacyDraftRow = draftRows?.[0] ?? null;
        const latestFinishedRow = finishedRows?.[0] ?? null;
        const latestDoneRow = doneRows?.[0] ?? null;
        const draftCreatedAt = legacyDraftRow?.created_at
          ? new Date(legacyDraftRow.created_at).getTime()
          : 0;
        const finishedCreatedAt = Math.max(
          latestFinishedRow?.created_at
            ? new Date(latestFinishedRow.created_at).getTime()
            : 0,
          latestDoneRow?.created_at
            ? new Date(latestDoneRow.created_at).getTime()
            : 0,
        );
        const legacyDraft =
          draftCreatedAt > finishedCreatedAt
            ? parseDraftStatus(legacyDraftRow?.status, examSlug, questionIds)
            : null;

        if (legacyDraft) {
          applyDraft(
            legacyDraft.answers,
            legacyDraft.comments,
            legacyDraft.startedAt,
            getRemainingSeconds(legacyDraft.startedAt),
          );
          setAutoSaveStatus("Progreso sincronizado");

          if (isMounted) {
            setHasHydratedDraft(true);
          }
          return;
        }
      } catch {
        // Continue with the local browser fallback.
      }

      if (persistenceMode !== "supabase") {
        if (localDraft) {
          applyDraft(
            localDraft.answers,
            localDraft.comments,
            localDraft.startedAt,
            localDraft.timeLeft,
          );
          setAutoSaveStatus("Borrador recuperado");
        } else if (rawDraft) {
          window.localStorage.removeItem(draftStorageKey);
        }

        if (isMounted) {
          setHasHydratedDraft(true);
        }
        return;
      }

      try {
        const supabase = getSupabaseBrowserClient();
        const { data: activeSimulation, error: activeSimulationError } =
          await supabase
            .from("simulations")
            .select("id, started_at, created_at")
            .eq("student_id", studentId)
            .eq("status", remoteDraftStatus)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (activeSimulationError) {
          throw activeSimulationError;
        }

        if (activeSimulation) {
          activeSimulationIdRef.current = activeSimulation.id;
          const startedAt = new Date(
            activeSimulation.started_at ??
              activeSimulation.created_at ??
              new Date().toISOString(),
          );
          const { data: answerRows, error: answerRowsError } = await supabase
            .from("simulation_answers")
            .select("question_id, selected_option")
            .eq("simulation_id", activeSimulation.id);

          if (answerRowsError) {
            throw answerRowsError;
          }

          const restoredAnswers = Object.fromEntries(
            (answerRows ?? [])
              .filter(
                (answer) =>
                  questionIds.has(answer.question_id) && answer.selected_option,
              )
              .map((answer) => [answer.question_id, answer.selected_option]),
          ) as Partial<Record<string, OptionLetter>>;

          applyDraft(
            restoredAnswers,
            localDraft?.comments ?? {},
            startedAt,
            getRemainingSeconds(startedAt),
          );
          setAutoSaveStatus("Progreso sincronizado");
          return;
        }

        const migratedAnswers = localDraft?.answers ?? {};
        const migratedTimeLeft = localDraft?.timeLeft ?? SIMULATION_SECONDS;
        const migratedStartedAt = new Date(
          Date.now() - (SIMULATION_SECONDS - migratedTimeLeft) * 1000,
        );
        const { data: newSimulation, error: newSimulationError } =
          await supabase
            .from("simulations")
            .insert({
              student_id: studentId,
              started_at: migratedStartedAt.toISOString(),
              total_questions: questions.length,
              status: remoteDraftStatus,
            })
            .select("id")
            .single();

        if (newSimulationError || !newSimulation) {
          throw new Error("No se pudo crear el intento sincronizado.");
        }

        activeSimulationIdRef.current = newSimulation.id;

        const migratedAnswerRows = questions
          .filter((question) => migratedAnswers[question.id])
          .map((question) => {
            const selectedOption = migratedAnswers[question.id] ?? null;

            return {
              simulation_id: newSimulation.id,
              question_id: question.id,
              selected_option: selectedOption,
              is_correct: selectedOption === question.correct_option,
              answered_at: new Date().toISOString(),
            };
          });

        if (migratedAnswerRows.length > 0) {
          await supabase.from("simulation_answers").insert(migratedAnswerRows);
        }

        applyDraft(
          migratedAnswers,
          localDraft?.comments ?? {},
          migratedStartedAt,
          migratedTimeLeft,
        );
        setAutoSaveStatus(
          localDraft ? "Borrador sincronizado" : "Progreso sincronizado",
        );
      } catch {
        if (localDraft) {
          applyDraft(
            localDraft.answers,
            localDraft.comments,
            localDraft.startedAt,
            localDraft.timeLeft,
          );
          setAutoSaveStatus("Borrador local recuperado");
        } else if (rawDraft) {
          window.localStorage.removeItem(draftStorageKey);
        }
      } finally {
        if (isMounted) {
          setHasHydratedDraft(true);
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [
    draftStorageKey,
    examSlug,
    persistenceMode,
    questions,
    remoteDraftStatus,
    studentId,
  ]);

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
  }, [
    answers,
    currentIndex,
    draftStorageKey,
    hasHydratedDraft,
    questionComments,
    timeLeft,
  ]);

  useEffect(() => {
    if (!hasHydratedDraft || finishedRef.current) {
      return;
    }

    const timer = window.setTimeout(async () => {
      const persistedAnswers = Object.fromEntries(
        Object.entries(answers).filter(([, option]) => Boolean(option)),
      );
      const persistedComments = Object.fromEntries(
        Object.entries(questionComments)
          .map(([questionId, comment]) => [questionId, comment.trim()])
          .filter(([, comment]) => comment.length > 0),
      );
      const draft: SimulationDraft = {
        version: DRAFT_VERSION,
        answers: persistedAnswers,
        comments: persistedComments,
        currentIndex,
        timeLeft: getRemainingSeconds(startedAtRef.current),
        simulationSeconds: SIMULATION_SECONDS,
        startedAt: startedAtRef.current.toISOString(),
        updatedAt: new Date().toISOString(),
      };

      try {
        const supabase = getSupabaseBrowserClient();
        const { error: draftError } = await supabase
          .from("simulation_drafts")
          .upsert(
            {
              student_id: studentId,
              exam_slug: examSlug,
              draft: draft as unknown as Json,
              updated_at: draft.updatedAt,
            },
            { onConflict: "student_id,exam_slug" },
          );

        if (!draftError) {
          setAutoSaveStatus("Progreso sincronizado");
          return;
        }
      } catch {
        // Fall back to the existing simulations table below.
      }

      if (await writeAuthDraft(examSlug, draft)) {
        setAutoSaveStatus("Progreso sincronizado");
        return;
      }

      try {
        const status = encodeDraftStatus(examSlug, draft);

        if (!status) {
          return;
        }

        const supabase = getSupabaseBrowserClient();
        const { error: fallbackError } = await supabase.from("simulations").insert({
          student_id: studentId,
          started_at: draft.startedAt,
          total_questions: questions.length,
          status,
        });

        if (!fallbackError) {
          setAutoSaveStatus("Progreso sincronizado");
        }
      } catch {
        // Local draft remains available if remote persistence is unavailable.
      }
    }, 500);

    return () => window.clearTimeout(timer);
  }, [
    answers,
    currentIndex,
    examSlug,
    hasHydratedDraft,
    questionComments,
    questions.length,
    studentId,
  ]);

  useEffect(() => {
    if (!hasHydratedDraft || finishedRef.current) {
      return;
    }

    const timer = window.setInterval(() => {
      setTimeLeft((currentTime) => Math.max(0, currentTime - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [hasHydratedDraft]);

  useEffect(() => {
    if (timeLeft === 0) {
      void finishSimulation();
    }
  }, [finishSimulation, timeLeft]);

  const answeredLabel = useMemo(
    () => `${selectedCount} de ${questions.length} respondidas`,
    [questions.length, selectedCount],
  );

  async function syncRemoteAnswer(question: Question, option: OptionLetter) {
    if (persistenceMode !== "supabase") {
      return;
    }

    const simulationId = activeSimulationIdRef.current;

    if (!simulationId) {
      setAutoSaveStatus("Guardado localmente; sincronización pendiente");
      return;
    }

    setAutoSaveStatus("Sincronizando progreso...");

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: existingRows, error: existingRowsError } = await supabase
        .from("simulation_answers")
        .select("id")
        .eq("simulation_id", simulationId)
        .eq("question_id", question.id)
        .limit(1);

      if (existingRowsError) {
        throw existingRowsError;
      }

      if ((existingRows ?? []).length > 0) {
        setAutoSaveStatus("Progreso sincronizado");
        return;
      }

      const { error: answerError } = await supabase
        .from("simulation_answers")
        .insert({
          simulation_id: simulationId,
          question_id: question.id,
          selected_option: option,
          is_correct: option === question.correct_option,
          answered_at: new Date().toISOString(),
        });

      if (answerError) {
        throw answerError;
      }

      setAutoSaveStatus("Progreso sincronizado");
    } catch {
      setAutoSaveStatus("Guardado localmente; sincronización pendiente");
    }
  }

  function selectAnswer(option: OptionLetter) {
    if (isSubmitting || answers[currentQuestion.id]) {
      return;
    }

    setAnswers((currentAnswers) => ({
      ...currentAnswers,
      [currentQuestion.id]: option,
    }));
    setCurrentIndex((index) => Math.min(questions.length - 1, index + 1));
    void syncRemoteAnswer(currentQuestion, option);
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

  if (!hasHydratedDraft) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-6 text-sm font-semibold text-slate-600 shadow-sm">
        Preparando progreso sincronizado...
      </section>
    );
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
