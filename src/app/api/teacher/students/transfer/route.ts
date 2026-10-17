import { getCurrentAuthContext } from "@/lib/auth";
import type { Profile } from "@/lib/database.types";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { getTeacherCareerScope, isStudentInTeacherCareerScope } from "@/lib/teacherCareerScope";

export const dynamic = "force-dynamic";

async function authorize(request: Request) {
  const context = await getCurrentAuthContext();
  if (!context?.profile) {
    return { error: Response.json({ error: "Sesión no válida." }, { status: 401 }) } as const;
  }
  const career = getTeacherCareerScope(context.profile);
  if (!career) {
    return { error: Response.json({ error: "Solo docentes con una carrera asignada pueden trasladar estudiantes." }, { status: 403 }) } as const;
  }
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return { error: Response.json({ error: "Origen no permitido." }, { status: 403 }) } as const;
  }
  return { teacherId: context.profile.id, career } as const;
}

export async function GET(request: Request) {
  const auth = await authorize(request);
  if (auth.error) return auth.error;
  try {
    const { data, error } = await getSupabaseAdminClient()
      .from("profiles")
      .select("id, full_name, email, role, career")
      .eq("role", "teacher")
      .neq("id", auth.teacherId)
      .order("full_name", { ascending: true });
    if (error) throw error;
    return Response.json({
      teachers: (data ?? [])
        .filter((teacher) => getTeacherCareerScope(teacher) === auth.career)
        .map((teacher) => ({ id: teacher.id, name: teacher.full_name || teacher.email || "Docente", email: teacher.email })),
    });
  } catch {
    return Response.json({ error: "No se pudo cargar la lista de docentes. Intenta nuevamente." }, { status: 500 });
  }
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const auth = await authorize(request);
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => null);
  if (!body || typeof body.teacherId !== "string" || !uuidPattern.test(body.teacherId) ||
      !Array.isArray(body.studentIds) || body.studentIds.length === 0 || body.studentIds.length > 100 ||
      !body.studentIds.every((id: unknown) => typeof id === "string" && uuidPattern.test(id))) {
    return Response.json({ error: "Selecciona un docente y entre 1 y 100 estudiantes." }, { status: 400 });
  }
  if (body.teacherId === auth.teacherId) {
    return Response.json({ error: "Selecciona otro docente." }, { status: 400 });
  }
  const studentIds = [...new Set<string>(body.studentIds)];
  try {
    const admin = getSupabaseAdminClient();
    const { data: target, error: targetError } = await admin.from("profiles")
      .select("id, role, career")
      .eq("id", body.teacherId).eq("role", "teacher").maybeSingle();
    if (targetError) throw targetError;
    if (!target || getTeacherCareerScope(target) !== auth.career) {
      return Response.json({ error: "El docente receptor debe pertenecer a tu misma carrera." }, { status: 403 });
    }
    const { data: students, error: readError } = await admin.from("profiles")
      .select("id, career")
      .in("id", studentIds).eq("role", "student").eq("created_by_teacher_id", auth.teacherId);
    if (readError) throw readError;
    if (!students || students.length !== studentIds.length ||
        students.some((student) => !isStudentInTeacherCareerScope(student.career, auth.career))) {
      return Response.json({ error: "Solo puedes trasladar estudiantes de tu lista y de tu carrera. Actualiza la lista e intenta nuevamente." }, { status: 403 });
    }
    // Recheck ownership in the write so concurrent transfers cannot take students
    // from a teacher who has just received them. No account or history is recreated.
    const { data: transferred, error: updateError } = await admin.from("profiles")
      .update({ created_by_teacher_id: target.id })
      .in("id", studentIds).eq("role", "student").eq("created_by_teacher_id", auth.teacherId)
      .in("career", [...new Set(students.map((student) => student.career as NonNullable<Profile["career"]>))])
      .select("id");
    if (updateError) throw updateError;
    if (!transferred?.length) {
      return Response.json({ error: "La asignación de los estudiantes cambió. Actualiza la lista e intenta nuevamente." }, { status: 409 });
    }
    return Response.json({ studentIds: transferred.map((student) => student.id), updatedCount: transferred.length });
  } catch {
    return Response.json({ error: "No se pudo completar el traslado. Actualiza la lista antes de intentar nuevamente." }, { status: 500 });
  }
}
