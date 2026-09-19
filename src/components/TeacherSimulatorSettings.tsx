"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Flag,
  Loader2,
  Save,
  SlidersHorizontal,
} from "lucide-react";
import type { StudentCareerSlug } from "@/lib/studentCareer";
import {
  getSimulatorSettingsCatalog,
  sanitizeSimulatorSettings,
  type SimulatorPhaseKey,
  type SimulatorSettings,
} from "@/lib/simulatorSettingsCatalog";

type TeacherSimulatorSettingsProps = {
  career: StudentCareerSlug;
  initialSettings: SimulatorSettings;
  totalQuestionCount: number;
};

type SettingsResponse = {
  settings?: {
    enabledDifficulties?: unknown;
    enabledCategories?: unknown;
    enabledPhases?: unknown;
    updatedAt?: unknown;
  };
  error?: string;
};

function SwitchControl({
  checked,
  disabled,
  label,
  description,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  description: string;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={`flex w-full items-center justify-between gap-4 rounded-lg border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
        checked
          ? "border-sky-200 bg-sky-50"
          : "border-slate-200 bg-white hover:bg-slate-50"
      }`}
    >
      <span>
        <span
          className={`block text-sm font-semibold ${
            checked ? "text-sky-950" : "text-slate-700"
          }`}
        >
          {label}
        </span>
        <span className="mt-1 block text-xs leading-5 text-slate-500">
          {description}
        </span>
      </span>
      <span
        aria-hidden="true"
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          checked ? "bg-sky-700" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition ${
            checked ? "left-6" : "left-1"
          }`}
        />
      </span>
    </button>
  );
}

export function TeacherSimulatorSettings({
  career,
  initialSettings,
  totalQuestionCount,
}: TeacherSimulatorSettingsProps) {
  const catalog = getSimulatorSettingsCatalog(career);
  const sanitizedInitialSettings = useMemo(
    () => sanitizeSimulatorSettings(career, initialSettings),
    [career, initialSettings],
  );
  const [enabledPhases, setEnabledPhases] = useState<SimulatorPhaseKey[]>(
    sanitizedInitialSettings.enabledPhases,
  );
  const [savedSettings, setSavedSettings] = useState(sanitizedInitialSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const hasUnsavedChanges =
    [...enabledPhases].sort().join("|") !==
      [...savedSettings.enabledPhases].sort().join("|");
  const hasValidSelection = enabledPhases.length > 0;

  function togglePhase(phase: SimulatorPhaseKey) {
    setEnabledPhases((current) =>
      current.includes(phase)
        ? current.filter((item) => item !== phase)
        : [...current, phase],
    );
    setMessage("");
    setError("");
  }

  async function saveSettings() {
    if (!hasValidSelection || isSaving) {
      return;
    }

    setIsSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/teacher/simulator-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabledPhases,
        }),
      });
      const payload = (await response
        .json()
        .catch(() => null)) as SettingsResponse | null;

      if (!response.ok || !payload?.settings) {
        throw new Error(
          payload?.error ?? "No se pudo guardar la configuración.",
        );
      }

      const nextSettings = sanitizeSimulatorSettings(
        career,
        payload.settings,
      );
      setEnabledPhases(nextSettings.enabledPhases);
      setSavedSettings(nextSettings);
      setMessage(
        "Configuración guardada. Se aplicará a los próximos intentos de los estudiantes.",
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "No se pudo guardar la configuración.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700 ring-1 ring-sky-100">
            <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold text-sky-700">
              Configuración previa
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-normal text-slate-950">
              Preguntas del simulador
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Define qué preguntas estarán disponibles en los próximos intentos
              de los estudiantes de tu carrera.
            </p>
          </div>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
          Banco: {totalQuestionCount.toLocaleString("es-EC")} preguntas
          <span className="mx-1 text-slate-300" aria-hidden="true">
            ·
          </span>
          {` · ${enabledPhases.length} de ${catalog.phases.length} componentes`}
        </div>
      </div>

      <div className="mt-6 space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-sky-700" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-slate-950">
              Componentes permitidos
            </h3>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Las preguntas del simulador se seleccionan únicamente de los
            componentes que mantengas activos.
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {catalog.phases.map((phase) => (
              <SwitchControl
                key={phase.key}
                checked={enabledPhases.includes(phase.key)}
                disabled={isSaving}
                label={phase.label}
                description={phase.description}
                onChange={() => togglePhase(phase.key)}
              />
            ))}
          </div>
        </div>

      </div>

      {!hasValidSelection ? (
        <div className="mt-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertCircle
            className="mt-0.5 h-4 w-4 shrink-0"
            aria-hidden="true"
          />
          Selecciona al menos un componente.
        </div>
      ) : null}

      <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div aria-live="polite">
          {message ? (
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="flex items-center gap-2 text-sm font-medium text-red-700">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              {error}
            </p>
          ) : null}
          {!message && !error && hasUnsavedChanges ? (
            <p className="text-sm text-amber-700">Hay cambios sin guardar.</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void saveSettings()}
          disabled={!hasValidSelection || !hasUnsavedChanges || isSaving}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="h-4 w-4" aria-hidden="true" />
          )}
          {isSaving ? "Guardando..." : "Guardar configuración"}
        </button>
      </div>
    </section>
  );
}
