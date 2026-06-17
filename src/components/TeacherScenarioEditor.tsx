"use client";

import { type FormEvent, useMemo, useState, useSyncExternalStore } from "react";
import { Pencil, Plus, Save, Trash2 } from "lucide-react";
import type { OptionLetter } from "@/lib/database.types";

type TeacherScenario = {
  id: string;
  title: string;
  category: string;
  difficulty: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: OptionLetter;
  updatedAt: string;
};

type TeacherScenarioForm = Omit<TeacherScenario, "id" | "updatedAt">;

const TEACHER_SCENARIOS_KEY = "teacher-scenarios:v1";
const TEACHER_SCENARIOS_UPDATED_EVENT = "teacher-scenarios-updated";
const emptyScenarioForm: TeacherScenarioForm = {
  title: "",
  category: "",
  difficulty: "Intermedio",
  questionText: "",
  optionA: "",
  optionB: "",
  optionC: "",
  optionD: "",
  correctOption: "A",
};

function readJsonArray<T>(value: string | null): T[] {
  if (!value) {
    return [];
  }

  try {
    return JSON.parse(value) as T[];
  } catch {
    return [];
  }
}

function subscribeToScenarioChanges(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(TEACHER_SCENARIOS_UPDATED_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(TEACHER_SCENARIOS_UPDATED_EVENT, onStoreChange);
  };
}

export function TeacherScenarioEditor() {
  const [scenarioForm, setScenarioForm] =
    useState<TeacherScenarioForm>(emptyScenarioForm);
  const [editingScenarioId, setEditingScenarioId] = useState<string | null>(
    null,
  );
  const rawScenarios = useSyncExternalStore(
    subscribeToScenarioChanges,
    () => window.localStorage.getItem(TEACHER_SCENARIOS_KEY) ?? "[]",
    () => "[]",
  );
  const scenarios = useMemo(
    () => readJsonArray<TeacherScenario>(rawScenarios),
    [rawScenarios],
  );

  function writeScenarios(nextScenarios: TeacherScenario[]) {
    window.localStorage.setItem(
      TEACHER_SCENARIOS_KEY,
      JSON.stringify(nextScenarios),
    );
    window.dispatchEvent(new Event(TEACHER_SCENARIOS_UPDATED_EVENT));
  }

  function saveScenario(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const now = new Date().toISOString();

    if (editingScenarioId) {
      writeScenarios(
        scenarios.map((scenario) =>
          scenario.id === editingScenarioId
            ? { ...scenario, ...scenarioForm, updatedAt: now }
            : scenario,
        ),
      );
    } else {
      writeScenarios([
        {
          ...scenarioForm,
          id: `scenario-${Date.now()}`,
          updatedAt: now,
        },
        ...scenarios,
      ]);
    }

    setScenarioForm(emptyScenarioForm);
    setEditingScenarioId(null);
  }

  function editScenario(scenario: TeacherScenario) {
    setScenarioForm({
      title: scenario.title,
      category: scenario.category,
      difficulty: scenario.difficulty,
      questionText: scenario.questionText,
      optionA: scenario.optionA,
      optionB: scenario.optionB,
      optionC: scenario.optionC,
      optionD: scenario.optionD,
      correctOption: scenario.correctOption,
    });
    setEditingScenarioId(scenario.id);
  }

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Plus className="h-5 w-5 text-sky-700" aria-hidden="true" />
        <h3 className="text-base font-semibold text-slate-950">
          Crear o editar escenarios
        </h3>
      </div>
      <form onSubmit={saveScenario} className="mt-4 grid gap-4 lg:grid-cols-2">
        <label className="text-sm font-semibold text-slate-600">
          Título del escenario
          <input
            value={scenarioForm.title}
            onChange={(event) =>
              setScenarioForm((form) => ({ ...form, title: event.target.value }))
            }
            required
            className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-950 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
          />
        </label>
        <label className="text-sm font-semibold text-slate-600">
          Categoría o módulo
          <input
            value={scenarioForm.category}
            onChange={(event) =>
              setScenarioForm((form) => ({
                ...form,
                category: event.target.value,
              }))
            }
            required
            className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-950 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
          />
        </label>
        <label className="text-sm font-semibold text-slate-600 lg:col-span-2">
          Pregunta o caso
          <textarea
            value={scenarioForm.questionText}
            onChange={(event) =>
              setScenarioForm((form) => ({
                ...form,
                questionText: event.target.value,
              }))
            }
            required
            rows={3}
            className="mt-2 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm leading-6 text-slate-950 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
          />
        </label>
        {(["A", "B", "C", "D"] as OptionLetter[]).map((option) => (
          <label key={option} className="text-sm font-semibold text-slate-600">
            Opción {option}
            <input
              value={
                scenarioForm[
                  `option${option}` as keyof Pick<
                    TeacherScenarioForm,
                    "optionA" | "optionB" | "optionC" | "optionD"
                  >
                ]
              }
              onChange={(event) =>
                setScenarioForm((form) => ({
                  ...form,
                  [`option${option}`]: event.target.value,
                }))
              }
              required
              className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-950 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            />
          </label>
        ))}
        <label className="text-sm font-semibold text-slate-600">
          Dificultad
          <select
            value={scenarioForm.difficulty}
            onChange={(event) =>
              setScenarioForm((form) => ({
                ...form,
                difficulty: event.target.value,
              }))
            }
            className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-950 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
          >
            <option>Básico</option>
            <option>Intermedio</option>
            <option>Avanzado</option>
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-600">
          Respuesta correcta
          <select
            value={scenarioForm.correctOption}
            onChange={(event) =>
              setScenarioForm((form) => ({
                ...form,
                correctOption: event.target.value as OptionLetter,
              }))
            }
            className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-950 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
          >
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
            <option value="D">D</option>
          </select>
        </label>
        <div className="flex flex-col gap-3 sm:flex-row lg:col-span-2">
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            {editingScenarioId ? "Guardar cambios" : "Crear escenario"}
          </button>
          {editingScenarioId ? (
            <button
              type="button"
              onClick={() => {
                setScenarioForm(emptyScenarioForm);
                setEditingScenarioId(null);
              }}
              className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Cancelar edición
            </button>
          ) : null}
        </div>
      </form>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {scenarios.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500 md:col-span-2">
            Aún no hay escenarios creados.
          </div>
        ) : (
          scenarios.map((scenario) => (
            <article
              key={scenario.id}
              className="rounded-lg border border-slate-100 bg-slate-50 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-slate-950">
                    {scenario.title}
                  </h4>
                  <p className="mt-1 text-xs text-slate-500">
                    {scenario.category} · {scenario.difficulty} · Correcta{" "}
                    {scenario.correctOption}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => editScenario(scenario)}
                    aria-label={`Editar ${scenario.title}`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      writeScenarios(
                        scenarios.filter((item) => item.id !== scenario.id),
                      )
                    }
                    aria-label={`Eliminar ${scenario.title}`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-700">
                {scenario.questionText}
              </p>
            </article>
          ))
        )}
      </div>
    </article>
  );
}
