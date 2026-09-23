import { redirect } from "next/navigation";
import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import type { Profile, ProfileRole } from "@/lib/database.types";
import { getRoleHomePath } from "@/lib/routes";
import {
  createSupabaseServerClient,
  type SupabaseServerClient,
} from "@/lib/supabaseServer";
import { isSupportedStudentCareer } from "@/lib/studentCareer";
import { getStudentSiteAccess, STUDENT_BLOCKED_PATH } from "@/lib/studentAccess";

export type AuthContext = {
  supabase: SupabaseServerClient;
  user: User;
  profile: Profile | null;
};

export type AuthenticatedContext = AuthContext & {
  profile: Profile;
};

export const hasStudentSiteAccess = cache(getStudentSiteAccess);

export function isStudentProfileComplete(profile: Profile) {
  if (profile.role !== "student") {
    return true;
  }

  return Boolean(
    profile.full_name?.trim() && isSupportedStudentCareer(profile.career),
  );
}

export const getCurrentAuthContext = cache(
  async (): Promise<AuthContext | null> => {
    const supabase = await createSupabaseServerClient();

    if (!supabase) {
      return null;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return null;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "id, full_name, email, role, career, created_by_teacher_id, created_at",
      )
      .eq("id", user.id)
      .maybeSingle();

    return { supabase, user, profile };
  },
);

export async function requireProfile(
  allowedRoles?: ProfileRole[],
): Promise<AuthenticatedContext> {
  const context = await getCurrentAuthContext();

  if (!context) {
    redirect("/login");
  }

  if (!context.profile) {
    await context.supabase.auth.signOut();
    redirect("/login?error=missing-profile");
  }

  if (
    context.profile.role === "student" &&
    !(await hasStudentSiteAccess(context.supabase, context.profile.id))
  ) {
    redirect(STUDENT_BLOCKED_PATH);
  }

  if (allowedRoles && !allowedRoles.includes(context.profile.role)) {
    redirect(getRoleHomePath(context.profile.role));
  }

  return context as AuthenticatedContext;
}

export async function requireCompletedStudentProfile() {
  const context = await requireProfile(["student"]);

  if (!isStudentProfileComplete(context.profile)) {
    redirect("/student/profile?firstTime=1");
  }

  return context;
}
