export function getSupabaseConfig() {
  const fallbackUrl = "https://nlathyozbhedrgzoawjw.supabase.co";
  const fallbackAnonKey =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sYXRoeW96YmhlZHJnem9hd2p3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MTI5MTgsImV4cCI6MjA5NjA4ODkxOH0.q0Jr2B9lnbSm3TfTt4-pz9F2BGdWpwicaZFJTOHRiNE";

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? fallbackUrl;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? fallbackAnonKey;

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey };
}
