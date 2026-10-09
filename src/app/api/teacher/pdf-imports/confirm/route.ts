import { createHash } from "node:crypto";
import { requireTeacherImportRequest } from "@/lib/teacherImportAuth";
import { getCustomComponents } from "@/lib/customComponentsServer";
import { getSimulatorSettingsCatalog } from "@/lib/simulatorSettingsCatalog";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { getSharedBank } from "@/lib/questionBankServer";
import { PDF_MAX_QUESTIONS,questionIdentity,validateImportedQuestion,type PdfCandidate } from "@/lib/pdfQuestionImport";
import type { Json } from "@/lib/database.types";
export const dynamic="force-dynamic";
export async function POST(request:Request) {
  const auth=await requireTeacherImportRequest(request);if(auth.error)return auth.error;
  const body=await request.json().catch(()=>null);
  if(!body || typeof body.importId!=="string" || !/^[0-9a-f-]{36}$/i.test(body.importId) || !Array.isArray(body.questions) || !body.questions.length || body.questions.length>PDF_MAX_QUESTIONS) return Response.json({error:"Selecciona las preguntas a importar."},{status:400});
  const admin=getSupabaseAdminClient();
  const {data:batch,error}=await admin.from("pdf_question_imports").select("*").eq("id",body.importId).eq("teacher_id",auth.teacherId).eq("career_slug",auth.career).maybeSingle();
  if(error)return Response.json({error:"No se pudo cargar la revisión."},{status:500});
  if(!batch)return Response.json({error:"Importación no encontrada."},{status:404});
  if(batch.status==="completed")return Response.json({result:batch.result});
  if(Date.now()-Date.parse(batch.created_at)>86400000)return Response.json({error:"La revisión venció. Vuelve a analizar el PDF."},{status:410});
  try {
    const catalog=getSimulatorSettingsCatalog(auth.career,await getCustomComponents(auth.career));
    if(!catalog.phases.some(item=>item.key===body.phase))return Response.json({error:"Selecciona un componente de tu carrera."},{status:400});
    const originals=(batch.preview as unknown as {candidates:PdfCandidate[]}).candidates;
    const seenIndices=new Set<number>();
    const known=new Set((await getSharedBank(auth.career)).map(questionIdentity));
    let duplicates=0;
    const questions=[];
    for(const item of body.questions) {
      const original=originals.find(q=>q.index===item?.index);
      if(!original || seenIndices.has(item.index))return Response.json({error:"La selección no coincide con la revisión del PDF."},{status:400});
      seenIndices.add(item.index);
      if(original.issues.length && item.reviewed!==true)return Response.json({error:`Revisa y confirma la pregunta ${original.number} antes de importarla.`},{status:400});
      let validated;
      try{validated=validateImportedQuestion(item);}catch(error){return Response.json({error:`Pregunta ${original.number}: ${(error as Error).message}`},{status:400});}
      const identity=questionIdentity(validated);
      if(known.has(identity)){duplicates++;continue;}known.add(identity);
      const corrected=original.correct_option!==validated.correct_option;
      questions.push({fingerprint:createHash("sha256").update(identity).digest("hex"),question:{...validated,explanation:validated.explanation || `Fuente: ${batch.filename}, página ${original.page}, pregunta ${original.number}. Respuesta ${validated.correct_option}: ${corrected || original.issues.length ? "revisada por el docente" : original.evidence.toLocaleLowerCase("es")}.`,source_page:original.page,source_number:original.number,source_filename:batch.filename,source_answer:original.correct_option,reviewed_by_teacher:corrected||original.issues.length>0}});
    }
    const {data,error:saveError}=await admin.rpc("complete_pdf_question_import",{p_import_id:batch.id,p_teacher_id:auth.teacherId,p_phase:body.phase,p_questions:questions as unknown as Json});
    if(saveError)throw saveError;
    return Response.json({result:data,skippedDuplicates:duplicates});
  }catch{return Response.json({error:"No se pudo completar la importación. Reintenta; no se duplicarán las preguntas ya guardadas."},{status:500});}
}
