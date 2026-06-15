import { getCurrentAuthContext } from "@/lib/auth";
import { studentCareerOptions } from "@/lib/studentCareer";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

type AssignStudentCareerResult = {
  id: string;
  career: string | null;
};

type AssignCareerRequestBody = {
  careerSlug?: string;
};

export const dynamic = "force-dynamic";

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
      { error: "Solo docentes pueden asignar carreras." },
      { status: 403 },
    );
  }

  const { studentId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as AssignCareerRequestBody;
  const career = studentCareerOptions.find(
    (option) => option.slug === body.careerSlug,
  );

  if (!career) {
    return Response.json({ error: "Carrera no válida." }, { status: 400 });
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

  const { data: updatedProfile, error } = await adminClient
    .from("profiles")
    .update({ career: career.label })
    .eq("id", studentId)
    .eq("role", "student")
    .select("id, career")
    .single<AssignStudentCareerResult>();

  if (error) {
    return Response.json(
      {
        error: "No se pudo registrar la carrera.",
        details: error.message,
      },
      { status: 500 },
    );
  }

  if (!updatedProfile) {
    return Response.json(
      { error: "No se encontró un estudiante para actualizar." },
      { status: 404 },
    );
  }

  return Response.json({
    id: updatedProfile.id,
    career: updatedProfile.career,
  });
}
