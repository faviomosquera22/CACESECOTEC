import type { Profile } from "@/lib/database.types";

export const demoStudentProfiles: Profile[] = [
  {
    id: "31bb10a4-3e16-4470-8d96-1c10f9210ea6",
    full_name: "Estudiante Tester",
    email: "tester.student@caces.local",
    role: "student",
    career: "Enfermería",
    created_at: null,
  },
];

export function getDemoStudentProfile(studentId: string) {
  return demoStudentProfiles.find((student) => student.id === studentId) ?? null;
}
