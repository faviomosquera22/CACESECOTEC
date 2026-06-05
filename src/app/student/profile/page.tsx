import { UserRound } from "lucide-react";
import { StudentProfileForm } from "@/components/StudentProfileForm";
import { requireProfile } from "@/lib/auth";

type StudentProfilePageProps = {
  searchParams?: Promise<{
    firstTime?: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function StudentProfilePage({
  searchParams,
}: StudentProfilePageProps) {
  const { profile } = await requireProfile(["student"]);
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const firstTime = resolvedSearchParams.firstTime === "1";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section>
        <p className="text-sm font-semibold text-sky-700">
          {firstTime ? "Primer ingreso" : "Perfil"}
        </p>
        <div className="mt-2 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-950 text-white shadow-sm">
            <UserRound className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2 className="text-3xl font-semibold tracking-normal text-slate-950">
            {firstTime ? "Completa tu perfil" : "Editar perfil"}
          </h2>
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-500">
          Mantén tus datos básicos actualizados para que el docente pueda
          identificar correctamente tu historial.
        </p>
      </section>

      <StudentProfileForm profile={profile} firstTime={firstTime} />
    </div>
  );
}
