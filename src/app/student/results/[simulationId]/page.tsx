import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { LocalSimulationResult } from "@/components/LocalSimulationResult";
import { ResultCategorySummary } from "@/components/ResultCategorySummary";
import { ResultPerformanceSummary } from "@/components/ResultPerformanceSummary";
import { ResultReviewList } from "@/components/ResultReviewList";
import { ResultScoreCard } from "@/components/ResultScoreCard";
import { SimulationStoredComments } from "@/components/SimulationStoredComments";
import { requireCompletedStudentProfile } from "@/lib/auth";
import type {
  SimulationAnswerWithQuestion,
  SimulationAttempt,
} from "@/lib/database.types";
import {
  simulationAttemptToAnswers,
  simulationAttemptToSimulation,
} from "@/lib/supabaseSimulationAttempts";

type StudentResultPageProps = {
  params: Promise<{
    simulationId: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function StudentResultPage({
  params,
}: StudentResultPageProps) {
  const { simulationId } = await params;

  if (simulationId.startsWith("local-")) {
    await requireCompletedStudentProfile();
    return <LocalSimulationResult simulationId={simulationId} />;
  }

  const { profile, supabase } = await requireCompletedStudentProfile();

  const { data: storedAttempt } = await supabase
    .from("simulation_attempts")
    .select("*")
    .eq("id", simulationId)
    .eq("student_id", profile.id)
    .eq("status", "finished")
    .maybeSingle()
    .returns<SimulationAttempt | null>();

  if (storedAttempt) {
    const simulation = simulationAttemptToSimulation(storedAttempt);
    const answers = simulationAttemptToAnswers(storedAttempt);

    return (
      <div className="space-y-8">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/student/dashboard" },
            { label: "Resultado" },
          ]}
        />

        <ResultScoreCard simulation={simulation} />

        <ResultPerformanceSummary answers={answers} />

        <SimulationStoredComments
          simulationId={simulation.id}
          answers={answers}
        />

        <ResultCategorySummary answers={answers} />

        <ResultReviewList answers={answers} />
      </div>
    );
  }

  const { data: simulation } = await supabase
    .from("simulations")
    .select("*")
    .eq("id", simulationId)
    .eq("student_id", profile.id)
    .or("status.eq.finished,status.is.null")
    .maybeSingle();

  if (!simulation) {
    notFound();
  }

  const { data } = await supabase
    .from("simulation_answers")
    .select(
      `
      id,
      simulation_id,
      question_id,
      selected_option,
      is_correct,
      answered_at,
      questions (
        id,
        question_text,
        option_a,
        option_b,
        option_c,
        option_d,
        correct_option,
        explanation,
        category,
        difficulty,
        created_at
      )
    `,
    )
    .eq("simulation_id", simulation.id)
    .order("answered_at", { ascending: true })
    .returns<SimulationAnswerWithQuestion[]>();

  const answers = data ?? [];

  return (
    <div className="space-y-8">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/student/dashboard" },
          { label: "Resultado" },
        ]}
      />

      <ResultScoreCard simulation={simulation} />

      <ResultPerformanceSummary answers={answers} />

      <SimulationStoredComments simulationId={simulation.id} answers={answers} />

      <ResultCategorySummary answers={answers} />

      <section>
        {answers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
            No hay respuestas registradas para esta simulación.
          </div>
        ) : (
          <ResultReviewList answers={answers} />
        )}
      </section>
    </div>
  );
}
