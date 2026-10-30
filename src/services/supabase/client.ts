import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/** Para consultas públicas de Auth (p. ej. qué proveedores están activos). */
export const supabasePublicConfig = { url: supabaseUrl as string | undefined, anonKey: supabaseAnonKey as string | undefined };

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
      },
    })
  : null;
