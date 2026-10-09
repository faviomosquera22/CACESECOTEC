import "server-only";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import type { StudentCareerSlug } from "@/lib/studentCareer";
import type { CustomComponent } from "@/lib/customComponents";
import { getSimulatorSettingsCatalog } from "@/lib/simulatorSettingsCatalog";
import type { Question } from "@/lib/database.types";

export async function getCustomComponents(career: StudentCareerSlug): Promise<CustomComponent[]> {
  const result: CustomComponent[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await getSupabaseAdminClient().from("question_components").select("key,label,description").eq("career_slug", career).order("created_at").order("key").range(offset, offset + 499);
    if (error) throw new Error("No se pudieron cargar los componentes. Reintenta.");
    result.push(...data as CustomComponent[]);
    if (data.length < 500) return result;
  }
}
export async function getImportedQuestions(career: StudentCareerSlug, custom?: CustomComponent[]): Promise<Question[]> {
  const components = getSimulatorSettingsCatalog(career, custom ?? await getCustomComponents(career)).phases;
  const rows: Question[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await getSupabaseAdminClient().from("imported_questions").select("id,phase,question,created_at").eq("career_slug",career).order("id").range(offset,offset+499);
    if (error) throw new Error("No se pudieron cargar las preguntas importadas.");
    for (const row of data) {
      const component = components.find(item => item.key === row.phase);
      if (!component) continue;
      rows.push({ ...(row.question as unknown as Question), id: `local-pdf-${row.id}`, phase: component.key, component: component.label, category: `${career === "enfermeria" ? "Enfermería" : "Psicología"} - ${component.label}`, created_at: row.created_at });
    }
    if (data.length < 500) return rows;
  }
}
