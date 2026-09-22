alter table public.subscriptions
  add column if not exists is_pinned boolean not null default false;

create index if not exists idx_subscriptions_workspace_pinned
  on public.subscriptions (workspace_id)
  where is_pinned = true;
