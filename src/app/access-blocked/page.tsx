import { LockKeyhole } from "lucide-react";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/LogoutButton";
import { getCurrentAuthContext, hasStudentSiteAccess } from "@/lib/auth";
import { getRoleHomePath } from "@/lib/routes";
import { STUDENT_BLOCKED_MESSAGE } from "@/lib/studentAccess";

export const dynamic = "force-dynamic";

export default async function AccessBlockedPage() {
  const context = await getCurrentAuthContext();

  if (!context?.profile) {
    redirect("/login");
  }

  if (
    context.profile.role !== "student" ||
    (await hasStudentSiteAccess(context.supabase, context.profile.id))
  ) {
    redirect(getRoleHomePath(context.profile.role));
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-10">
      <section className="w-full max-w-lg rounded-lg border border-amber-200 bg-white p-8 shadow-sm">
        <LockKeyhole className="h-10 w-10 text-amber-600" aria-hidden="true" />
        <h1 className="mt-5 text-2xl font-semibold text-slate-950">Acceso bloqueado</h1>
        <p className="mt-4 text-sm leading-6 text-slate-600">{STUDENT_BLOCKED_MESSAGE}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href="/access-blocked" className="inline-flex h-10 items-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white">
            Verificar acceso
          </a>
          <LogoutButton />
        </div>
      </section>
    </main>
  );
}
