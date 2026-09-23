import { redirect } from "next/navigation";
import { getCurrentAuthContext, hasStudentSiteAccess } from "@/lib/auth";
import { STUDENT_BLOCKED_PATH } from "@/lib/studentAccess";
import { getRoleHomePath } from "@/lib/routes";

export const dynamic = "force-dynamic";

export default async function Home() {
  const context = await getCurrentAuthContext();

  if (context?.profile) {
    if (
      context.profile.role === "student" &&
      !(await hasStudentSiteAccess(context.supabase, context.profile.id))
    ) {
      redirect(STUDENT_BLOCKED_PATH);
    }
    redirect(getRoleHomePath(context.profile.role));
  }

  redirect("/login");
}
