import type { ReactNode } from "react";
import { History, LayoutDashboard, UserRound } from "lucide-react";
import { AppShell, type NavItem } from "@/components/AppShell";
import { requireProfile } from "@/lib/auth";

const studentNavItems: NavItem[] = [
  {
    href: "/student/dashboard",
    label: "Dashboard",
    icon: <LayoutDashboard className="h-4 w-4" aria-hidden="true" />,
  },
  {
    href: "/student/profile",
    label: "Perfil",
    icon: <UserRound className="h-4 w-4" aria-hidden="true" />,
  },
  {
    href: "/student/history",
    label: "Historial",
    icon: <History className="h-4 w-4" aria-hidden="true" />,
  },
];

export default async function StudentLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { profile } = await requireProfile(["student"]);

  return (
    <AppShell profile={profile} navItems={studentNavItems}>
      {children}
    </AppShell>
  );
}
