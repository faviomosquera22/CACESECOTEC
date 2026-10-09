import "server-only";
import { getCurrentAuthContext } from "@/lib/auth";
import { getTeacherCareerScope } from "@/lib/teacherCareerScope";
export async function requireTeacherImportRequest(request: Request) {
  const context=await getCurrentAuthContext();
  if(!context?.profile) return {error:Response.json({error:"Sesión no válida."},{status:401})} as const;
  const career=getTeacherCareerScope(context.profile);
  if(!career) return {error:Response.json({error:"Solo docentes pueden administrar el banco de preguntas."},{status:403})} as const;
  const origin=request.headers.get("origin");
  if(origin && origin!==new URL(request.url).origin) return {error:Response.json({error:"Origen no permitido."},{status:403})} as const;
  return {context,career,teacherId:context.profile.id} as const;
}
