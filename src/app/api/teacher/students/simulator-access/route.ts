import { getCurrentAuthContext } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { getTeacherCareerScope } from "@/lib/teacherCareerScope";
import { getStudentCareerOption } from "@/lib/studentCareer";

type UpdateAccessBody = {
  enabled?: unknown;
};

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const authContext = await getCurrentAuthContext();

  if (!authContext?.profile) {
    return Response.json({ error: "Sesión no válida." }, { status: 401 });
  }

  if (authContext.profile.role !== "teacher") {
    return Response.json(
      { error: "Solo docentes pueden cambiar el acceso al simulador." },
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

  const teacherCareer = getStudentCareerOption(teacherCareerScope);

  if (!teacherCareer) {
    return Response.json(
      { error: "La carrera asignada al docente no es válida." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as UpdateAccessBody;

  if (typeof body.enabled !== "boolean") {
    return Response.json(
      { error: "El estado de acceso no es válido." },
      { status: 400 },
    );
  }

  const enabled = body.enabled;
  const teacherId = authContext.profile.id;

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

  const { data: students, error: studentsError } = await adminClient
    .from("profiles")
    .select("id")
    .eq("role", "student")
    .eq("career", teacherCareer.label)
    .returns<{ id: string }[]>();

  if (studentsError) {
    return Response.json(
      {
        error: "No se pudieron consultar los estudiantes de tu carrera.",
        details: studentsError.message,
      },
      { status: 500 },
    );
  }

  const accessRows = (students ?? []).map((student) => ({
    student_id: student.id,
    enabled,
    updated_at: new Date().toISOString(),
    updated_by: teacherId,
  }));

  if (accessRows.length > 0) {
    const { error: accessError } = await adminClient
      .from("student_simulator_access")
      .upsert(accessRows, { onConflict: "student_id" });

    if (accessError) {
      return Response.json(
        {
          error: "No se pudo actualizar el acceso de la clase.",
          details: accessError.message,
        },
        { status: 500 },
      );
    }
  }

  return Response.json({ enabled, updatedCount: accessRows.length });
}
