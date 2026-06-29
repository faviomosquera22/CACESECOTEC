import "server-only";

import { redirect } from "next/navigation";
import { requireCompletedStudentProfile } from "@/lib/auth";
import type { SupabaseServerClient } from "@/lib/supabaseServer";

export async function getStudentSimulatorAccess(
  supabase: SupabaseServerClient,
  studentId: string,
) {
  const { data, error } = await supabase
    .from("student_simulator_access")
    .select("enabled")
    .eq("student_id", studentId)
    .maybeSingle<{ enabled: boolean }>();

  if (error) {
    return false;
  }

  return data?.enabled === true;
}

export async function requireStudentSimulatorAccess() {
  const context = await requireCompletedStudentProfile();
  const enabled = await getStudentSimulatorAccess(
    context.supabase,
    context.profile.id,
  );

  if (!enabled) {
    redirect("/student/dashboard?simulator=blocked");
  }

  return context;
}
