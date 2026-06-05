import type { ReactNode } from "react";
import type { ProfileRole } from "@/lib/database.types";
import { requireProfile } from "@/lib/auth";

type ProtectedRouteProps = {
  allowedRoles?: ProfileRole[];
  children: ReactNode;
};

export async function ProtectedRoute({
  allowedRoles,
  children,
}: ProtectedRouteProps) {
  await requireProfile(allowedRoles);
  return <>{children}</>;
}
