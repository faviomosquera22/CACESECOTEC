"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { Activity, ClipboardList, Search, TrendingUp, Users } from "lucide-react";
import { StudentCard, type StudentCardData } from "@/components/StudentCard";
import { StatCard } from "@/components/StatCard";
import type { SimulationHistoryRecord } from "@/components/SimulationHistoryTable";
import { average, formatScore } from "@/lib/format";
import {
  getLocalSimulationIndexKey,
  subscribeToLocalSimulationChanges,
} from "@/lib/localSimulationStorage";

type TeacherDashboardClientProps = {
  students: StudentCardData[];
};

function readLocalSimulations(studentId: string) {
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

export function TeacherDashboardClient({
  students,
}: TeacherDashboardClientProps) {
  const [query, setQuery] = useState("");
  const localStorageSnapshot = useSyncExternalStore(
    subscribeToLocalSimulationChanges,
    () =>
      JSON.stringify(
        students.map((student) =>
          window.localStorage.getItem(getLocalSimulationIndexKey(student.id)),
        ),
      ),
    () => "[]",
  );

  const studentsWithResults = useMemo(() => {
    void localStorageSnapshot;

    return students.map((student) => {
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
  }, [localStorageSnapshot, students]);

  const filteredStudents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return studentsWithResults;
    }

    return studentsWithResults.filter((student) => {
      return (
        student.fullName.toLowerCase().includes(normalizedQuery) ||
        student.email.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [query, studentsWithResults]);

  const totalSimulations = studentsWithResults.reduce(
    (total, student) => total + student.simulationsCount,
    0,
  );
  const activeStudents = studentsWithResults.filter(
    (student) => student.simulationsCount > 0,
  ).length;
  const weightedScores = studentsWithResults.flatMap((student) =>
    Array.from({ length: student.simulationsCount }, () => student.averageScore),
  );

  return (
    <div className="space-y-8">
      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total de estudiantes"
          value={studentsWithResults.length}
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

      <section id="estudiantes">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold tracking-normal text-slate-950">
            Estudiantes
          </h2>
          <div className="flex h-11 w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 shadow-sm focus-within:border-sky-400 focus-within:ring-4 focus-within:ring-sky-100 sm:max-w-sm">
            <Search className="h-5 w-5 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nombre o correo"
              className="h-full w-full bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
            />
          </div>
        </div>

        {filteredStudents.length === 0 ? (
          <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
            No hay estudiantes para mostrar. Verifica que el docente tenga
            permiso para leer perfiles de estudiantes en Supabase.
          </div>
        ) : (
          <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredStudents.map((student) => (
              <StudentCard key={student.id} student={student} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
