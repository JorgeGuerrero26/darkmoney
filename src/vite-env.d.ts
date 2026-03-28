/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_PUBLIC_APP_URL?: string;
  readonly VITE_PADDLE_CLIENT_TOKEN?: string;
  readonly VITE_PADDLE_PRO_PRICE_ID?: string;
  readonly VITE_PADDLE_ENV?: "sandbox" | "production";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
