import { requireTeacherImportRequest } from "@/lib/teacherImportAuth";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { getSharedBank } from "@/lib/questionBankServer";
import { getCustomComponents } from "@/lib/customComponentsServer";
import { getSimulatorSettingsCatalog } from "@/lib/simulatorSettingsCatalog";
import { getManualQuestions } from "@/lib/manualQuestionsServer";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const auth = await requireTeacherImportRequest(request);
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => null);
  if (!body || !["question", "component"].includes(body.kind) || typeof body.id !== "string" || !body.id || body.id.length > 200 ||
      typeof body.remove !== "boolean" || !(body.version === null || typeof body.version === "string")) {
    return Response.json({ error: "Datos de eliminación inválidos." }, { status: 400 });
  }
  try {
    const table = getSupabaseAdminClient().from("question_bank_removals");
    const { data: previous, error: readError } = await table.select("*").eq("career_slug", auth.career).eq("kind", body.kind).eq("target_id", body.id).maybeSingle();
    if (readError) throw readError;
    if (previous?.owner_id && previous.owner_id !== auth.teacherId) return Response.json({ error: "Pregunta no encontrada." }, { status: 404 });
    if ((previous?.updated_at ?? null) !== body.version) return Response.json({ error: "Otro docente cambió este elemento. Recarga la página." }, { status: 409 });
    let label: string;
    let ownerId: string | null = null;
    if (body.kind === "component") {
      const catalog = getSimulatorSettingsCatalog(auth.career, await getCustomComponents(auth.career));
      const component = catalog.phases.find(item => item.key === body.id);
      if (!component) return Response.json({ error: "Componente no encontrado en tu carrera." }, { status: 404 });
      label = component.label;
    } else if (body.id.startsWith("local-manual-")) {
      const manual = (await getManualQuestions(auth.context.supabase, auth.teacherId, auth.career)).find(q => `local-manual-${q.id}` === body.id);
      if (!manual) return Response.json({ error: "No se encontró una pregunta tuya con ese identificador." }, { status: 404 });
      label = manual.question_text;
      ownerId = auth.teacherId;
    } else {
      const question = (await getSharedBank(auth.career, true)).find(q => q.id === body.id);
      if (!question) return Response.json({ error: "Pregunta no encontrada en tu carrera." }, { status: 404 });
      if (body.remove && body.revision !== question.revision) return Response.json({ error: "La pregunta fue corregida. Recarga antes de eliminarla." }, { status: 409 });
      label = question.question_text;
    }
    if (!body.remove && !previous?.removed) return Response.json({ error: "El elemento ya está activo." }, { status: 409 });
    const values = { removed: body.remove, label: label.slice(0, 500), owner_id: ownerId, updated_by: auth.teacherId };
    const query = previous
      ? table.update(values).eq("career_slug", auth.career).eq("kind", body.kind).eq("target_id", body.id).eq("updated_at", previous.updated_at)
      : table.insert({ ...values, career_slug: auth.career, kind: body.kind, target_id: body.id });
    const { data, error } = await query.select("*").maybeSingle();
    if (error?.code === "23505" || (!error && !data)) return Response.json({ error: "El elemento cambió. Recarga antes de continuar." }, { status: 409 });
    if (error || !data) throw error;
    return Response.json({ removal: data });
  } catch {
    return Response.json({ error: "No se pudo guardar el cambio. Reintenta." }, { status: 500 });
  }
}
