import { getCurrentAuthContext } from "@/lib/auth";
import { getStudentSimulatorAccess } from "@/lib/studentSimulatorAccess";

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

  const enabled = await getStudentSimulatorAccess(
    authContext.supabase,
    authContext.profile.id,
  );

  return Response.json(
    { enabled },
    { headers: { "Cache-Control": "no-store" } },
  );
}
