import { ArrowRight, CheckCircle2, Eye, LoaderCircle, LogIn, MailCheck, Shield } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { BrandBanner } from "../../../components/ui/brand-logo";
import { Button } from "../../../components/ui/button";
import { FormFeedbackBanner } from "../../../components/ui/form-feedback-banner";
import { formatDate } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import { useAcceptObligationShareMutation, useObligationShareInviteDetailsQuery } from "../../../services/queries/workspace-data";
import { useAuth } from "../../auth/auth-context";

function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() ?? "";
}

export function ObligationShareInvitePage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, signOut, user } = useAuth();
  const inviteQuery = useObligationShareInviteDetailsQuery(token);
  const acceptMutation = useAcceptObligationShareMutation(user?.id);
  const [feedback, setFeedback] = useState<{ title: string; description: string } | null>(null);
  const invite = inviteQuery.data;
  const currentEmail = normalizeEmail(user?.email ?? profile?.email);
  const invitedEmail = normalizeEmail(invite?.share.invitedEmail);
  const isMatchingUser = Boolean(invite && currentEmail && currentEmail === invitedEmail);
  const isAlreadyAccepted = invite?.share.status === "accepted";
  const loginTarget = `/auth/login?next=${encodeURIComponent(location.pathname)}`;

  const shareStateLabel = useMemo(() => {
    if (!invite) {
      return "";
    }

    switch (invite.share.status) {
      case "accepted":
        return "Acceso ya confirmado";
      case "pending":
        return "Pendiente de confirmacion";
      case "declined":
        return "Invitacion rechazada";
      case "revoked":
        return "Acceso revocado";
      default:
        return "Invitacion compartida";
    }
  }, [invite]);

  async function handleAccept() {
    if (!token) {
      return;
    }

    setFeedback(null);

    try {
      await acceptMutation.mutateAsync(token);
      navigate("/app/obligations", { replace: true });
    } catch (error) {
      setFeedback({
        title: "No pudimos confirmar el acceso",
        description:
          error instanceof Error
            ? error.message
            : "Intentalo otra vez dentro de unos segundos.",
      });
    }
  }

  async function handleSwitchAccount() {
    await signOut();
    navigate(loginTarget, { replace: true });
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(51,91,81,0.18),transparent_28%),linear-gradient(180deg,#040911_0%,#08111b_42%,#060b12_100%)] px-4 py-8 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center">
        <div className="grid w-full gap-8 lg:grid-cols-[0.98fr_1.02fr]">
          <section className="rounded-[36px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,14,22,0.96),rgba(6,10,17,0.92))] p-5 shadow-[0_35px_120px_rgba(0,0,0,0.42)] sm:p-7">
            <BrandBanner
              className="h-[220px] w-full rounded-[28px]"
              imageClassName="object-cover object-center"
            />

            <div className="mt-6">
              <div className="inline-flex items-center rounded-full border border-pine/18 bg-pine/[0.08] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-pine">
                Invitacion compartida
              </div>
              <h1 className="mt-4 font-display text-4xl font-semibold text-ink sm:text-[3.15rem]">
                Confirma un credito o deuda en DarkMoney
              </h1>
              <p className="mt-4 max-w-xl text-base leading-9 text-storm">
                Cuando aceptes, este registro aparecera en tu seccion de creditos y deudas con
                vista de seguimiento, historial y avance, pero sin permitirte editarlo.
              </p>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/80">
                  Compartido por
                </p>
                <p className="mt-3 text-lg font-semibold text-ink">
                  {invite?.share.ownerDisplayName ?? "Usuario DarkMoney"}
                </p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/80">Estado</p>
                <p className="mt-3 text-lg font-semibold text-ink">
                  {invite ? shareStateLabel : "Cargando invitacion"}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[36px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,13,21,0.98),rgba(6,10,16,0.95))] p-5 shadow-[0_35px_120px_rgba(0,0,0,0.42)] sm:p-7">
            {inviteQuery.isLoading ? (
              <div className="flex min-h-[520px] items-center justify-center">
                <div className="text-center">
                  <LoaderCircle className="mx-auto h-10 w-10 animate-spin text-pine" />
                  <p className="mt-4 text-sm text-storm">Cargando los detalles de esta invitacion...</p>
                </div>
              </div>
            ) : inviteQuery.error ? (
              <FormFeedbackBanner
                description={inviteQuery.error instanceof Error ? inviteQuery.error.message : "No pudimos abrir este enlace."}
                title="No pudimos cargar la invitacion"
              />
            ) : !invite ? (
              <FormFeedbackBanner
                description="El enlace puede haber vencido o ya no esta disponible."
                title="Invitacion no disponible"
              />
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/90">
                    {invite.direction === "receivable" ? "Credito" : "Deuda"}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/90">
                    {shareStateLabel}
                  </span>
                </div>

                <h2 className="mt-4 font-display text-3xl font-semibold text-ink sm:text-[2.6rem]">
                  {invite.title}
                </h2>
                <p className="mt-3 text-base leading-8 text-storm">
                  {invite.counterparty}
                </p>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5">
                    <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/80">
                      Principal actual
                    </p>
                    <p className="mt-3 font-display text-3xl font-semibold text-ink">
                      {formatCurrency(invite.currentPrincipalAmount, invite.currencyCode)}
                    </p>
                  </div>
                  <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5">
                    <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/80">
                      Pendiente
                    </p>
                    <p className="mt-3 font-display text-3xl font-semibold text-ink">
                      {formatCurrency(invite.pendingAmount, invite.currencyCode)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-[22px] border border-white/10 bg-black/15 p-4">
                    <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">Inicio</p>
                    <p className="mt-3 text-sm font-medium text-ink">{formatDate(invite.startDate)}</p>
                  </div>
                  <div className="rounded-[22px] border border-white/10 bg-black/15 p-4">
                    <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">Fecha objetivo</p>
                    <p className="mt-3 text-sm font-medium text-ink">
                      {invite.dueDate ? formatDate(invite.dueDate) : "Sin fecha"}
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-white/10 bg-black/15 p-4">
                    <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">Abonos</p>
                    <p className="mt-3 text-sm font-medium text-ink">
                      {invite.paymentCount > 0 ? `${invite.paymentCount} registrados` : "Sin abonos aun"}
                    </p>
                  </div>
                </div>

                {invite.share.message ? (
                  <div className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
                    <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/80">Mensaje incluido</p>
                    <p className="mt-3 text-sm leading-8 text-storm">{invite.share.message}</p>
                  </div>
                ) : null}

                {feedback ? (
                  <FormFeedbackBanner
                    className="mt-5"
                    description={feedback.description}
                    title={feedback.title}
                  />
                ) : null}

                <div className="mt-6 rounded-[28px] border border-white/10 bg-[linear-gradient(160deg,rgba(14,23,36,0.92),rgba(9,15,24,0.86))] p-5">
                  {!user ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <MailCheck className="h-5 w-5 text-pine" />
                        <p className="text-sm leading-8 text-storm">
                          Esta invitacion fue enviada a <span className="font-medium text-ink">{invite.share.invitedEmail}</span>.
                        </p>
                      </div>
                      <Button
                        className="w-full sm:w-auto"
                        onClick={() => navigate(loginTarget)}
                      >
                        <LogIn className="mr-2 h-4 w-4" />
                        Iniciar sesion para confirmar
                      </Button>
                    </div>
                  ) : isMatchingUser ? (
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        {isAlreadyAccepted ? (
                          <CheckCircle2 className="mt-1 h-5 w-5 text-pine" />
                        ) : (
                          <Shield className="mt-1 h-5 w-5 text-gold" />
                        )}
                        <div>
                          <p className="text-sm font-medium text-ink">
                            {isAlreadyAccepted
                              ? "Este acceso ya fue confirmado por ti."
                              : "Estas entrando con la cuenta correcta para aceptar esta invitacion."}
                          </p>
                          <p className="mt-2 text-sm leading-8 text-storm">
                            {isAlreadyAccepted
                              ? "Puedes abrir tu modulo de creditos y deudas para revisar el registro en modo solo lectura."
                              : "Al aceptarla, aparecera dentro de tu seccion de creditos y deudas como un registro compartido contigo."}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row">
                        {isAlreadyAccepted ? (
                          <Button
                            onClick={() => navigate("/app/obligations")}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            Ir a creditos y deudas
                          </Button>
                        ) : (
                          <Button
                            disabled={acceptMutation.isPending}
                            onClick={() => {
                              void handleAccept();
                            }}
                          >
                            {acceptMutation.isPending ? (
                              <>
                                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                                Confirmando...
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Aceptar y ver registro
                              </>
                            )}
                          </Button>
                        )}
                        <Button
                          onClick={() => navigate("/app")}
                          variant="secondary"
                        >
                          <ArrowRight className="mr-2 h-4 w-4" />
                          Abrir DarkMoney
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <FormFeedbackBanner
                        description={`Esta invitacion fue enviada a ${invite.share.invitedEmail}. Debes entrar con esa cuenta para aceptarla.`}
                        title="Estas usando otra cuenta"
                      />
                      <Button
                        onClick={() => {
                          void handleSwitchAccount();
                        }}
                        variant="secondary"
                      >
                        <LogIn className="mr-2 h-4 w-4" />
                        Entrar con otra cuenta
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
