import { hasSupabase } from "@/integrations/supabase/client";
import { demoBackend } from "./demo";
import { supabaseBackend } from "./supabase";
import type { Backend } from "./types";

export * from "./types";

/** true cuando no hay credenciales de Supabase: la app usa datos locales. */
export const IS_DEMO = !hasSupabase;

export const backend: Backend = IS_DEMO ? demoBackend : supabaseBackend;
