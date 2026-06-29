import { randomUUID } from "node:crypto";
import Link from "next/link";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SimulatorClient } from "@/components/SimulatorClient";
import type { Json, Question } from "@/lib/database.types";
import {
  examDistributionBySlug,
  getLocalQuestionsForExam,
  isLocalQuestionSet,
  legacyFixedPsychologyAttemptSeed,
  selectQuestionsForExam,
} from "@/lib/localQuestions";
import { getSimulatorExam } from "@/lib/simulatorCatalog";
import { getStudentCareerOption } from "@/lib/studentCareer";
import { requireStudentSimulatorAccess } from "@/lib/studentSimulatorAccess";

type StudentExamSimulatorPageProps = {
  params: Promise<{
    examType: string;
  }>;
  searchParams: Promise<{
    attempt?: string | string[];
  }>;
};

export const dynamic = "force-dynamic";

const attemptSeedPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getStoredAttemptSeed(draft: Json | null | undefined) {
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) {
    return null;
  }

  const attemptSeed = draft.attemptSeed;

  return typeof attemptSeed === "string" && attemptSeedPattern.test(attemptSeed)
    ? attemptSeed
    : null;
}

export default async function StudentExamSimulatorPage({
  params,
  searchParams,
}: StudentExamSimulatorPageProps) {
  const [{ examType }, query] = await Promise.all([params, searchParams]);
  const exam = getSimulatorExam(examType);

  if (!exam) {
    notFound();
  }

  const { profile, supabase } = await requireStudentSimulatorAccess();
  const career = getStudentCareerOption(profile.career);

  if (career && exam.slug !== career.simulatorSlug) {
    redirect(`/student/simulator/${career.simulatorSlug}`);
  }

  const requestedAttemptSeed =
    typeof query.attempt === "string" && attemptSeedPattern.test(query.attempt)
      ? query.attempt
      : null;
  const { data: storedDraft } = await supabase
    .from("simulation_drafts")
    .select("draft")
    .eq("student_id", profile.id)
    .eq("exam_slug", exam.slug)
    .maybeSingle<{ draft: Json }>();
  const storedAttemptSeed = getStoredAttemptSeed(storedDraft?.draft);
  const attemptSeed = storedAttemptSeed
    ? storedAttemptSeed
    : storedDraft && exam.slug === "psicologia"
      ? legacyFixedPsychologyAttemptSeed
      : requestedAttemptSeed ?? randomUUID();

  if (requestedAttemptSeed !== attemptSeed) {
    redirect(
      `/student/simulator/${exam.slug}?attempt=${encodeURIComponent(attemptSeed)}`,
    );
  }

  const examDistribution = examDistributionBySlug[exam.slug] ?? [];
  const shouldUsePsychiatryBank = exam.slug === "psicologia";
  let supabaseQuestions: Question[] = [];
  let questionLoadError = false;

  if (!shouldUsePsychiatryBank) {
    const categoryFilter = exam.categoryKeywords
      .map((keyword) => `category.ilike.%${keyword}%`)
      .join(",");
    const { data, error } = await supabase
      .from("questions")
      .select(
        "id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, category, difficulty, created_at",
      )
      .or(categoryFilter)
      .order("created_at", { ascending: false })
      .limit(examDistribution.length > 0 ? 300 : 100)
      .returns<Question[]>();

    supabaseQuestions = data ?? [];
    questionLoadError = Boolean(error);
  }

  const questions = shouldUsePsychiatryBank
    ? await getLocalQuestionsForExam(exam.slug, attemptSeed)
    : questionLoadError || supabaseQuestions.length === 0
      ? await getLocalQuestionsForExam(exam.slug, attemptSeed)
      : selectQuestionsForExam(exam.slug, supabaseQuestions, attemptSeed);
  const persistenceMode = isLocalQuestionSet(questions) ? "local" : "supabase";
  const Icon = exam.icon;

  if (questionLoadError && questions.length === 0) {
    return (
      <section className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
        No se pudieron cargar las preguntas de {exam.shortTitle}.
      </section>
    );
  }

  if (questions.length === 0) {
    return (
      <section className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
          <ClipboardList className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2 className="mt-5 text-2xl font-semibold tracking-normal text-slate-950">
          No hay preguntas para {exam.shortTitle}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500">
          Registra preguntas en Supabase con la categoría relacionada a{" "}
          {exam.shortTitle} para que este simulador pueda cargarlas.
        </p>
        <Link
          href="/student/dashboard"
          className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver al dashboard
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/student/dashboard" },
          { label: "Simulador", href: "/student/simulator" },
          { label: exam.shortTitle },
        ]}
      />

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700 ring-1 ring-sky-100">
            <Icon className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold text-sky-700">
              Simulador CACES
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">
              {exam.title}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
              {exam.description}
            </p>
            {examDistribution.length > 0 ? (
              <div className="mt-4 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                {examDistribution.map((item) => (
                  <div
                    key={item.area}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <span className="font-semibold text-slate-950">
                      {item.count} preguntas
                    </span>{" "}
                    ({item.percent}%): {item.area}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {persistenceMode === "local" ? (
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-800">
          {shouldUsePsychiatryBank
            ? "Usando el banco local de Psicología: 80 preguntas seleccionadas aleatoriamente de 105, con sus argumentaciones de respuesta."
            : `Usando banco local de ${exam.shortTitle} mientras Supabase no tenga la tabla de preguntas cargada.`}
        </div>
      ) : null}

      <SimulatorClient
        questions={questions}
        studentId={profile.id}
        examSlug={exam.slug}
        attemptSeed={attemptSeed}
        persistenceMode={persistenceMode}
        draftStorageKey={`simulation-draft:${profile.id}:${exam.slug}`}
      />
    </div>
  );
}
