import { getCurrentAuthContext } from "@/lib/auth";
import type { Profile } from "@/lib/database.types";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

type DeleteStudentProfile = Pick<Profile, "id" | "full_name" | "email" | "role">;

export const dynamic = "force-dynamic";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function DELETE(
  _request: Request,
  context: {
    params: Promise<{
      studentId: string;
    }>;
  },
) {
  const authContext = await getCurrentAuthContext();

  if (!authContext?.profile) {
    return Response.json({ error: "Sesión no válida." }, { status: 401 });
  }

  if (authContext.profile.role !== "teacher") {
    return Response.json(
      { error: "Solo docentes pueden eliminar estudiantes." },
      { status: 403 },
    );
  }

  const { studentId } = await context.params;

  if (!isUuid(studentId)) {
    return Response.json({ error: "Estudiante no válido." }, { status: 400 });
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

  const { data: studentProfile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, full_name, email, role")
    .eq("id", studentId)
    .eq("role", "student")
    .maybeSingle<DeleteStudentProfile>();

  if (profileError) {
    return Response.json(
      {
        error: "No se pudo verificar el estudiante.",
        details: profileError.message,
      },
      { status: 500 },
    );
  }

  if (!studentProfile) {
    return Response.json(
      { error: "No se encontró un estudiante para eliminar." },
      { status: 404 },
    );
  }

  const { error: deleteUserError } =
    await adminClient.auth.admin.deleteUser(studentId);

  if (deleteUserError) {
    return Response.json(
      {
        error: "No se pudo eliminar el usuario del estudiante.",
        details: deleteUserError.message,
      },
      { status: 500 },
    );
  }

  return Response.json({
    student: {
      id: studentProfile.id,
      fullName: studentProfile.full_name || studentProfile.email || "Sin nombre",
      email: studentProfile.email,
    },
  });
}
