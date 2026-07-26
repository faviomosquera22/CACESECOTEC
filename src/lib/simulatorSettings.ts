import "server-only";

import type { SupabaseServerClient } from "@/lib/supabaseServer";
import type { StudentCareerSlug } from "@/lib/studentCareer";
import {
  getDefaultSimulatorSettings,
  sanitizeSimulatorSettings,
  type SimulatorDifficultyKey,
  type SimulatorPhaseKey,
} from "@/lib/simulatorSettingsCatalog";

type SimulatorSettingsRow = {
  career_slug: StudentCareerSlug;
  enabled_difficulties: SimulatorDifficultyKey[];
  enabled_categories: string[];
  enabled_phases: SimulatorPhaseKey[];
  updated_at: string | null;
};

export async function getCareerSimulatorSettings(
  supabase: SupabaseServerClient,
  career: StudentCareerSlug,
) {
  const { data, error } = await supabase
    .from("teacher_simulator_settings")
    .select(
      "career_slug, enabled_difficulties, enabled_categories, enabled_phases, updated_at",
    )
    .eq("career_slug", career)
    .maybeSingle<SimulatorSettingsRow>();

  if (error) {
    const { data: legacyData } = await supabase
      .from("teacher_simulator_settings")
      .select(
        "career_slug, enabled_difficulties, enabled_categories, updated_at",
      )
      .eq("career_slug", career)
      .maybeSingle<Omit<SimulatorSettingsRow, "enabled_phases">>();

    if (legacyData) {
      return sanitizeSimulatorSettings(career, {
        enabledDifficulties: legacyData.enabled_difficulties,
        enabledCategories: legacyData.enabled_categories,
        enabledPhases: ["fase-1"],
        updatedAt: legacyData.updated_at,
      });
    }
  }

  if (!data) {
    return getDefaultSimulatorSettings(career);
  }

  return sanitizeSimulatorSettings(career, {
    enabledDifficulties: data.enabled_difficulties,
    enabledCategories: data.enabled_categories,
    enabledPhases: data.enabled_phases,
    updatedAt: data.updated_at,
  });
}
