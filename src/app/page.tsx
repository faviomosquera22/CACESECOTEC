import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth";
import { getRoleHomePath } from "@/lib/routes";

export const dynamic = "force-dynamic";

export default async function Home() {
  const context = await getCurrentAuthContext();

  if (context?.profile) {
    redirect(getRoleHomePath(context.profile.role));
  }

  redirect("/login");
}
