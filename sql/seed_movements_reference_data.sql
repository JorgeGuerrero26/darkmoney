-- Seed base para poblar los selectores del modulo de movimientos.
-- Reemplaza el workspace_id antes de ejecutar.
-- Si tambien quieres crear una suscripcion de ejemplo, cambia seed_subscription a true.
--
-- Si no sabes tu workspace_id:
-- select id, name, base_currency_code from public.workspaces order by id;

drop table if exists pg_temp.tmp_movement_seed_context;

create temp table tmp_movement_seed_context as
select
  1::bigint as workspace_id,
  null::bigint as default_account_id,
  false as seed_subscription;

with params as (
  select workspace_id, default_account_id
  from tmp_movement_seed_context
),
category_seed(name, kind, color, icon, sort_order) as (
  values
    ('Alimentacion', 'expense', '#2A7D65', 'utensils', 10),
    ('Restaurantes', 'expense', '#15803D', 'utensils-crossed', 20),
    ('Transporte', 'expense', '#3B82F6', 'car', 30),
    ('Combustible', 'expense', '#2563EB', 'fuel', 40),
    ('Servicios', 'expense', '#8B5CF6', 'receipt', 50),
    ('Internet y celular', 'expense', '#7C3AED', 'wifi', 60),
    ('Ropa', 'expense', '#EC4899', 'shirt', 70),
    ('Salud', 'expense', '#EF4444', 'heart-pulse', 80),
    ('Farmacia', 'expense', '#DC2626', 'pill', 90),
    ('Diversion', 'expense', '#F59E0B', 'party-popper', 100),
    ('Educacion', 'expense', '#F97316', 'graduation-cap', 110),
    ('Hogar', 'expense', '#14B8A6', 'home', 120),
    ('Mascotas', 'expense', '#A855F7', 'paw-print', 130),
    ('Viajes', 'expense', '#06B6D4', 'plane', 140),
    ('Regalos', 'expense', '#FB7185', 'gift', 150),
    ('Impuestos', 'expense', '#F97316', 'file-text', 160),
    ('Comisiones bancarias', 'expense', '#64748B', 'landmark', 170),
    ('Suscripciones', 'expense', '#F59E0B', 'sparkles', 180),
    ('Sueldo', 'income', '#16A34A', 'briefcase', 190),
    ('Bonos', 'income', '#22C55E', 'badge-dollar-sign', 200),
    ('Freelance', 'income', '#10B981', 'laptop', 210),
    ('Ventas', 'income', '#F97316', 'banknote', 220),
    ('Intereses', 'income', '#84CC16', 'badge-percent', 230),
    ('Reembolsos', 'income', '#0EA5E9', 'rotate-ccw', 240),
    ('Otros', 'both', '#94A3B8', 'shapes', 250)
)
insert into public.categories (
  workspace_id,
  name,
  kind,
  color,
  icon,
  sort_order,
  is_system,
  is_active
)
select
  p.workspace_id,
  s.name,
  s.kind::category_kind,
  s.color,
  s.icon,
  s.sort_order,
  false,
  true
from params p
cross join category_seed s
where not exists (
  select 1
  from public.categories c
  where c.workspace_id = p.workspace_id
    and lower(c.name) = lower(s.name)
);

with params as (
  select workspace_id
  from tmp_movement_seed_context
),
counterparty_seed(name, type, email, notes) as (
  values
    ('BCP', 'bank', null, 'Banco de ejemplo para obligaciones'),
    ('Supermercado Metro', 'merchant', null, 'Comercio frecuente de ejemplo'),
    ('Cliente Demo', 'company', 'cliente@example.com', 'Cliente de ejemplo para ingresos'),
    ('Netflix', 'service', null, 'Proveedor de suscripcion de ejemplo')
)
insert into public.counterparties (
  workspace_id,
  name,
  type,
  email,
  notes,
  is_archived
)
select
  p.workspace_id,
  s.name,
  s.type::party_type,
  s.email,
  s.notes,
  false
from params p
cross join counterparty_seed s
where not exists (
  select 1
  from public.counterparties cp
  where cp.workspace_id = p.workspace_id
    and lower(cp.name) = lower(s.name)
);

with params as (
  select workspace_id, default_account_id
  from tmp_movement_seed_context
)
insert into public.obligations (
  workspace_id,
  direction,
  origin_type,
  status,
  title,
  counterparty_id,
  settlement_account_id,
  currency_code,
  principal_amount,
  start_date,
  due_date,
  installment_amount,
  installment_count,
  interest_rate,
  description,
  notes
)
select
  p.workspace_id,
  'payable'::obligation_direction,
  'cash_loan'::obligation_origin_type,
  'active'::obligation_status,
  'Prestamo personal BCP',
  cp.id,
  p.default_account_id,
  'PEN',
  1500.00,
  current_date,
  (current_date + interval '180 days')::date,
  250.00,
  6,
  0.0000,
  'Obligacion de ejemplo para poblar el selector de movimientos.',
  'Seed inicial desde sql/seed_movements_reference_data.sql'
from params p
join public.counterparties cp
  on cp.workspace_id = p.workspace_id
 and lower(cp.name) = lower('BCP')
where not exists (
  select 1
  from public.obligations o
  where o.workspace_id = p.workspace_id
    and lower(o.title) = lower('Prestamo personal BCP')
);

-- Opcional: ejecuta tambien este bloque si quieres poblar el selector de suscripciones.
with params as (
  select workspace_id, default_account_id, seed_subscription
  from tmp_movement_seed_context
)
insert into public.subscriptions (
  workspace_id,
  name,
  vendor_party_id,
  account_id,
  category_id,
  currency_code,
  amount,
  frequency,
  interval_count,
  day_of_month,
  start_date,
  next_due_date,
  status,
  auto_create_movement,
  remind_days_before,
  description,
  notes
)
select
  p.workspace_id,
  'Netflix',
  vendor.id,
  p.default_account_id,
  cat.id,
  'PEN',
  44.90,
  'monthly'::subscription_frequency,
  1,
  least(extract(day from current_date)::smallint, 28::smallint),
  current_date,
  (current_date + interval '1 month')::date,
  'active'::subscription_status,
  false,
  3,
  'Suscripcion de ejemplo para poblar el selector de movimientos.',
  'Seed inicial desde sql/seed_movements_reference_data.sql'
from params p
join public.counterparties vendor
  on vendor.workspace_id = p.workspace_id
 and lower(vendor.name) = lower('Netflix')
join public.categories cat
  on cat.workspace_id = p.workspace_id
 and lower(cat.name) = lower('Suscripciones')
where not exists (
  select 1
  from public.subscriptions s
  where s.workspace_id = p.workspace_id
    and lower(s.name) = lower('Netflix')
) and p.seed_subscription;

select 'categories' as table_name, count(*) as total
from public.categories
where workspace_id = (select workspace_id from tmp_movement_seed_context)
union all
select 'counterparties' as table_name, count(*) as total
from public.counterparties
where workspace_id = (select workspace_id from tmp_movement_seed_context)
union all
select 'obligations' as table_name, count(*) as total
from public.obligations
where workspace_id = (select workspace_id from tmp_movement_seed_context)
union all
select 'subscriptions' as table_name, count(*) as total
from public.subscriptions
where workspace_id = (select workspace_id from tmp_movement_seed_context);

drop table if exists pg_temp.tmp_movement_seed_context;
