"use client";

import { useMemo, useSyncExternalStore } from "react";
import { MessageSquareText } from "lucide-react";

type StudentTeacherFeedbackProps = {
  studentId: string;
};

function subscribeToStorage(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);

  return () => window.removeEventListener("storage", onStoreChange);
}

export function StudentTeacherFeedback({
  studentId,
}: StudentTeacherFeedbackProps) {
  const storageKey = `teacher-feedback:${studentId}`;
  const feedback = useSyncExternalStore(
    subscribeToStorage,
    () => window.localStorage.getItem(storageKey) ?? "",
    () => "",
  );
  const visibleFeedback = useMemo(() => feedback.trim(), [feedback]);

  if (!visibleFeedback) {
    return null;
  }

  return (
    <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-700 ring-1 ring-emerald-100">
          <MessageSquareText className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-base font-semibold">
            Retroalimentación del docente
          </h3>
          <p className="mt-2 text-sm leading-6">{visibleFeedback}</p>
        </div>
      </div>
    </section>
  );
}
