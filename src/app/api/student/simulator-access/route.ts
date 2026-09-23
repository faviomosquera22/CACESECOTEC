import { getCurrentAuthContext } from "@/lib/auth";
import { getStudentSiteAccess, STUDENT_BLOCKED_MESSAGE } from "@/lib/studentAccess";

export const dynamic = "force-dynamic";

export async function GET() {
  const authContext = await getCurrentAuthContext();

  if (!authContext?.profile) {
    return Response.json({ error: "Sesión no válida." }, { status: 401 });
  }

  if (authContext.profile.role !== "student") {
    return Response.json(
      { error: "Esta verificación solo corresponde a estudiantes." },
      { status: 403 },
    );
  }

  const enabled = await getStudentSiteAccess(
    authContext.supabase,
    authContext.profile.id,
  );

  return Response.json(
    enabled ? { enabled } : { enabled, error: STUDENT_BLOCKED_MESSAGE },
    {
      status: enabled ? 200 : 403,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
