import { getCurrentAuthContext } from "@/lib/auth";
import { getTeacherCareerScope } from "@/lib/teacherCareerScope";
import { getSharedBank } from "@/lib/questionBankServer";
import { validateBankEdit } from "@/lib/questionBank";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import type { Json } from "@/lib/database.types";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const context = await getCurrentAuthContext();
  if (!context?.profile) return Response.json({ error: "Sesión no válida." }, { status: 401 });
  const career = getTeacherCareerScope(context.profile);
  if (!career) return Response.json({ error: "Solo docentes pueden corregir el banco." }, { status: 403 });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.id !== "string" || !(body.revision === null || typeof body.revision === "string")) return Response.json({ error: "Datos inválidos." }, { status: 400 });
  try {
    const original = (await getSharedBank(career)).find(q => q.id === body.id);
    if (!original) return Response.json({ error: "Pregunta no encontrada en tu carrera." }, { status: 404 });
    if (body.revision !== original.revision) return Response.json({ error: "Otro docente modificó esta pregunta. Recarga la página antes de editarla." }, { status: 409 });
    let question;
    try { question = validateBankEdit(body, original); }
    catch (error) { return Response.json({ error: (error as Error).message }, { status: 400 }); }
    const table = getSupabaseAdminClient().from("question_bank_overrides");
    const update = { question: question as unknown as Json, updated_by: context.profile.id };
    const query = original.revision
      ? table.update(update).eq("question_id", original.id).eq("career_slug", career).eq("updated_at", original.revision)
      : table.insert({ ...update, question_id: original.id, career_slug: career });
    const { data, error } = await query.select("updated_at").maybeSingle();
    if (error?.code === "23505" || (!error && !data)) return Response.json({ error: "La pregunta cambió. Recarga antes de guardar." }, { status: 409 });
    if (error || !data) throw new Error("No se pudo guardar la corrección. Reintenta.");
    return Response.json({ question: { ...question, revision: data.updated_at, bank_revision: data.updated_at } });
  } catch {
    return Response.json({ error: "No se pudo acceder al banco o guardar el cambio. Reintenta; si persiste, contacta al administrador." }, { status: 500 });
  }
}
