import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export async function getFreshSupabaseUser() {
  const supabase = getSupabaseBrowserClient();
  await supabase.auth.refreshSession().catch(() => null);

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}
