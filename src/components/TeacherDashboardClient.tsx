"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  Activity,
  AlertCircle,
  ArrowDownUp,
  CalendarClock,
  ClipboardList,
  Loader2,
  Search,
  Trash2,
  TrendingUp,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import type { StudentCardData } from "@/components/StudentCard";
import { StatCard } from "@/components/StatCard";
import type { SimulationHistoryRecord } from "@/components/SimulationHistoryTable";
import { average, formatDate, formatScore } from "@/lib/format";
import {
  getLocalSimulationIndexKey,
  subscribeToLocalSimulationChanges,
} from "@/lib/localSimulationStorage";
import {
  studentCareerOptions,
  type StudentCareerSlug,
} from "@/lib/studentCareer";

type TeacherDashboardClientProps = {
  students: StudentCardData[];
  showSummaryCards?: boolean;
};

type CareerFilter = "all" | StudentCareerSlug;
type ActivityFilter = "all" | "active" | "inactive" | "low-score";
type SortKey = "name" | "average" | "lastActivity" | "simulations";
type CareerOverride = {
  careerSlug: StudentCareerSlug;
  careerLabel: string;
};
type CreateStudentForm = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  careerSlug: StudentCareerSlug;
};
type CreateStudentResponse = {
  student?: StudentCardData;
  error?: string;
  details?: string;
};
type DeleteStudentResponse = {
  student?: {
    id: string;
    fullName: string;
    email: string | null;
  };
  error?: string;
  details?: string;
};

const initialCreateStudentForm: CreateStudentForm = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  careerSlug: "enfermeria",
};

function readLocalSimulations(studentId: string) {
  if (typeof window === "undefined") {
    return [];
  }

  const rawValue = window.localStorage.getItem(
    getLocalSimulationIndexKey(studentId),
  );

  if (!rawValue) {
    return [];
  }

  try {
    return JSON.parse(rawValue) as SimulationHistoryRecord[];
  } catch {
    return [];
  }
}

function getLatestDate(values: Array<string | null | undefined>) {
  return (
    values
      .filter((value): value is string => Boolean(value))
      .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())
      .at(0) ?? null
  );
}

function getStudentStatus(student: StudentCardData) {
  if (student.simulationsCount === 0) {
    return {
      label: "Sin intentos",
      className: "bg-slate-100 text-slate-600",
    };
  }

  if (student.averageScore < 50) {
    return {
      label: "Puntaje bajo",
      className: "bg-red-50 text-red-700",
    };
  }

  return {
    label: "Activo",
    className: "bg-emerald-50 text-emerald-700",
  };
}

function getDateTime(value: string | null) {
  return value ? new Date(value).getTime() : 0;
}

export function TeacherDashboardClient({
  students,
  showSummaryCards = true,
}: TeacherDashboardClientProps) {
  const router = useRouter();
  const [createdStudents, setCreatedStudents] = useState<StudentCardData[]>([]);
  const [careerOverrides, setCareerOverrides] = useState<
    Record<string, CareerOverride>
  >({});
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createStudentForm, setCreateStudentForm] =
    useState<CreateStudentForm>(initialCreateStudentForm);
  const [creatingStudent, setCreatingStudent] = useState(false);
  const [createStudentError, setCreateStudentError] = useState("");
  const [createStudentMessage, setCreateStudentMessage] = useState("");
  const [deletedStudentIds, setDeletedStudentIds] = useState<string[]>([]);
  const [studentToDelete, setStudentToDelete] =
    useState<StudentCardData | null>(null);
  const [deletingStudentId, setDeletingStudentId] = useState<string | null>(
    null,
  );
  const [deleteStudentError, setDeleteStudentError] = useState("");
  const [deleteStudentMessage, setDeleteStudentMessage] = useState("");
  const [query, setQuery] = useState("");
  const [careerFilter, setCareerFilter] = useState<CareerFilter>("all");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("lastActivity");
  const [savingCareerStudentId, setSavingCareerStudentId] = useState<
    string | null
  >(null);
  const [careerError, setCareerError] = useState("");

  const studentsState = useMemo(() => {
    const studentsById = new Map<string, StudentCardData>();
    const deletedIds = new Set(deletedStudentIds);

    [...createdStudents, ...students].forEach((student) => {
      if (deletedIds.has(student.id)) {
        return;
      }

      studentsById.set(student.id, {
        ...student,
        ...(careerOverrides[student.id] ?? {}),
      });
    });

    return Array.from(studentsById.values());
  }, [careerOverrides, createdStudents, deletedStudentIds, students]);

  const localStorageSnapshot = useSyncExternalStore(
    subscribeToLocalSimulationChanges,
    () =>
      JSON.stringify(
        studentsState.map((student) =>
          window.localStorage.getItem(getLocalSimulationIndexKey(student.id)),
        ),
      ),
    () => "[]",
  );

  const studentsWithResults = useMemo(() => {
    void localStorageSnapshot;

    return studentsState.map((student) => {
      const localSimulations = readLocalSimulations(student.id);

      if (localSimulations.length === 0) {
        return student;
      }

      const totalSimulations = student.simulationsCount + localSimulations.length;
      const localScoreTotal = localSimulations.reduce(
        (total, simulation) => total + (simulation.score ?? 0),
        0,
      );
      const serverScoreTotal = student.averageScore * student.simulationsCount;
      const localBestScore = Math.max(
        0,
        ...localSimulations.map((simulation) => simulation.score ?? 0),
      );
      const latestLocalSimulation = localSimulations[0] ?? null;

      return {
        ...student,
        simulationsCount: totalSimulations,
        averageScore:
          totalSimulations > 0
            ? (serverScoreTotal + localScoreTotal) / totalSimulations
            : 0,
        bestScore: Math.max(student.bestScore, localBestScore),
        lastActivity: getLatestDate([
          student.lastActivity,
          latestLocalSimulation?.finished_at,
          latestLocalSimulation?.created_at,
        ]),
      };
    });
  }, [localStorageSnapshot, studentsState]);

  const careerFilteredStudents = useMemo(() => {
    if (careerFilter === "all") {
      return studentsWithResults;
    }

    return studentsWithResults.filter(
      (student) => student.careerSlug === careerFilter,
    );
  }, [careerFilter, studentsWithResults]);

  const activityFilteredStudents = useMemo(() => {
    if (activityFilter === "active") {
      return careerFilteredStudents.filter(
        (student) => student.simulationsCount > 0,
      );
    }

    if (activityFilter === "inactive") {
      return careerFilteredStudents.filter(
        (student) => student.simulationsCount === 0,
      );
    }

    if (activityFilter === "low-score") {
      return careerFilteredStudents.filter(
        (student) =>
          student.simulationsCount > 0 && student.averageScore < 50,
      );
    }

    return careerFilteredStudents;
  }, [activityFilter, careerFilteredStudents]);

  const filteredStudents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return activityFilteredStudents;
    }

    return activityFilteredStudents.filter((student) => {
      return (
        student.fullName.toLowerCase().includes(normalizedQuery) ||
        student.email.toLowerCase().includes(normalizedQuery) ||
        student.careerLabel.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [activityFilteredStudents, query]);

  const sortedStudents = useMemo(() => {
    return [...filteredStudents].sort((left, right) => {
      if (sortKey === "average") {
        return right.averageScore - left.averageScore;
      }

      if (sortKey === "simulations") {
        return right.simulationsCount - left.simulationsCount;
      }

      if (sortKey === "lastActivity") {
        return getDateTime(right.lastActivity) - getDateTime(left.lastActivity);
      }

      return left.fullName.localeCompare(right.fullName);
    });
  }, [filteredStudents, sortKey]);

  const careerFilterOptions = useMemo(
    () => [
      {
        slug: "all" as const,
        label: "Todos",
        count: studentsWithResults.length,
      },
      ...studentCareerOptions.map((option) => ({
        slug: option.slug,
        label: option.label,
        count: studentsWithResults.filter(
          (student) => student.careerSlug === option.slug,
        ).length,
      })),
    ],
    [studentsWithResults],
  );
  const activityFilterOptions = useMemo(
    () => [
      {
        slug: "all" as const,
        label: "Todos los estados",
        count: careerFilteredStudents.length,
      },
      {
        slug: "active" as const,
        label: "Activos",
        count: careerFilteredStudents.filter(
          (student) => student.simulationsCount > 0,
        ).length,
      },
      {
        slug: "inactive" as const,
        label: "Sin intentos",
        count: careerFilteredStudents.filter(
          (student) => student.simulationsCount === 0,
        ).length,
      },
      {
        slug: "low-score" as const,
        label: "Puntaje bajo",
        count: careerFilteredStudents.filter(
          (student) =>
            student.simulationsCount > 0 && student.averageScore < 50,
        ).length,
      },
    ],
    [careerFilteredStudents],
  );

  const totalSimulations = sortedStudents.reduce(
    (total, student) => total + student.simulationsCount,
    0,
  );
  const activeStudents = sortedStudents.filter(
    (student) => student.simulationsCount > 0,
  ).length;
  const weightedScores = sortedStudents.flatMap((student) =>
    Array.from({ length: student.simulationsCount }, () => student.averageScore),
  );

  function updateCreateStudentField<K extends keyof CreateStudentForm>(
    field: K,
    value: CreateStudentForm[K],
  ) {
    setCreateStudentForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  function closeCreateDialog() {
    if (creatingStudent) {
      return;
    }

    setShowCreateDialog(false);
    setCreateStudentError("");
    setCreateStudentForm(initialCreateStudentForm);
  }

  function closeDeleteDialog() {
    if (deletingStudentId) {
      return;
    }

    setStudentToDelete(null);
    setDeleteStudentError("");
  }

  async function createStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateStudentError("");
    setCreateStudentMessage("");
    setCreatingStudent(true);

    try {
      const response = await fetch("/api/teacher/students", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(createStudentForm),
      });
      const payload = (await response
        .json()
        .catch(() => null)) as CreateStudentResponse | null;

      if (!response.ok || !payload?.student) {
        throw new Error(payload?.error ?? "No se pudo crear el estudiante.");
      }

      const createdStudent = payload.student;

      setCreatedStudents((currentStudents) => {
        if (
          currentStudents.some(
            (currentStudent) => currentStudent.id === createdStudent.id,
          )
        ) {
          return currentStudents;
        }

        return [createdStudent, ...currentStudents];
      });
      setCreateStudentMessage(
        `${createdStudent.fullName} fue creado correctamente.`,
      );
      setDeleteStudentMessage("");
      setCareerFilter(createdStudent.careerSlug ?? "all");
      setActivityFilter("all");
      setQuery("");
      setShowCreateDialog(false);
      setCreateStudentForm(initialCreateStudentForm);
      router.refresh();
    } catch (caughtError) {
      setCreateStudentError(
        caughtError instanceof Error
          ? caughtError.message
          : "No se pudo crear el estudiante.",
      );
    } finally {
      setCreatingStudent(false);
    }
  }

  async function deleteStudent() {
    if (!studentToDelete) {
      return;
    }

    const studentId = studentToDelete.id;
    setDeleteStudentError("");
    setCreateStudentMessage("");
    setDeletingStudentId(studentId);

    try {
      const response = await fetch(`/api/teacher/students/${studentId}`, {
        method: "DELETE",
      });
      const payload = (await response
        .json()
        .catch(() => null)) as DeleteStudentResponse | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "No se pudo eliminar el estudiante.");
      }

      setDeletedStudentIds((currentIds) =>
        currentIds.includes(studentId) ? currentIds : [...currentIds, studentId],
      );
      setCreatedStudents((currentStudents) =>
        currentStudents.filter((student) => student.id !== studentId),
      );
      setCareerOverrides((currentOverrides) => {
        const nextOverrides = { ...currentOverrides };
        delete nextOverrides[studentId];
        return nextOverrides;
      });
      window.localStorage.removeItem(getLocalSimulationIndexKey(studentId));
      setDeleteStudentMessage(
        `${studentToDelete.fullName} fue eliminado correctamente.`,
      );
      setStudentToDelete(null);
      router.refresh();
    } catch (caughtError) {
      setDeleteStudentError(
        caughtError instanceof Error
          ? caughtError.message
          : "No se pudo eliminar el estudiante.",
      );
    } finally {
      setDeletingStudentId(null);
    }
  }

  async function updateStudentCareer(
    studentId: string,
    careerSlug: StudentCareerSlug,
  ) {
    const career = studentCareerOptions.find(
      (option) => option.slug === careerSlug,
    );

    if (!career) {
      return;
    }

    setCareerError("");
    setSavingCareerStudentId(studentId);

    try {
      const response = await fetch(
        `/api/teacher/students/${studentId}/career`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ careerSlug }),
        },
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
          details?: string;
        } | null;
        throw new Error(
          payload?.details
            ? `${payload.error ?? "No se pudo actualizar la carrera."} ${payload.details}`
            : payload?.error ?? "No se pudo actualizar la carrera.",
        );
      }

      setCareerOverrides((currentOverrides) => ({
        ...currentOverrides,
        [studentId]: {
          careerSlug: career.slug,
          careerLabel: career.label,
        },
      }));
      router.refresh();
    } catch (caughtError) {
      setCareerError(
        caughtError instanceof Error
          ? caughtError.message
          : "No se pudo actualizar la carrera del estudiante.",
      );
    } finally {
      setSavingCareerStudentId(null);
    }
  }

  return (
    <div className="space-y-8">
      {showSummaryCards ? (
        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total de estudiantes"
            value={sortedStudents.length}
            icon={<Users className="h-5 w-5" aria-hidden="true" />}
            tone="blue"
          />
          <StatCard
            title="Total de simulaciones"
            value={totalSimulations}
            icon={<ClipboardList className="h-5 w-5" aria-hidden="true" />}
            tone="sky"
          />
          <StatCard
            title="Promedio general"
            value={formatScore(average(weightedScores))}
            icon={<TrendingUp className="h-5 w-5" aria-hidden="true" />}
            tone="green"
          />
          <StatCard
            title="Estudiantes activos"
            value={activeStudents}
            icon={<Activity className="h-5 w-5" aria-hidden="true" />}
            tone="slate"
          />
        </section>
      ) : null}

      <section id="estudiantes">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold tracking-normal text-slate-950">
              Estudiantes
            </h2>
            <button
              type="button"
              onClick={() => {
                setCreateStudentError("");
                setCreateStudentMessage("");
                setDeleteStudentMessage("");
                setShowCreateDialog(true);
              }}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Nuevo estudiante
            </button>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div
              aria-label="Filtrar estudiantes por carrera"
              className="flex flex-wrap gap-2"
              role="group"
            >
              {careerFilterOptions.map((option) => {
                const isActive = careerFilter === option.slug;

                return (
                  <button
                    key={option.slug}
                    type="button"
                    onClick={() => setCareerFilter(option.slug)}
                    className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition ${
                      isActive
                        ? "border-slate-950 bg-slate-950 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-800"
                    }`}
                  >
                    {option.label}
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-xs ${
                        isActive
                          ? "bg-white/15 text-white"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {option.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex h-11 w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 shadow-sm focus-within:border-sky-400 focus-within:ring-4 focus-within:ring-sky-100 lg:max-w-sm">
              <Search className="h-5 w-5 text-slate-400" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nombre, correo o carrera"
                className="h-full w-full bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_16rem]">
            <div
              aria-label="Filtrar estudiantes por estado"
              className="flex flex-wrap gap-2"
              role="group"
            >
              {activityFilterOptions.map((option) => {
                const isActive = activityFilter === option.slug;

                return (
                  <button
                    key={option.slug}
                    type="button"
                    onClick={() => setActivityFilter(option.slug)}
                    className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition ${
                      isActive
                        ? "border-sky-700 bg-sky-700 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-800"
                    }`}
                  >
                    {option.label}
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-xs ${
                        isActive
                          ? "bg-white/15 text-white"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {option.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <label className="text-sm font-semibold text-slate-600">
              Ordenar por
              <div className="mt-2 flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 shadow-sm">
                <ArrowDownUp className="h-4 w-4 text-slate-400" aria-hidden="true" />
                <select
                  value={sortKey}
                  onChange={(event) => setSortKey(event.target.value as SortKey)}
                  className="h-full w-full bg-transparent text-sm font-semibold text-slate-700 outline-none"
                >
                  <option value="lastActivity">Última actividad</option>
                  <option value="average">Promedio</option>
                  <option value="simulations">Simulaciones</option>
                  <option value="name">Nombre</option>
                </select>
              </div>
            </label>
          </div>
        </div>

        {createStudentMessage ? (
          <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            {createStudentMessage}
          </div>
        ) : null}

        {deleteStudentMessage ? (
          <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            {deleteStudentMessage}
          </div>
        ) : null}

        {careerError ? (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {careerError}
          </div>
        ) : null}

        {sortedStudents.length === 0 ? (
          <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
            No hay estudiantes para mostrar con los filtros actuales. Revisa la
            búsqueda, la carrera seleccionada o el estado de actividad.
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[980px] border-collapse text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Estudiante</th>
                  <th className="px-4 py-3">Carrera</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Simulaciones</th>
                  <th className="px-4 py-3 text-right">Promedio</th>
                  <th className="px-4 py-3 text-right">Mejor</th>
                  <th className="px-4 py-3">Última actividad</th>
                  <th className="px-4 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedStudents.map((student) => {
                  const status = getStudentStatus(student);

                  return (
                    <tr key={student.id} className="align-top">
                      <td className="px-4 py-4">
                        <p className="font-semibold text-slate-950">
                          {student.fullName}
                        </p>
                        <p className="mt-1 break-all text-xs text-slate-500">
                          {student.email}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <select
                          value={student.careerSlug ?? ""}
                          onChange={(event) =>
                            void updateStudentCareer(
                              student.id,
                              event.target.value as StudentCareerSlug,
                            )
                          }
                          disabled={savingCareerStudentId === student.id}
                          className="h-10 w-40 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <option value="" disabled>
                            Sin carrera
                          </option>
                          {studentCareerOptions.map((option) => (
                            <option key={option.slug} value={option.slug}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right font-semibold text-slate-950">
                        {student.simulationsCount}
                      </td>
                      <td className="px-4 py-4 text-right font-semibold text-slate-950">
                        {formatScore(student.averageScore)}
                      </td>
                      <td className="px-4 py-4 text-right font-semibold text-slate-950">
                        {formatScore(student.bestScore)}
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center gap-2 text-slate-600">
                          <CalendarClock
                            className="h-4 w-4 text-slate-400"
                            aria-hidden="true"
                          />
                          {formatDate(student.lastActivity)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/teacher/students/${student.id}`}
                            className="inline-flex h-9 items-center justify-center rounded-lg bg-slate-950 px-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                          >
                            Ver historial
                          </Link>
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteStudentError("");
                              setDeleteStudentMessage("");
                              setStudentToDelete(student);
                            }}
                            disabled={deletingStudentId === student.id}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {deletingStudentId === student.id ? (
                              <Loader2
                                className="h-4 w-4 animate-spin"
                                aria-hidden="true"
                              />
                            ) : (
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            )}
                            <span className="sr-only">Eliminar estudiante</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showCreateDialog ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 px-4 py-6 backdrop-blur-sm">
          <form
            aria-labelledby="create-student-title"
            aria-modal="true"
            role="dialog"
            onSubmit={createStudent}
            className="max-h-full w-full max-w-2xl overflow-y-auto rounded-lg border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-sky-700">
                  Nuevo usuario
                </p>
                <h3
                  id="create-student-title"
                  className="mt-1 text-xl font-semibold tracking-normal text-slate-950"
                >
                  Crear estudiante
                </h3>
              </div>
              <button
                type="button"
                onClick={closeCreateDialog}
                disabled={creatingStudent}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <X className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Cerrar</span>
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">
                Nombre
                <input
                  type="text"
                  value={createStudentForm.firstName}
                  onChange={(event) =>
                    updateCreateStudentField("firstName", event.target.value)
                  }
                  autoComplete="given-name"
                  required
                  disabled={creatingStudent}
                  className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                />
              </label>

              <label className="text-sm font-semibold text-slate-700">
                Apellido
                <input
                  type="text"
                  value={createStudentForm.lastName}
                  onChange={(event) =>
                    updateCreateStudentField("lastName", event.target.value)
                  }
                  autoComplete="family-name"
                  required
                  disabled={creatingStudent}
                  className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                />
              </label>

              <label className="text-sm font-semibold text-slate-700">
                Correo
                <input
                  type="email"
                  value={createStudentForm.email}
                  onChange={(event) =>
                    updateCreateStudentField("email", event.target.value)
                  }
                  autoComplete="email"
                  required
                  disabled={creatingStudent}
                  className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                />
              </label>

              <label className="text-sm font-semibold text-slate-700">
                Contraseña temporal
                <input
                  type="password"
                  value={createStudentForm.password}
                  onChange={(event) =>
                    updateCreateStudentField("password", event.target.value)
                  }
                  autoComplete="new-password"
                  required
                  minLength={8}
                  disabled={creatingStudent}
                  className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                />
              </label>

              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                Carrera
                <select
                  value={createStudentForm.careerSlug}
                  onChange={(event) =>
                    updateCreateStudentField(
                      "careerSlug",
                      event.target.value as StudentCareerSlug,
                    )
                  }
                  disabled={creatingStudent}
                  className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                >
                  {studentCareerOptions.map((option) => (
                    <option key={option.slug} value={option.slug}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {createStudentError ? (
              <div className="mt-5 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <AlertCircle
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <p>{createStudentError}</p>
              </div>
            ) : null}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeCreateDialog}
                disabled={creatingStudent}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={creatingStudent}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-sky-700 px-4 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {creatingStudent ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <UserPlus className="h-4 w-4" aria-hidden="true" />
                )}
                Crear estudiante
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {studentToDelete ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 px-4 py-6 backdrop-blur-sm">
          <div
            aria-labelledby="delete-student-title"
            aria-modal="true"
            role="dialog"
            className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-red-700">
                  Eliminar usuario
                </p>
                <h3
                  id="delete-student-title"
                  className="mt-1 text-xl font-semibold tracking-normal text-slate-950"
                >
                  Eliminar estudiante
                </h3>
              </div>
              <button
                type="button"
                onClick={closeDeleteDialog}
                disabled={Boolean(deletingStudentId)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <X className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Cerrar</span>
              </button>
            </div>

            <div className="mt-5 rounded-lg border border-red-100 bg-red-50 p-4">
              <p className="font-semibold text-slate-950">
                {studentToDelete.fullName}
              </p>
              <p className="mt-1 break-all text-sm text-slate-600">
                {studentToDelete.email}
              </p>
            </div>

            <p className="mt-5 text-sm leading-6 text-slate-600">
              Esta acción eliminará el acceso del estudiante y sus registros
              asociados de simulaciones. No se puede deshacer desde el panel.
            </p>

            {deleteStudentError ? (
              <div className="mt-5 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <AlertCircle
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <p>{deleteStudentError}</p>
              </div>
            ) : null}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeDeleteDialog}
                disabled={Boolean(deletingStudentId)}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void deleteStudent()}
                disabled={Boolean(deletingStudentId)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-red-700 px-4 text-sm font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {deletingStudentId ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                )}
                Eliminar estudiante
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
