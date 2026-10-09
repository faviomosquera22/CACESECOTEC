import { createHash } from "node:crypto";
import { requireTeacherImportRequest } from "@/lib/teacherImportAuth";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { extractPdfQuestions } from "@/lib/pdfQuestionExtractor";
import { PDF_MAX_BYTES, questionIdentity } from "@/lib/pdfQuestionImport";
import { getSharedBank } from "@/lib/questionBankServer";
import type { Json } from "@/lib/database.types";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export const maxDuration=60;
export async function POST(request:Request) {
  const auth=await requireTeacherImportRequest(request);if(auth.error)return auth.error;
  if(Number(request.headers.get("content-length"))>PDF_MAX_BYTES+100_000)return Response.json({error:"El PDF debe pesar como máximo 4 MB."},{status:413});
  const admin=getSupabaseAdminClient();
  const recent=await admin.from("pdf_question_imports").select("id",{count:"exact",head:true}).eq("teacher_id",auth.teacherId).gte("created_at",new Date(Date.now()-3600000).toISOString());
  if(recent.error)return Response.json({error:"No se pudo preparar la importación. Reintenta."},{status:500});
  if((recent.count??0)>=15)return Response.json({error:"Ya analizaste 15 PDF en la última hora. Espera antes de subir otro."},{status:429});
  const form=await request.formData().catch(()=>null);const file=form?.get("file");
  if(!(file instanceof File)||file.size>PDF_MAX_BYTES||!file.size)return Response.json({error:"Selecciona un PDF de hasta 4 MB."},{status:400});
  const bytes=new Uint8Array(await file.arrayBuffer());
  const hash=createHash("sha256").update(bytes).digest("hex");
  let extracted;
  try{extracted=await extractPdfQuestions(bytes);}catch(error){return Response.json({error:error instanceof Error ? error.message : "No se pudo leer el PDF."},{status:422});}
  try {
    const existing=new Set((await getSharedBank(auth.career, true)).map(questionIdentity));
    const candidates=extracted.candidates.map(q=>{const identity=questionIdentity(q);const duplicate=existing.has(identity);existing.add(identity);return {...q,duplicate};});
    const preview={...extracted,candidates};
    const filename=file.name.replace(/[\u0000-\u001f]/g,"").slice(0,180);
    const {data,error}=await admin.from("pdf_question_imports").insert({teacher_id:auth.teacherId,career_slug:auth.career,filename,file_hash:hash,preview:preview as unknown as Json}).select("id").single();
    if(error)throw error;
    return Response.json({importId:data.id,filename,...preview});
  } catch{return Response.json({error:"No se pudo guardar la revisión del PDF. Reintenta."},{status:500});}
}
