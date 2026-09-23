import "server-only";
import type { SupabaseServerClient } from "@/lib/supabaseServer";
import type { StudentCareerSlug } from "@/lib/studentCareer";
import type { ManualQuestionRow } from "@/lib/manualQuestions";

export async function getManualQuestions(supabase: SupabaseServerClient, teacherId: string | null, career: StudentCareerSlug, publishedOnly = false) {
  if (!teacherId) return [];
  const rows: ManualQuestionRow[] = [];
  for (let offset = 0; ; offset += 500) {
    let query = supabase.from("teacher_questions").select("*")
      .eq("teacher_id", teacherId).eq("career_slug", career)
      .order("created_at", { ascending: false }).order("id").range(offset, offset + 499);
    if (publishedOnly) query = query.eq("published", true);
    const { data, error } = await query;
    if (error) throw new Error("No se pudo cargar el banco docente. Intenta nuevamente o contacta al administrador.");
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}
