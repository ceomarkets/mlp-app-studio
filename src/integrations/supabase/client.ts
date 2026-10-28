import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Variables que Lovable Cloud / Supabase inyectan automáticamente.
 * Si faltan, la app arranca en modo demo (datos locales en el navegador).
 */
export const SUPABASE_URL = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
export const SUPABASE_KEY = (import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ??
  import.meta.env["VITE_SUPABASE_ANON_KEY"]) as string | undefined;

export const hasSupabase = Boolean(SUPABASE_URL && SUPABASE_KEY);

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!hasSupabase) throw new Error("Supabase no está configurado");
  client ??= createClient(SUPABASE_URL!, SUPABASE_KEY!, {
    auth: {
      persistSession: typeof window !== "undefined",
      autoRefreshToken: typeof window !== "undefined",
      detectSessionInUrl: typeof window !== "undefined",
    },
  });
  return client;
}
