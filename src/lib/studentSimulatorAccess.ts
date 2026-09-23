import "server-only";

import { requireCompletedStudentProfile } from "@/lib/auth";

export async function requireStudentSimulatorAccess() {
  return requireCompletedStudentProfile();
}
