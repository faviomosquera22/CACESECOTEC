import { getCurrentAuthContext } from "@/lib/auth";
import { getTeacherCareerScope } from "@/lib/teacherCareerScope";
import { validateManualQuestion } from "@/lib/manualQuestions";

export const dynamic = "force-dynamic";

async function save(request: Request, editing: boolean) {
  const context = await getCurrentAuthContext();
  if (!context?.profile) return Response.json({ error: "Sesión no válida." }, { status: 401 });
  const career = getTeacherCareerScope(context.profile);
  if (!career) return Response.json({ error: "Solo docentes con carrera asignada pueden administrar preguntas." }, { status: 403 });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const body = await request.json().catch(() => null);
  let input;
  try { input = validateManualQuestion(body, career); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Datos inválidos." }, { status: 400 }); }
  if (editing && (typeof body.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.id))) {
    return Response.json({ error: "Identificador de pregunta inválido." }, { status: 400 });
  }
  const table = context.supabase.from("teacher_questions");
  const query = editing
    ? table.update({ ...input, updated_at: new Date().toISOString() }).eq("id", body.id).eq("teacher_id", context.profile.id).eq("career_slug", career)
    : table.insert({ ...input, teacher_id: context.profile.id, career_slug: career });
  const { data, error } = await query.select("*").maybeSingle();
  if (error) return Response.json({ error: "No se pudo guardar la pregunta. Reintenta; si persiste, contacta al administrador." }, { status: 500 });
  if (!data) return Response.json({ error: "No se encontró una pregunta tuya con ese identificador." }, { status: 404 });
  return Response.json({ question: data }, { status: editing ? 200 : 201 });
}

export async function POST(request: Request) { return save(request, false); }
export async function PATCH(request: Request) { return save(request, true); }
