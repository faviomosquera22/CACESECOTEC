import { getCurrentAuthContext } from "@/lib/auth";
import type { Profile } from "@/lib/database.types";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  getTeacherCareerScope,
  isStudentInTeacherCareerScope,
} from "@/lib/teacherCareerScope";

type DeleteStudentProfile = Pick<
  Profile,
  "id" | "full_name" | "email" | "role" | "career"
>;

type UpdateStudentEmailRequestBody = {
  email?: string;
};

export const dynamic = "force-dynamic";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function normalizeEmail(value?: string) {
  return value?.trim().toLowerCase() ?? "";
}

function getUpdateEmailErrorMessage(message: string) {
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes("already") ||
    normalizedMessage.includes("registered") ||
    normalizedMessage.includes("exists") ||
    normalizedMessage.includes("duplicate")
  ) {
    return "Ese correo ya está registrado.";
  }

  return "No se pudo actualizar el correo del estudiante.";
}

async function getEditableStudent({
  adminClient,
  studentId,
  teacherCareerScope,
}: {
  adminClient: ReturnType<typeof getSupabaseAdminClient>;
  studentId: string;
  teacherCareerScope: NonNullable<ReturnType<typeof getTeacherCareerScope>>;
}) {
  const { data: studentProfile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, full_name, email, role, career")
    .eq("id", studentId)
    .eq("role", "student")
    .maybeSingle<DeleteStudentProfile>();

  if (profileError) {
    return {
      response: Response.json(
        {
          error: "No se pudo verificar el estudiante.",
          details: profileError.message,
        },
        { status: 500 },
      ),
      studentProfile: null,
    };
  }

  if (!studentProfile) {
    return {
      response: Response.json(
        { error: "No se encontró el estudiante." },
        { status: 404 },
      ),
      studentProfile: null,
    };
  }

  if (!isStudentInTeacherCareerScope(studentProfile.career, teacherCareerScope)) {
    return {
      response: Response.json(
        { error: "No puedes editar estudiantes de otra carrera." },
        { status: 403 },
      ),
      studentProfile: null,
    };
  }

  return { response: null, studentProfile };
}

export async function PATCH(
  request: Request,
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
      { error: "Solo docentes pueden editar estudiantes." },
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

  if (!isUuid(studentId)) {
    return Response.json({ error: "Estudiante no válido." }, { status: 400 });
  }

  const body = (await request
    .json()
    .catch(() => ({}))) as UpdateStudentEmailRequestBody;
  const email = normalizeEmail(body.email);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json(
      { error: "Ingresa un correo válido." },
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

  const { response, studentProfile } = await getEditableStudent({
    adminClient,
    studentId,
    teacherCareerScope,
  });

  if (response) {
    return response;
  }

  if (studentProfile.email?.toLowerCase() === email) {
    return Response.json({
      student: {
        id: studentProfile.id,
        fullName: studentProfile.full_name || studentProfile.email || "Sin nombre",
        email: studentProfile.email,
      },
    });
  }

  const { data: existingProfile, error: existingProfileError } = await adminClient
    .from("profiles")
    .select("id")
    .eq("email", email)
    .neq("id", studentId)
    .maybeSingle<Pick<Profile, "id">>();

  if (existingProfileError) {
    return Response.json(
      {
        error: "No se pudo validar si el correo ya existe.",
        details: existingProfileError.message,
      },
      { status: 500 },
    );
  }

  if (existingProfile) {
    return Response.json(
      { error: "Ese correo ya está registrado." },
      { status: 400 },
    );
  }

  const { error: updateAuthError } =
    await adminClient.auth.admin.updateUserById(studentId, {
      email,
      email_confirm: true,
      user_metadata: {
        full_name: studentProfile.full_name,
        role: "student",
        career: studentProfile.career,
      },
    });

  if (updateAuthError) {
    return Response.json(
      {
        error: getUpdateEmailErrorMessage(updateAuthError.message),
        details: updateAuthError.message,
      },
      { status: 400 },
    );
  }

  const { data: updatedProfile, error: updateProfileError } = await adminClient
    .from("profiles")
    .update({ email })
    .eq("id", studentId)
    .eq("role", "student")
    .select("id, full_name, email, role, career")
    .single<DeleteStudentProfile>();

  if (updateProfileError || !updatedProfile) {
    return Response.json(
      {
        error:
          "El correo se actualizó en Auth, pero no se pudo actualizar el perfil.",
        details: updateProfileError?.message,
      },
      { status: 500 },
    );
  }

  return Response.json({
    student: {
      id: updatedProfile.id,
      fullName: updatedProfile.full_name || updatedProfile.email || "Sin nombre",
      email: updatedProfile.email,
    },
  });
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

  const teacherCareerScope = getTeacherCareerScope(authContext.profile);

  if (!teacherCareerScope) {
    return Response.json(
      { error: "Tu cuenta docente no tiene una carrera asignada." },
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

  const { response, studentProfile } = await getEditableStudent({
    adminClient,
    studentId,
    teacherCareerScope,
  });

  if (response) {
    return response;
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
