-- El neto en amount es el único monto que afecta saldos y proyecciones.
-- Bruto y descuentos guardan el detalle de la boleta sin calcular retenciones.
alter table public.recurring_income
  add column if not exists gross_amount numeric(14,2),
  add column if not exists deductions jsonb not null default '[]'::jsonb,
  add column if not exists is_pinned boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'recurring_income_deductions_is_array') then
    alter table public.recurring_income add constraint recurring_income_deductions_is_array
      check (jsonb_typeof(deductions) = 'array');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'recurring_income_gross_amount_positive') then
    alter table public.recurring_income add constraint recurring_income_gross_amount_positive
      check (gross_amount is null or gross_amount > 0);
  end if;
end $$;
