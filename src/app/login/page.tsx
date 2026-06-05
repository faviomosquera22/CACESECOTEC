import { redirect } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { LoginForm } from "@/components/LoginForm";
import { getCurrentAuthContext } from "@/lib/auth";
import { getRoleHomePath } from "@/lib/routes";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const context = await getCurrentAuthContext();

  if (context?.profile) {
    redirect(getRoleHomePath(context.profile.role));
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const initialError =
    resolvedSearchParams.error === "missing-profile"
      ? "Tu cuenta no tiene un perfil asignado. Contacta al administrador."
      : undefined;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-10">
      <section className="grid w-full max-w-5xl gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="rounded-lg bg-slate-950 p-8 text-white shadow-sm sm:p-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-sky-400 text-slate-950">
            <GraduationCap className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 className="mt-8 max-w-md text-4xl font-semibold leading-tight tracking-normal">
            Simulador CACES Privado
          </h1>
          <p className="mt-5 max-w-md text-base leading-7 text-slate-300">
            Acceso cerrado para estudiantes y docentes autorizados por el
            administrador.
          </p>
        </div>

        <div className="flex items-center">
          <div className="w-full">
            <div className="mb-6">
              <p className="text-sm font-semibold text-sky-700">
                Plataforma privada
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950">
                Iniciar sesión
              </h2>
            </div>
            <LoginForm initialError={initialError} />
          </div>
        </div>
      </section>
    </main>
  );
}
