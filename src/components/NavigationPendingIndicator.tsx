"use client";

import { useLinkStatus } from "next/link";
import { LoaderCircle } from "lucide-react";

export function NavigationPendingIndicator() {
  const { pending } = useLinkStatus();

  if (!pending) {
    return null;
  }

  return (
    <LoaderCircle
      aria-label="Cargando sección"
      className="h-4 w-4 animate-spin"
      role="status"
    />
  );
}
