alter table public.billing_events
  drop constraint if exists billing_events_provider_chk;

alter table public.billing_events
  add constraint billing_events_provider_chk
  check (provider in ('mercado_pago', 'lemon_squeezy', 'paddle'));

comment on table public.billing_events is
  'Bitacora tecnica de eventos de cobro y webhooks de proveedores externos como Mercado Pago, Lemon Squeezy o Paddle.';
