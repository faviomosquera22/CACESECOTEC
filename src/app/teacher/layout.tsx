import type { ReactNode } from "react";
import { BarChart3, ClipboardList, LayoutDashboard, Users } from "lucide-react";
import { AppShell, type NavItem } from "@/components/AppShell";
import { requireProfile } from "@/lib/auth";

const teacherNavItems: NavItem[] = [
  {
    href: "/teacher/dashboard",
    label: "Dashboard",
    icon: <LayoutDashboard className="h-4 w-4" aria-hidden="true" />,
  },
  {
    href: "/teacher/students",
    label: "Estudiantes",
    icon: <Users className="h-4 w-4" aria-hidden="true" />,
  },
  {
    href: "/teacher/analytics",
    label: "Analíticas",
    icon: <BarChart3 className="h-4 w-4" aria-hidden="true" />,
  },
  {
    href: "/teacher/scenarios",
    label: "Escenarios",
    icon: <ClipboardList className="h-4 w-4" aria-hidden="true" />,
  },
];

export default async function TeacherLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { profile } = await requireProfile(["teacher"]);

  return (
    <AppShell profile={profile} navItems={teacherNavItems}>
      {children}
    </AppShell>
  );
}
