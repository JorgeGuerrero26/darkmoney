create table if not exists public.user_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_code text not null default 'free',
  pro_access_enabled boolean not null default false,
  billing_status text null,
  billing_provider text null,
  provider_customer_id text null,
  provider_subscription_id text null,
  current_period_start timestamptz null,
  current_period_end timestamptz null,
  cancel_at_period_end boolean not null default false,
  manual_override boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_entitlements_plan_code_chk check (plan_code in ('free', 'pro')),
  constraint user_entitlements_metadata_object_chk check (jsonb_typeof(metadata) = 'object')
);

comment on table public.user_entitlements is
  'Entitlements globales del producto DarkMoney para habilitar funciones premium como Modo Pro.';

comment on column public.user_entitlements.pro_access_enabled is
  'Bandera efectiva de acceso Pro. Permite desacoplar el uso de funciones premium del proveedor de cobro.';

comment on column public.user_entitlements.billing_provider is
  'Proveedor externo de cobro futuro, por ejemplo Stripe o Lemon Squeezy.';

comment on column public.user_entitlements.manual_override is
  'Permite habilitar o mantener acceso manualmente sin depender del webhook de pago.';

create index if not exists idx_user_entitlements_plan
  on public.user_entitlements(plan_code, pro_access_enabled);

create or replace function public.trg_user_entitlements_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_user_entitlements_touch_updated_at on public.user_entitlements;

create trigger trg_user_entitlements_touch_updated_at
before update on public.user_entitlements
for each row
execute function public.trg_user_entitlements_touch_updated_at();

alter table public.user_entitlements enable row level security;

drop policy if exists user_entitlements_select_self on public.user_entitlements;
create policy user_entitlements_select_self
  on public.user_entitlements
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists user_entitlements_manage_service_role on public.user_entitlements;
create policy user_entitlements_manage_service_role
  on public.user_entitlements
  for all
  to service_role
  using (true)
  with check (true);

grant select on public.user_entitlements to authenticated;
grant all on public.user_entitlements to service_role;
