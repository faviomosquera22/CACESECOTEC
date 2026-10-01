import "server-only";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { repairQuestionText } from "@/lib/localQuestions";
import { applyBankOverrides, type BankOverride, type BankQuestion } from "@/lib/questionBank";
import type { Question } from "@/lib/database.types";
import type { StudentCareerSlug } from "@/lib/studentCareer";

export async function getBankOverrides(career: StudentCareerSlug): Promise<BankOverride[]> {
  const rows: BankOverride[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await getSupabaseAdminClient().from("question_bank_overrides").select("question_id,question,updated_at").eq("career_slug", career).order("question_id").range(offset, offset + 499);
    if (error) throw new Error("No se pudieron cargar las correcciones del banco. Recarga la página.");
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}
export async function getSharedBank(career: StudentCareerSlug): Promise<BankQuestion[]> {
  const source: Question[] = [];
  if (career === "enfermeria") {
    const banks = await Promise.all([
      import("@/data/enfermeriaQuestions.json"), import("@/data/enfermeriaComponenteIntegralQuestions.json"),
      import("@/data/enfermeriaOctubreDocumentoQuestions.json"), import("@/data/enfermeriaFundamentosDocumentoQuestions.json"),
      import("@/data/enfermeriaIntegralSeptiembreQuestions.json"),
    ]);
    for (const bank of banks) source.push(...bank.default as Question[]);
  } else source.push(...(await import("@/data/psicologiaQuestions.json")).default as Question[]);
  const categoryFilter = (career === "enfermeria" ? ["enfermeria", "enfermería", "nursing"] : ["psicologia", "psicología", "psychology", "clinica"]).map(word => `category.ilike.%${word}%`).join(",");
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await getSupabaseAdminClient().from("questions").select("*").or(categoryFilter).order("id").range(offset, offset + 499);
    if (error) throw new Error("No se pudo consultar el banco completo.");
    source.push(...data);
    if (data.length < 500) break;
  }
  const unique = [...new Map(source.map(q => [q.id, repairQuestionText(q)])).values()];
  return applyBankOverrides(unique, await getBankOverrides(career)).map(q => ({ ...q, revision: q.bank_revision ?? null }));
}
