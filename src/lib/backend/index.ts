import { demoBackend } from "./demo";
import { supabaseBackend } from "./supabase";
import type { Backend } from "./types";

export * from "./types";

/**
 * true cuando no hay credenciales de la base de datos: la app usa datos locales.
 * El cliente generado (src/integrations/supabase/client.ts) no exporta este
 * dato, así que lo deducimos de las variables de entorno.
 */
const hasBackend =
  Boolean(import.meta.env["VITE_SUPABASE_URL"]) ||
  (typeof process !== "undefined" && Boolean(process.env["SUPABASE_URL"]));

export const IS_DEMO = !hasBackend;

export const backend: Backend = IS_DEMO ? demoBackend : supabaseBackend;
