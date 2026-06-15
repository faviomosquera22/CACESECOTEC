import { getCurrentAuthContext } from "@/lib/auth";
import type { Profile } from "@/lib/database.types";
import { getStudentCareerOption, studentCareerOptions } from "@/lib/studentCareer";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

type CreateStudentRequestBody = {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  careerSlug?: string;
};

export const dynamic = "force-dynamic";

function normalizeText(value?: string) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function normalizeEmail(value?: string) {
  return value?.trim().toLowerCase() ?? "";
}

function getAuthErrorMessage(message: string) {
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes("already") ||
    normalizedMessage.includes("registered") ||
    normalizedMessage.includes("exists")
  ) {
    return "Ese correo ya está registrado.";
  }

  if (normalizedMessage.includes("password")) {
    return "La contraseña no cumple los requisitos de Supabase.";
  }

  return "No se pudo crear el usuario en Supabase Auth.";
}

export async function POST(request: Request) {
  const authContext = await getCurrentAuthContext();

  if (!authContext?.profile) {
    return Response.json({ error: "Sesión no válida." }, { status: 401 });
  }

  if (authContext.profile.role !== "teacher") {
    return Response.json(
      { error: "Solo docentes pueden crear estudiantes." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as CreateStudentRequestBody;
  const firstName = normalizeText(body.firstName);
  const lastName = normalizeText(body.lastName);
  const email = normalizeEmail(body.email);
  const password = body.password ?? "";
  const career = studentCareerOptions.find(
    (option) => option.slug === body.careerSlug,
  );

  if (!firstName || !lastName) {
    return Response.json(
      { error: "Ingresa nombre y apellido del estudiante." },
      { status: 400 },
    );
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json(
      { error: "Ingresa un correo válido." },
      { status: 400 },
    );
  }

  if (password.length < 8) {
    return Response.json(
      { error: "La contraseña debe tener al menos 8 caracteres." },
      { status: 400 },
    );
  }

  if (!career) {
    return Response.json({ error: "Carrera no válida." }, { status: 400 });
  }

  const fullName = `${firstName} ${lastName}`;
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

  const { data: createdAuthUser, error: createUserError } =
    await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: "student",
        career: career.label,
      },
    });

  const authUser = createdAuthUser.user;

  if (createUserError || !authUser) {
    return Response.json(
      {
        error: getAuthErrorMessage(
          createUserError?.message ?? "No se pudo crear el usuario.",
        ),
        details: createUserError?.message,
      },
      { status: 400 },
    );
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .upsert(
      {
        id: authUser.id,
        full_name: fullName,
        email,
        role: "student",
        career: career.label,
      },
      { onConflict: "id" },
    )
    .select("id, full_name, email, role, career, created_at")
    .single<Profile>();

  if (profileError || !profile) {
    await adminClient.auth.admin.deleteUser(authUser.id).catch(() => null);

    return Response.json(
      {
        error: "No se pudo crear el perfil del estudiante.",
        details: profileError?.message,
      },
      { status: 500 },
    );
  }

  const profileCareer = getStudentCareerOption(profile.career);

  return Response.json(
    {
      student: {
        id: profile.id,
        fullName: profile.full_name || profile.email || "Sin nombre",
        email: profile.email || email,
        careerSlug: profileCareer?.slug ?? career.slug,
        careerLabel: profileCareer?.label ?? career.label,
        simulationsCount: 0,
        averageScore: 0,
        bestScore: 0,
        lastActivity: null,
      },
    },
    { status: 201 },
  );
}
