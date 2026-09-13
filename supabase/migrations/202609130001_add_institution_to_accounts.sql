alter table public.accounts
  add column if not exists institution_code text;

comment on column public.accounts.institution_code is
  'Optional slug resolved against the client-side account institution catalog.';
