"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, LockKeyhole, LogIn, Mail } from "lucide-react";
import { getRoleHomePath } from "@/lib/routes";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type LoginFormProps = {
  initialError?: string;
};

function compactAuthMetadata({
  fullName,
  role,
}: {
  fullName: string | null;
  role: string;
}) {
  return {
    full_name: fullName,
    role,
    simulationDrafts: null,
    simulationSummaries: null,
    simulationResults: null,
  };
}

export function LoginForm({ initialError }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(initialError ?? "");
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsPending(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: signInData, error: signInError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (signInError) {
        throw new Error("Correo o contraseña incorrectos.");
      }

      if (!signInData.user) {
        throw new Error("No se pudo validar la sesión.");
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, role, full_name, email")
        .eq("id", signInData.user.id)
        .maybeSingle();

      if (profileError || !profile) {
        await supabase.auth.signOut();
        throw new Error(
          "Tu cuenta no tiene un perfil asignado. Contacta al administrador.",
        );
      }

      if (profile.role !== "student" && profile.role !== "teacher") {
        await supabase.auth.signOut();
        throw new Error("El perfil no tiene un rol válido.");
      }

      await supabase.auth.updateUser({
        data: compactAuthMetadata({
          fullName: profile.full_name,
          role: profile.role,
        }),
      });
      await supabase.auth.refreshSession();

      router.replace(getRoleHomePath(profile.role));
      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "No se pudo iniciar sesión.",
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div>
        <label
          htmlFor="email"
          className="text-sm font-semibold text-slate-700"
        >
          Correo
        </label>
        <div className="mt-2 flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 focus-within:border-sky-400 focus-within:ring-4 focus-within:ring-sky-100">
          <Mail className="h-5 w-5 text-slate-400" aria-hidden="true" />
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
            className="h-12 w-full bg-transparent text-slate-950 outline-none placeholder:text-slate-400"
            placeholder="correo@institucion.edu"
          />
        </div>
      </div>

      <div className="mt-5">
        <label
          htmlFor="password"
          className="text-sm font-semibold text-slate-700"
        >
          Contraseña
        </label>
        <div className="mt-2 flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 focus-within:border-sky-400 focus-within:ring-4 focus-within:ring-sky-100">
          <LockKeyhole className="h-5 w-5 text-slate-400" aria-hidden="true" />
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="current-password"
            className="h-12 w-full bg-transparent text-slate-950 outline-none placeholder:text-slate-400"
            placeholder="••••••••"
          />
        </div>
      </div>

      {error ? (
        <div className="mt-5 flex gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{error}</p>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <LogIn className="h-4 w-4" aria-hidden="true" />
        {isPending ? "Ingresando..." : "Iniciar sesión"}
      </button>
    </form>
  );
}
