import { useEffect, useId, useRef, useState } from "react";
import { Button } from "../../../components/ui/button";
import { notificationDeliveryState, useNotificationDeliveryQuery, useSaveNotificationDeliveryTopicMutation, type DeliveryTopic } from "../../../services/queries/notification-delivery";

export function NotificationDeliveryPreferences({ userId }: { userId?: string }) {
  return <ScopedDeliveryPreferences key={userId ?? "signed-out"} userId={userId} />;
}

function ScopedDeliveryPreferences({ userId }: { userId?: string }) {
  const query = useNotificationDeliveryQuery(userId);
  const mutation = useSaveNotificationDeliveryTopicMutation(userId);
  const [pending, setPending] = useState<DeliveryTopic | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const flight = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const id = useId();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; flight.current?.abort(); }; }, []);
  const data = query.data, state = notificationDeliveryState(data);
  const ready = Boolean(userId && query.isSuccess && !query.isFetching && data?.userId === userId);
  const writable = ready && state.pushReady && !pending && !mutation.isPending && !error;

  async function refresh() {
    const result = await query.refetch();
    if (mounted.current && result.isSuccess) setError("");
  }

  async function toggle(topic: DeliveryTopic) {
    if (!writable || !data || flight.current) return;
    const controller = new AbortController(); flight.current = controller;
    setPending(topic); setMessage(""); setError("");
    try {
      await mutation.mutateAsync({ topic, enabled: !data[topic], expectedEnabled: data[topic], signal: controller.signal });
      if (mounted.current && !controller.signal.aborted) setMessage("Preferencia guardada para los avisos de tu teléfono. Esto no confirma la entrega de una notificación.");
    } catch (cause) {
      if (mounted.current && !controller.signal.aborted) setError(`${cause instanceof Error ? cause.message : "No se pudo confirmar el guardado."} Actualiza antes de volver a intentarlo.`);
    } finally {
      if (flight.current === controller) flight.current = null;
      if (mounted.current) setPending(null);
    }
  }

  if (!userId) return <p className="border-t border-white/[0.09] py-5 text-sm text-storm">Inicia sesión para consultar los avisos de tu teléfono.</p>;
  return <section aria-labelledby={`${id}-title`} className="border-t border-white/[0.09] py-5">
    <h3 className="text-sm font-medium text-ink" id={`${id}-title`}>Avisos de tu teléfono</h3>
    <p className="mt-2 text-sm leading-6 text-storm">Estos temas se guardan al cambiarlos y usan las mismas preferencias que la app móvil. No activan notificaciones del navegador ni registran otro dispositivo.</p>
    {query.isError ? <div className="mt-4" role="alert"><p className="text-sm text-storm">No pudimos comprobar los avisos. No cambiamos preferencias con una lectura fallida.</p><Button onClick={() => void refresh()} variant="ghost">Actualizar avisos</Button></div>
      : !ready ? <p className="mt-4 text-sm text-storm" role="status">Comprobando tus preferencias…</p>
      : <>
        <p className="mt-3 text-sm text-storm">{state.pushReady ? "Canal activo con token registrado. La entrega depende del teléfono, sus permisos y el servicio de avisos." : "Sin canal activo con token. Activa los avisos desde Configuración en tu teléfono; las preferencias guardadas se conservan."}</p>
        {([ ["dailyDigestEnabled", "Resumen diario", "Un resumen de tu actividad financiera."], ["predictiveAlertsEnabled", "Alertas predictivas", "Avisos anticipados de compromisos y posibles faltantes."] ] as const).map(([topic, title, description]) => <div className="mt-4 flex min-h-14 items-center justify-between gap-5 border-t border-white/[0.07] pt-4" key={topic}>
          <div><label className="text-sm font-medium text-ink" htmlFor={`${id}-${topic}`}>{title}</label><p className="mt-1 text-sm leading-6 text-storm" id={`${id}-${topic}-hint`}>{description}{!state.pushReady ? ` Preferencia guardada: ${data?.[topic] ? "activada" : "desactivada"}; sin entrega habilitada.` : ""}</p></div>
          <button aria-checked={topic === "dailyDigestEnabled" ? state.dailyDigestActive : state.predictiveAlertsActive} aria-describedby={`${id}-${topic}-hint`} aria-label={title} className="inline-flex min-h-11 shrink-0 items-center gap-3 rounded-[7px] px-2 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-50" disabled={!writable} id={`${id}-${topic}`} onClick={() => void toggle(topic)} role="switch" type="button">
            <span>{pending === topic ? "Guardando…" : (topic === "dailyDigestEnabled" ? state.dailyDigestActive : state.predictiveAlertsActive) ? "Activado" : "Desactivado"}</span>
            <span aria-hidden="true" className={`relative inline-flex h-6 w-10 rounded-full border transition-colors duration-150 motion-reduce:transition-none ${(topic === "dailyDigestEnabled" ? state.dailyDigestActive : state.predictiveAlertsActive) ? "border-ink bg-ink" : "border-white/20 bg-white/[0.04]"}`}><span className={`absolute top-0.5 h-[18px] w-[18px] rounded-full transition-transform duration-150 motion-reduce:transition-none ${(topic === "dailyDigestEnabled" ? state.dailyDigestActive : state.predictiveAlertsActive) ? "translate-x-[18px] bg-void" : "translate-x-0.5 bg-ink"}`} /></span>
          </button>
        </div>)}
      </>}
    {message ? <p className="mt-4 text-sm text-storm" role="status">{message}</p> : null}
    {error ? <div className="mt-4" role="alert"><p className="text-sm text-storm">{error}</p><Button disabled={query.isFetching || Boolean(pending)} onClick={() => void refresh()} variant="ghost">Actualizar avisos</Button></div> : null}
  </section>;
}
