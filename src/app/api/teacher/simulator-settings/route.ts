import { getBankRemovals } from "@/lib/bankRemovalsServer";
import { removedComponentIds } from "@/lib/bankRemovals";
import { getCustomComponents } from "@/lib/customComponentsServer";
import { getCurrentAuthContext } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { getTeacherCareerScope } from "@/lib/teacherCareerScope";
import { getDefaultSimulatorDurationMinutes, isSimulatorDurationMinutes } from "@/lib/simulatorDuration";
import {
  getSimulatorSettingsCatalog,
  type SimulatorPhaseKey,
} from "@/lib/simulatorSettingsCatalog";

type UpdateSimulatorSettingsBody = {
  durationMinutes?: unknown;
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
  const catalog = getSimulatorSettingsCatalog(teacherCareerScope, await getCustomComponents(teacherCareerScope), removedComponentIds(await getBankRemovals(teacherCareerScope)));
  const allowedPhases = new Set(
    catalog.phases.map((option) => option.key),
  );

  if (
    !Array.isArray(body.enabledPhases) ||
    !body.enabledPhases.every(
      (item): item is SimulatorPhaseKey =>
        typeof item === "string" &&
        allowedPhases.has(item as SimulatorPhaseKey),
    )
  ) {
    return Response.json(
      { error: "La selección de componentes no es válida." },
      { status: 400 },
    );
  }

  const enabledPhases = Array.from(new Set(body.enabledPhases));

  if (body.durationMinutes !== undefined && !isSimulatorDurationMinutes(body.durationMinutes)) {
    return Response.json({ error: "Selecciona una duración entre 60 y 150 minutos, en intervalos de 10 minutos." }, { status: 400 });
  }
  let durationMinutes = teacherCareerScope === "psicologia" && isSimulatorDurationMinutes(body.durationMinutes)
    ? body.durationMinutes : getDefaultSimulatorDurationMinutes(teacherCareerScope);

  if (enabledPhases.length === 0) {
    return Response.json(
      { error: "Selecciona al menos un componente antes de guardar." },
      { status: 400 },
    );
  }

  const savedDifficulties = catalog.difficulties.map((option) => option.key);
  const savedCategories = catalog.categories.map((option) => option.key);
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

  if (teacherCareerScope === "psicologia" && body.durationMinutes === undefined) {
    const { data: currentSettings, error: readError } = await adminClient
      .from("teacher_simulator_settings")
      .select("duration_minutes")
      .eq("teacher_id", authContext.profile.id)
      .eq("career_slug", teacherCareerScope)
      .maybeSingle<{ duration_minutes: number | null }>();
    if (readError) {
      return Response.json({ error: "No se pudo consultar la duración guardada. Intenta nuevamente." }, { status: 500 });
    }
    if (isSimulatorDurationMinutes(currentSettings?.duration_minutes)) {
      durationMinutes = currentSettings.duration_minutes;
    }
  }

  const { error } = await adminClient
    .from("teacher_simulator_settings")
    .upsert(
      {
        teacher_id: authContext.profile.id,
        career_slug: teacherCareerScope,
        duration_minutes: durationMinutes,
        enabled_difficulties: savedDifficulties,
        enabled_categories: savedCategories,
        enabled_phases: enabledPhases,
        updated_at: updatedAt,
        updated_by: authContext.profile.id,
      },
      { onConflict: "teacher_id,career_slug" },
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
      durationMinutes,
      enabledDifficulties: savedDifficulties,
      enabledCategories: savedCategories,
      enabledPhases,
      updatedAt,
    },
  });
}
