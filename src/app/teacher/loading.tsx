import { LoaderCircle } from "lucide-react";

export default function TeacherLoading() {
  return (
    <div
      aria-live="polite"
      className="flex min-h-64 items-center justify-center rounded-lg border border-slate-200 bg-white"
      role="status"
    >
      <div className="flex items-center gap-3 text-sm font-semibold text-slate-600">
        <LoaderCircle className="h-5 w-5 animate-spin text-sky-700" aria-hidden="true" />
        Cargando sección…
      </div>
    </div>
  );
}
