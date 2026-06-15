import Link from "next/link";
import {
  CalendarClock,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  Mail,
  TrendingUp,
  Trophy,
  UserRound,
} from "lucide-react";
import { formatDate, formatScore } from "@/lib/format";
import type { StudentCareerSlug } from "@/lib/studentCareer";

export type StudentCardData = {
  id: string;
  fullName: string;
  email: string;
  careerSlug: StudentCareerSlug | null;
  careerLabel: string;
  simulationsCount: number;
  averageScore: number;
  bestScore: number;
  lastActivity: string | null;
};

type StudentCardProps = {
  student: StudentCardData;
};

export function StudentCard({ student }: StudentCardProps) {
  return (
    <article className="flex h-full flex-col justify-between rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700 ring-1 ring-sky-100">
            <UserRound className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-950">
              {student.fullName}
            </h3>
            <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
              <Mail className="h-4 w-4" aria-hidden="true" />
              <span className="break-all">{student.email}</span>
            </p>
            <p className="mt-2 inline-flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
              <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
              {student.careerLabel}
            </p>
          </div>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg bg-slate-50 p-3">
          <dt className="flex items-center gap-2 text-slate-500">
            <ClipboardList className="h-4 w-4" aria-hidden="true" />
            Simulaciones
          </dt>
          <dd className="mt-2 text-xl font-semibold text-slate-950">
            {student.simulationsCount}
          </dd>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <dt className="flex items-center gap-2 text-slate-500">
            <TrendingUp className="h-4 w-4" aria-hidden="true" />
            Promedio
          </dt>
          <dd className="mt-2 text-xl font-semibold text-slate-950">
            {formatScore(student.averageScore)}
          </dd>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <dt className="flex items-center gap-2 text-slate-500">
            <Trophy className="h-4 w-4" aria-hidden="true" />
            Mejor
          </dt>
          <dd className="mt-2 text-xl font-semibold text-slate-950">
            {formatScore(student.bestScore)}
          </dd>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <dt className="flex items-center gap-2 text-slate-500">
            <CalendarClock className="h-4 w-4" aria-hidden="true" />
            Última
          </dt>
          <dd className="mt-2 text-sm font-semibold text-slate-950">
            {formatDate(student.lastActivity)}
          </dd>
        </div>
      </dl>

      <Link
        href={`/teacher/students/${student.id}`}
        className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
      >
        Ver historial
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </article>
  );
}
