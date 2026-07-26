import { getCurrentAuthContext } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { getTeacherCareerScope } from "@/lib/teacherCareerScope";
import {
  getSimulatorSettingsCatalog,
  type SimulatorDifficultyKey,
  type SimulatorPhaseKey,
} from "@/lib/simulatorSettingsCatalog";

type UpdateSimulatorSettingsBody = {
  enabledDifficulties?: unknown;
  enabledCategories?: unknown;
  enabledPhases?: unknown;
};

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const authContext = await getCurrentAuthContext();

  if (!authContext?.profile) {
    return Response.json({ error: "Sesión no válida." }, { status: 401 });
  }

  if (authContext.profile.role !== "teacher") {
    return Response.json(
      { error: "Solo docentes pueden configurar el simulador." },
      { status: 403 },
    );
  }

  const teacherCareerScope = getTeacherCareerScope(authContext.profile);

  if (!teacherCareerScope) {
    return Response.json(
      { error: "Tu cuenta docente no tiene una carrera asignada." },
      { status: 403 },
    );
  }

  const body = (await request
    .json()
    .catch(() => ({}))) as UpdateSimulatorSettingsBody;
  const catalog = getSimulatorSettingsCatalog(teacherCareerScope);
  const allowedDifficulties = new Set(
    catalog.difficulties.map((option) => option.key),
  );
  const allowedCategories = new Set(
    catalog.categories.map((option) => option.key),
  );
  const allowedPhases = new Set(
    catalog.phases.map((option) => option.key),
  );

  if (
    !Array.isArray(body.enabledDifficulties) ||
    !body.enabledDifficulties.every(
      (item): item is SimulatorDifficultyKey =>
        typeof item === "string" &&
        allowedDifficulties.has(item as SimulatorDifficultyKey),
    )
  ) {
    return Response.json(
      { error: "La selección de dificultades no es válida." },
      { status: 400 },
    );
  }

  if (
    !Array.isArray(body.enabledCategories) ||
    !body.enabledCategories.every(
      (item): item is string =>
        typeof item === "string" && allowedCategories.has(item),
    )
  ) {
    return Response.json(
      { error: "La selección de categorías no es válida." },
      { status: 400 },
    );
  }

  if (
    !Array.isArray(body.enabledPhases) ||
    !body.enabledPhases.every(
      (item): item is SimulatorPhaseKey =>
        typeof item === "string" &&
        allowedPhases.has(item as SimulatorPhaseKey),
    )
  ) {
    return Response.json(
      { error: "La selección de fases no es válida." },
      { status: 400 },
    );
  }

  const enabledDifficulties = Array.from(
    new Set(body.enabledDifficulties),
  );
  const enabledCategories = Array.from(new Set(body.enabledCategories));
  const enabledPhases = Array.from(new Set(body.enabledPhases));

  if (
    (catalog.supportsDifficulty && enabledDifficulties.length === 0) ||
    enabledCategories.length === 0 ||
    enabledPhases.length === 0
  ) {
    return Response.json(
      {
        error:
          catalog.supportsDifficulty
            ? "Selecciona al menos una dificultad, una categoría y una fase antes de guardar."
            : "Selecciona al menos una categoría y una fase antes de guardar.",
      },
      { status: 400 },
    );
  }

  const savedDifficulties = catalog.supportsDifficulty
    ? enabledDifficulties
    : catalog.difficulties.map((option) => option.key);
  const updatedAt = new Date().toISOString();

  let adminClient: ReturnType<typeof getSupabaseAdminClient>;

  try {
    adminClient = getSupabaseAdminClient();
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Falta configurar Supabase Admin.",
      },
      { status: 500 },
    );
  }

  const { error } = await adminClient
    .from("teacher_simulator_settings")
    .upsert(
      {
        career_slug: teacherCareerScope,
        enabled_difficulties: savedDifficulties,
        enabled_categories: enabledCategories,
        enabled_phases: enabledPhases,
        updated_at: updatedAt,
        updated_by: authContext.profile.id,
      },
      { onConflict: "career_slug" },
    );

  if (error) {
    return Response.json(
      {
        error:
          "No se pudo guardar la configuración. Verifica que la migración de configuración del simulador esté instalada.",
        details: error.message,
      },
      { status: 500 },
    );
  }

  return Response.json({
    settings: {
      enabledDifficulties: savedDifficulties,
      enabledCategories,
      enabledPhases,
      updatedAt,
    },
  });
}
