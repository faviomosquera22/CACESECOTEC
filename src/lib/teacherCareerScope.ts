import "server-only";

import { redirect } from "next/navigation";
import type { Profile } from "@/lib/database.types";
import { requireProfile } from "@/lib/auth";
import {
  getExactStudentCareerOption,
  type StudentCareerSlug,
} from "@/lib/studentCareer";

export type TeacherCareerScope = StudentCareerSlug;

export function getTeacherCareerScope(
  profile: Pick<Profile, "career" | "role">,
): TeacherCareerScope | null {
  if (profile.role !== "teacher") {
    return null;
  }

  return getExactStudentCareerOption(profile.career)?.slug ?? null;
}

export function isStudentInTeacherCareerScope(
  studentCareer: string | null | undefined,
  teacherCareerScope: TeacherCareerScope,
) {
  return getExactStudentCareerOption(studentCareer)?.slug === teacherCareerScope;
}

export async function requireTeacherCareerScope() {
  const context = await requireProfile(["teacher"]);
  const teacherCareerScope = getTeacherCareerScope(context.profile);

  if (!teacherCareerScope) {
    redirect("/login?error=teacher-career-missing");
  }

  return { ...context, teacherCareerScope };
}
