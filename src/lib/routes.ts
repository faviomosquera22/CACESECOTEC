import type { ProfileRole } from "@/lib/database.types";

export function getRoleHomePath(role: ProfileRole) {
  return role === "teacher" ? "/teacher/dashboard" : "/student/dashboard";
}
