import { redirect } from "next/navigation";
import Image from "next/image";
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
    <main className="flex min-h-screen items-center justify-center bg-[#eef4f7] px-6 py-10">
      <section className="grid w-full max-w-5xl gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
        <div className="relative min-h-[440px] overflow-hidden rounded-lg bg-slate-950 p-8 text-white shadow-sm sm:p-10">
          <Image
            src="/images/login-study-illustration.png"
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 560px, 100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-slate-950/65" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,23,0.94)_0%,rgba(15,23,42,0.78)_45%,rgba(15,23,42,0.34)_100%)]" />

          <div className="relative flex h-full min-h-[376px] flex-col justify-end">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-sky-300 text-slate-950">
              <GraduationCap className="h-7 w-7" aria-hidden="true" />
            </div>
            <h1 className="mt-8 max-w-md text-4xl font-semibold leading-tight tracking-normal">
              CACES SIMULADOR
            </h1>
            <p className="mt-5 max-w-md text-base leading-7 text-slate-200">
              Acceso cerrado para estudiantes y docentes autorizados por el
              administrador.
            </p>
          </div>
        </div>

        <div className="flex items-center">
          <div className="w-full">
            <div className="mb-6">
              <Image
                src="/images/ecotec-logo.png"
                alt="Universidad Ecotec"
                width={258}
                height={100}
                priority
                className="mb-8 h-auto w-56 sm:w-64"
              />
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
