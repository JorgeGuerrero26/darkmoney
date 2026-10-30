// Iniciar sesión con Google en la web: a dónde vuelve y cuándo aparece el botón.
// node --experimental-strip-types scripts/test-google-sign-in.mjs
import assert from "node:assert/strict";

import {
  buildGoogleRedirectUrl,
  isGoogleSignInEnabled,
  resetGoogleSignInCheck,
} from "../src/modules/auth/google-sign-in.ts";

// Vuelve a /auth/login del mismo sitio, conservando la invitación pendiente (next).
assert.equal(buildGoogleRedirectUrl("https://darkmoney.app"), "https://darkmoney.app/auth/login");
assert.equal(
  buildGoogleRedirectUrl("http://localhost:5173", "/share/obligations/abc"),
  "http://localhost:5173/auth/login?next=%2Fshare%2Fobligations%2Fabc",
);

const settings = (body, ok = true) => {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url, init });
    return { ok, json: async () => body };
  };
  return { fetcher, calls };
};

// Activado en Supabase: aparece, y no vuelve a preguntar.
resetGoogleSignInCheck();
{
  const { fetcher, calls } = settings({ external: { email: true, google: true } });
  assert.equal(await isGoogleSignInEnabled("https://p.supabase.co", "anon", fetcher), true);
  assert.equal(await isGoogleSignInEnabled("https://p.supabase.co", "anon", fetcher), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://p.supabase.co/auth/v1/settings");
  assert.equal(calls[0].init.headers.apikey, "anon");
}

// Desactivado: no aparece.
resetGoogleSignInCheck();
assert.equal(await isGoogleSignInEnabled("https://p.supabase.co", "anon", settings({ external: { google: false } }).fetcher), false);

// Sin red: no aparece, y la próxima vez se vuelve a preguntar.
resetGoogleSignInCheck();
assert.equal(await isGoogleSignInEnabled("https://p.supabase.co", "anon", async () => { throw new Error("offline"); }), false);
await Promise.resolve();
assert.equal(await isGoogleSignInEnabled("https://p.supabase.co", "anon", settings({ external: { google: true } }).fetcher), true);

// Sin configuración de Supabase: no aparece.
resetGoogleSignInCheck();
assert.equal(await isGoogleSignInEnabled(undefined, undefined), false);

console.log("google-sign-in: OK");
