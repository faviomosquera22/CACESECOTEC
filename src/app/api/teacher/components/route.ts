import { requireTeacherImportRequest } from "@/lib/teacherImportAuth";
import { getCustomComponents } from "@/lib/customComponentsServer";
import { getSimulatorSettingsCatalog } from "@/lib/simulatorSettingsCatalog";
import { validateComponentName } from "@/lib/customComponents";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
export const dynamic="force-dynamic";
export async function POST(request:Request) {
  const auth=await requireTeacherImportRequest(request);if(auth.error)return auth.error;
  const body=await request.json().catch(()=>null);
  let label:string;
  try {label=validateComponentName(body?.label);}catch(error){return Response.json({error:(error as Error).message},{status:400});}
  try {
    const custom=await getCustomComponents(auth.career);
    if(custom.length>=200)return Response.json({error:"Se alcanzó el límite de 200 componentes personalizados."},{status:400});
    if(getSimulatorSettingsCatalog(auth.career,custom).phases.some(item=>item.label.toLocaleLowerCase("es")===label.toLocaleLowerCase("es"))) return Response.json({error:"Ya existe un componente con ese nombre. Si fue eliminado, puedes restaurarlo desde Eliminados."},{status:409});
    const {data,error}=await getSupabaseAdminClient().from("question_components").insert({career_slug:auth.career,label,created_by:auth.teacherId,description:"Componente creado por un docente"}).select("key,label,description").single();
    if(error)return Response.json({error:error.code==="23505"?"Ya existe ese componente.":"No se pudo crear el componente."},{status:error.code==="23505"?409:500});
    return Response.json({component:data},{status:201});
  }catch{return Response.json({error:"No se pudieron cargar los componentes."},{status:500});}
}
