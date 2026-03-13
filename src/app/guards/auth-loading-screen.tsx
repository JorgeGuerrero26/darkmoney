export function AuthLoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-glow px-6 text-ink">
      <div className="glass-panel-strong max-w-md rounded-[32px] p-8 text-center">
        <p className="text-xs uppercase tracking-[0.28em] text-storm">DarkMoney</p>
        <h1 className="mt-4 font-display text-3xl font-semibold">Sincronizando sesion</h1>
        <p className="mt-3 text-sm leading-7 text-storm">
          Estamos validando tu acceso y preparando tu contexto financiero.
        </p>
      </div>
    </main>
  );
}
