import { getCurrentAuthContext } from "@/lib/auth";
import type { Profile } from "@/lib/database.types";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { getTeacherCareerScope } from "@/lib/teacherCareerScope";
import { getStudentCareerOption } from "@/lib/studentCareer";

type UpdateAccessBody = {
  enabled?: unknown;
};

type StudentScopeProfile = Pick<Profile, "id" | "role" | "career">;

export const dynamic = "force-dynamic";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ studentId: string }> },
) {
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

  const { studentId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as UpdateAccessBody;

  if (!isUuid(studentId)) {
    return Response.json({ error: "Estudiante no válido." }, { status: 400 });
  }

  if (typeof body.enabled !== "boolean") {
    return Response.json(
      { error: "El estado de acceso no es válido." },
      { status: 400 },
    );
  }

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

  const { data: student, error: studentError } = await adminClient
    .from("profiles")
    .select("id, role, career")
    .eq("id", studentId)
    .eq("role", "student")
    .maybeSingle<StudentScopeProfile>();

  if (studentError) {
    return Response.json(
      {
        error: "No se pudo verificar el estudiante.",
        details: studentError.message,
      },
      { status: 500 },
    );
  }

  if (!student) {
    return Response.json(
      { error: "No se encontró el estudiante." },
      { status: 404 },
    );
  }

  if (getStudentCareerOption(student.career)?.slug !== teacherCareerScope) {
    return Response.json(
      { error: "No puedes cambiar el acceso de estudiantes de otra carrera." },
      { status: 403 },
    );
  }

  const { error: accessError } = await adminClient
    .from("student_simulator_access")
    .upsert(
      {
        student_id: student.id,
        enabled: body.enabled,
        updated_at: new Date().toISOString(),
        updated_by: authContext.profile.id,
      },
      { onConflict: "student_id" },
    );

  if (accessError) {
    return Response.json(
      {
        error: "No se pudo actualizar el acceso al simulador.",
        details: accessError.message,
      },
      { status: 500 },
    );
  }

  return Response.json({ studentId: student.id, enabled: body.enabled });
}
