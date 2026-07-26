import "server-only";

import type { SupabaseServerClient } from "@/lib/supabaseServer";
import type { StudentCareerSlug } from "@/lib/studentCareer";
import {
  getDefaultSimulatorSettings,
  sanitizeSimulatorSettings,
  type SimulatorDifficultyKey,
} from "@/lib/simulatorSettingsCatalog";

type SimulatorSettingsRow = {
  career_slug: StudentCareerSlug;
  enabled_difficulties: SimulatorDifficultyKey[];
  enabled_categories: string[];
  updated_at: string | null;
};

export async function getCareerSimulatorSettings(
  supabase: SupabaseServerClient,
  career: StudentCareerSlug,
) {
  const { data, error } = await supabase
    .from("teacher_simulator_settings")
    .select(
      "career_slug, enabled_difficulties, enabled_categories, updated_at",
    )
    .eq("career_slug", career)
    .maybeSingle<SimulatorSettingsRow>();

  if (error || !data) {
    return getDefaultSimulatorSettings(career);
  }

  return sanitizeSimulatorSettings(career, {
    enabledDifficulties: data.enabled_difficulties,
    enabledCategories: data.enabled_categories,
    updatedAt: data.updated_at,
  });
}
