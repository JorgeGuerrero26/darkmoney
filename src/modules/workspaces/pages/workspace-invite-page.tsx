import { ArrowRight, CheckCircle2, LoaderCircle, LogIn, MailCheck, Shield, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { BrandBanner } from "../../../components/ui/brand-logo";
import { Button } from "../../../components/ui/button";
import { FormFeedbackBanner } from "../../../components/ui/form-feedback-banner";
import {
  useAcceptWorkspaceInvitationMutation,
  useWorkspaceInvitationDetailsQuery,
} from "../../../services/queries/workspace-data";
import { useWorkspaceStore } from "../../../stores/workspace-store";
import { useAuth } from "../../auth/auth-context";
import { clearPendingInvite, savePendingInvite } from "../../auth/invite-resume";

function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() ?? "";
}

function getRoleLabel(role: "owner" | "admin" | "member" | "viewer") {
  switch (role) {
    case "admin":
      return "Administrador";
    case "viewer":
      return "Solo lectura";
    case "owner":
      return "Propietario";
    default:
      return "Miembro";
  }
}

function getInvitationStatusLabel(status: "pending" | "accepted" | "declined" | "expired" | "revoked") {
  switch (status) {
    case "accepted":
      return "Acceso ya confirmado";
    case "declined":
      return "Invitación rechazada";
    case "expired":
      return "Invitación expirada";
    case "revoked":
      return "Invitación revocada";
    default:
      return "Pendiente de confirmación";
  }
}

export function WorkspaceInvitePage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, signOut, user } = useAuth();
  const setActiveWorkspaceId = useWorkspaceStore((state) => state.setActiveWorkspaceId);
  const inviteQuery = useWorkspaceInvitationDetailsQuery(token);
  const acceptMutation = useAcceptWorkspaceInvitationMutation(user?.id);
  const [feedback, setFeedback] = useState<{ title: string; description: string } | null>(null);
  const invite = inviteQuery.data;
  const currentEmail = normalizeEmail(user?.email ?? profile?.email);
  const invitedEmail = normalizeEmail(invite?.invitation.invitedEmail);
  const isMatchingUser = Boolean(
    invite &&
      user &&
      (user.id === invite.invitation.invitedUserId || currentEmail === invitedEmail),
  );
  const isAlreadyAccepted = invite?.invitation.status === "accepted";
  const loginTarget = `/auth/login?next=${encodeURIComponent(location.pathname)}`;

  const statusLabel = useMemo(() => {
    if (!invite) {
      return "";
    }

    return getInvitationStatusLabel(invite.invitation.status);
  }, [invite]);

  useEffect(() => {
    if (!token) {
      clearPendingInvite();
      return;
    }

    if (inviteQuery.isError || (inviteQuery.isFetched && !invite)) {
      clearPendingInvite();
      return;
    }

    if (isAlreadyAccepted) {
      clearPendingInvite();
      return;
    }

    savePendingInvite({
      kind: "workspace",
      path: location.pathname,
      token,
    });
  }, [invite, inviteQuery.isError, inviteQuery.isFetched, isAlreadyAccepted, location.pathname, token]);

  async function handleAccept() {
    if (!token) {
      return;
    }

    setFeedback(null);

    try {
      const result = await acceptMutation.mutateAsync(token);
      clearPendingInvite();
      setActiveWorkspaceId(result.workspaceId);
      navigate("/app/settings", { replace: true });
    } catch (error) {
      setFeedback({
        title: "No pudimos confirmar el acceso",
        description:
          error instanceof Error
            ? error.message
            : "Inténtalo otra vez dentro de unos segundos.",
      });
    }
  }

  async function handleSwitchAccount() {
    await signOut();
    navigate(loginTarget, { replace: true });
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(69,102,214,0.16),transparent_28%),linear-gradient(180deg,#040911_0%,#08111b_42%,#060b12_100%)] px-4 py-8 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center">
        <div className="grid w-full gap-8 lg:grid-cols-[0.98fr_1.02fr]">
          <section className="rounded-[36px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,14,22,0.96),rgba(6,10,17,0.92))] p-5 shadow-[0_35px_120px_rgba(0,0,0,0.42)] sm:p-7">
            <BrandBanner
              className="h-[220px] w-full rounded-[28px]"
              imageClassName="object-cover object-center"
            />

            <div className="mt-6">
              <div className="inline-flex items-center rounded-full border border-[#a8b9ff]/18 bg-[#4566d6]/[0.14] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[#a8b9ff]">
                Workspace colaborativo
              </div>
              <h1 className="mt-4 font-display text-4xl font-semibold text-ink sm:text-[3.15rem]">
                Confirma tu acceso compartido en DarkMoney
              </h1>
              <p className="mt-4 max-w-xl text-base leading-9 text-storm">
                Cuando aceptes, este workspace aparecerá en tu selector y podrás revisar sus
                cuentas, movimientos, presupuestos, suscripciones y créditos o deudas según tu rol.
              </p>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/80">
                  Invitación enviada por
                </p>
                <p className="mt-3 text-lg font-semibold text-ink">
                  {invite?.invitation.invitedByDisplayName ?? "Usuario DarkMoney"}
                </p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/80">Estado</p>
                <p className="mt-3 text-lg font-semibold text-ink">
                  {invite ? statusLabel : "Cargando invitación"}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[36px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,13,21,0.98),rgba(6,10,16,0.95))] p-5 shadow-[0_35px_120px_rgba(0,0,0,0.42)] sm:p-7">
            {inviteQuery.isLoading ? (
              <div className="flex min-h-[520px] items-center justify-center">
                <div className="text-center">
                  <LoaderCircle className="mx-auto h-10 w-10 animate-spin text-pine" />
                  <p className="mt-4 text-sm text-storm">Cargando los detalles de esta invitación...</p>
                </div>
              </div>
            ) : inviteQuery.error ? (
              <FormFeedbackBanner
                description={inviteQuery.error instanceof Error ? inviteQuery.error.message : "No pudimos abrir este enlace."}
                title="No pudimos cargar la invitación"
              />
            ) : !invite ? (
              <FormFeedbackBanner
                description="El enlace puede haber vencido o ya no estar disponible."
                title="Invitación no disponible"
              />
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/90">
                    {statusLabel}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/90">
                    {getRoleLabel(invite.invitation.role)}
                  </span>
                </div>

                <h2 className="mt-4 font-display text-3xl font-semibold text-ink sm:text-[2.6rem]">
                  {invite.workspace.name}
                </h2>
                <p className="mt-3 text-base leading-8 text-storm">
                  {invite.workspace.description || "Workspace compartido sin descripción adicional."}
                </p>

                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5">
                    <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/80">
                      Tu rol
                    </p>
                    <p className="mt-3 font-display text-2xl font-semibold text-ink">
                      {getRoleLabel(invite.invitation.role)}
                    </p>
                  </div>
                  <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5">
                    <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/80">
                      Moneda base
                    </p>
                    <p className="mt-3 font-display text-2xl font-semibold text-ink">
                      {invite.workspace.baseCurrencyCode}
                    </p>
                  </div>
                  <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5">
                    <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/80">
                      Tipo
                    </p>
                    <p className="mt-3 font-display text-2xl font-semibold text-ink">
                      Compartido
                    </p>
                  </div>
                </div>

                {invite.invitation.note ? (
                  <div className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
                    <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/80">Mensaje incluido</p>
                    <p className="mt-3 text-sm leading-8 text-storm">{invite.invitation.note}</p>
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
                          Esta invitación fue enviada a <span className="font-medium text-ink">{invite.invitation.invitedEmail}</span>.
                        </p>
                      </div>
                      <Button
                        className="w-full sm:w-auto"
                        onClick={() => navigate(loginTarget)}
                      >
                        <LogIn className="mr-2 h-4 w-4" />
                        Iniciar sesión para confirmar
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
                              : "Estás entrando con la cuenta correcta para aceptar esta invitación."}
                          </p>
                          <p className="mt-2 text-sm leading-8 text-storm">
                            {isAlreadyAccepted
                              ? "Puedes abrir DarkMoney y cambiar al workspace compartido desde el selector superior."
                              : "Al aceptarla, este workspace aparecerá en tu selector con el rol indicado y podrás empezar a revisarlo."}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row">
                        {isAlreadyAccepted ? (
                          <Button
                            onClick={() => navigate("/app/settings")}
                          >
                            <Users className="mr-2 h-4 w-4" />
                            Ir a workspaces
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
                                Aceptar workspace
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
                        description={`Esta invitación fue enviada a ${invite.invitation.invitedEmail}. Debes entrar con esa cuenta para aceptarla.`}
                        title="Estás usando otra cuenta"
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
