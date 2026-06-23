import { redirect } from "next/navigation";
import type { Profile } from "@/lib/database.types";
import { requireProfile } from "@/lib/auth";
import type { StudentCareerSlug } from "@/lib/studentCareer";

export type TeacherCareerScope = StudentCareerSlug;

const teacherScopeByEmail: Record<string, TeacherCareerScope> = {
  "tester.teacher@caces.local": "enfermeria",
  "tester.psicologia@caces.local": "psicologia",
};

export function getTeacherCareerScope(
  profile: Pick<Profile, "email" | "role">,
): TeacherCareerScope | null {
  if (profile.role !== "teacher") {
    return null;
  }

  return teacherScopeByEmail[profile.email?.trim().toLowerCase() ?? ""] ?? null;
}

export async function requireTeacherCareerScope() {
  const context = await requireProfile(["teacher"]);
  const teacherCareerScope = getTeacherCareerScope(context.profile);

  if (!teacherCareerScope) {
    redirect("/login?error=teacher-career-missing");
  }

  return { ...context, teacherCareerScope };
}
