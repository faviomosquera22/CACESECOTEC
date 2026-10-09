import type { SimulatorPhaseKey } from "@/lib/simulatorSettingsCatalog";
export type CustomComponent = { key: SimulatorPhaseKey; label: string; description: string };
export function validateComponentName(value: unknown) {
  if (typeof value !== "string" || value.trim().length < 3 || value.trim().length > 120) throw new Error("Escribe un nombre de entre 3 y 120 caracteres.");
  const label = value.trim().replace(/\s+/g, " ");
  if (label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === "componente integral") throw new Error("El Componente Integral fue retirado. Usa otro nombre.");
  return label;
}
