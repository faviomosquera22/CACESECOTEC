import "server-only";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import type { BankRemoval } from "@/lib/bankRemovals";
import type { StudentCareerSlug } from "@/lib/studentCareer";

export async function getBankRemovals(career: StudentCareerSlug): Promise<BankRemoval[]> {
  const rows: BankRemoval[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await getSupabaseAdminClient().from("question_bank_removals").select("*")
      .eq("career_slug", career).order("kind").order("target_id").range(offset, offset + 499);
    if (error) throw new Error("No se pudo verificar el contenido eliminado. Recarga la página.");
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}
