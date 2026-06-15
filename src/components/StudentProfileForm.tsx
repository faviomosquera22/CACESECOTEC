"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Save, UserRound } from "lucide-react";
import type { Profile } from "@/lib/database.types";
import { getStudentCareerOption } from "@/lib/studentCareer";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type StudentProfileFormProps = {
  profile: Profile;
  firstTime?: boolean;
};

export function StudentProfileForm({
  profile,
  firstTime = false,
}: StudentProfileFormProps) {
  const router = useRouter();
  const assignedCareer = getStudentCareerOption(profile.career);
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const normalizedFullName = fullName.trim();

    if (!normalizedFullName) {
      setError("Completa tu nombre para continuar.");
      return;
    }

    setIsPending(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ full_name: normalizedFullName })
        .eq("id", profile.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      setSuccess(
        assignedCareer
          ? "Perfil actualizado correctamente."
          : "Nombre guardado. La carrera debe ser asignada por el docente.",
      );
      router.refresh();

      if (firstTime && assignedCareer) {
        router.replace("/student/dashboard");
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "No se pudo actualizar el perfil.",
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700 ring-1 ring-sky-100">
          <UserRound className="h-6 w-6" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-xl font-semibold tracking-normal text-slate-950">
            Información del estudiante
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Estos datos se usarán para identificar tus simulaciones e historial.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <div>
          <label
            htmlFor="fullName"
            className="text-sm font-semibold text-slate-700"
          >
            Nombre completo
          </label>
          <input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
            className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-white px-4 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            placeholder="Ej. Ana López"
          />
        </div>

        <div>
          <label
            htmlFor="career"
            className="text-sm font-semibold text-slate-700"
          >
            Carrera
          </label>
          <input
            id="career"
            type="text"
            value={assignedCareer?.label ?? "Pendiente de asignación docente"}
            readOnly
            className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 text-slate-500 outline-none"
          />
          <p className="mt-2 text-xs text-slate-500">
            {assignedCareer
              ? "La carrera define tu simulador habilitado. Solicita al docente un cambio si fue asignada por error."
              : "Cuando el docente asigne tu carrera, se habilitará el simulador correspondiente."}
          </p>
        </div>

        <div className="md:col-span-2">
          <label
            htmlFor="email"
            className="text-sm font-semibold text-slate-700"
          >
            Correo
          </label>
          <input
            id="email"
            type="email"
            value={profile.email ?? ""}
            readOnly
            className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 text-slate-500 outline-none"
          />
          <p className="mt-2 text-xs text-slate-500">
            El correo se administra desde Supabase Auth.
          </p>
        </div>
      </div>

      {error ? (
        <div className="mt-5 flex gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{error}</p>
        </div>
      ) : null}

      {success ? (
        <div className="mt-5 flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          <CheckCircle2
            className="mt-0.5 h-4 w-4 shrink-0"
            aria-hidden="true"
          />
          <p>{success}</p>
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">
          {firstTime && !assignedCareer
            ? "Guarda tu nombre y espera la asignación de carrera para habilitar tu panel."
            : firstTime
              ? "Completa estos datos para habilitar tu panel."
              : "Puedes editar tu nombre cuando lo necesites."}
        </p>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          {isPending ? "Guardando..." : "Guardar perfil"}
        </button>
      </div>
    </form>
  );
}
