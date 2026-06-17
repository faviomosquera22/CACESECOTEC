import type { ReactNode } from "react";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import type { Profile } from "@/lib/database.types";
import { ContentProtection } from "@/components/ContentProtection";
import { LogoutButton } from "@/components/LogoutButton";

export type NavItem = {
  href: string;
  label: string;
  icon?: ReactNode;
};

type AppShellProps = {
  profile: Profile;
  navItems: NavItem[];
  children: ReactNode;
};

export function AppShell({ profile, navItems, children }: AppShellProps) {
  const displayName = profile.full_name || profile.email || "Usuario";
  const roleLabel = profile.role === "teacher" ? "Docente" : "Estudiante";

  return (
    <div className="protected-interaction-surface min-h-screen bg-slate-50 text-slate-950">
      <a
        href="#contenido-principal"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-slate-950 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Saltar al contenido principal
      </a>
      <ContentProtection
        userId={profile.id}
        userName={profile.full_name}
        userEmail={profile.email}
      />
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-950 text-white shadow-sm">
              <GraduationCap className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <p className="text-base font-semibold text-slate-950">
                Simulador CACES Privado
              </p>
              <p className="text-sm text-slate-500">{roleLabel}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <nav className="flex flex-wrap gap-2">
              {navItems.map((item) => (
                <Link
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-800"
                >
                  {item.icon}
                  {item.label}
                </Link>
              ))}
            </nav>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main id="contenido-principal" className="mx-auto w-full max-w-7xl px-6 py-8">
        <div className="mb-8 flex flex-col gap-1">
          <p className="text-sm font-medium text-slate-500">Sesión activa</p>
          <h1 className="text-2xl font-semibold tracking-normal text-slate-950">
            {displayName}
          </h1>
        </div>
        {children}
      </main>
    </div>
  );
}
