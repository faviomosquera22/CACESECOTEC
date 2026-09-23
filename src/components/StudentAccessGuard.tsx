"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { STUDENT_BLOCKED_PATH } from "@/lib/studentAccess";

export function StudentAccessGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [verifiedPath, setVerifiedPath] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let pending = false;
    let leaving = false;
    const controller = new AbortController();

    async function verifyAccess() {
      if (pending || leaving || disposed) return;
      pending = true;

      try {
        const response = await fetch("/api/student/simulator-access", {
          cache: "no-store",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]),
        });
        if (disposed) return;

        if (response.status === 401 || response.status === 403) {
          leaving = true;
          setVerifiedPath(null);
          // A full navigation clears prefetched pages and client report state.
          window.location.replace(response.status === 401 ? "/login" : STUDENT_BLOCKED_PATH);
          return;
        }

        if (!response.ok) throw new Error("Access verification failed");
        const payload = (await response.json()) as { enabled?: boolean };
        if (disposed) return;

        if (payload.enabled !== true) {
          leaving = true;
          setVerifiedPath(null);
          window.location.replace(STUDENT_BLOCKED_PATH);
          return;
        }

        setVerifiedPath(pathname);
      } catch {
        // Do not leave reports or local attempts usable without verification.
        if (!disposed) setVerifiedPath(null);
      } finally {
        pending = false;
      }
    }

    function verifyWhenVisible() {
      if (document.visibilityState === "visible") void verifyAccess();
    }

    void verifyAccess();
    const interval = window.setInterval(() => void verifyAccess(), 15_000);
    window.addEventListener("focus", verifyWhenVisible);
    window.addEventListener("pageshow", verifyWhenVisible);
    document.addEventListener("visibilitychange", verifyWhenVisible);

    return () => {
      disposed = true;
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", verifyWhenVisible);
      window.removeEventListener("pageshow", verifyWhenVisible);
      document.removeEventListener("visibilitychange", verifyWhenVisible);
    };
  }, [pathname]);

  if (verifiedPath !== pathname) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div role="status" className="max-w-md text-center text-sm leading-6 text-slate-600">
          <p>Verificando tu acceso al sitio…</p>
          <p>Si no se restablece, comprueba tu conexión y recarga la página.</p>
          <a href="/access-blocked" className="mt-4 inline-block font-semibold text-sky-700">
            Verificar acceso
          </a>
        </div>
      </main>
    );
  }

  return children;
}
