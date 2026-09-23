import type { SupabaseServerClient } from "@/lib/supabaseServer";

export const STUDENT_BLOCKED_PATH = "/access-blocked";
export const STUDENT_BLOCKED_MESSAGE =
  "Tu cuenta está bloqueada. No puedes acceder al sitio, incluidos los reportes y el historial. Contacta a tu docente para que habilite tu acceso.";

// The existing teacher switch now controls access to the entire student site.
// Keep the persisted table name so current permissions remain authoritative.
export async function getStudentSiteAccess(
  supabase: SupabaseServerClient,
  studentId: string,
) {
  const { data, error } = await supabase
    .from("student_simulator_access")
    .select("enabled")
    .eq("student_id", studentId)
    .maybeSingle<{ enabled: boolean }>();

  return !error && data?.enabled === true;
}
