create table if not exists public.attachments (
  id bigint generated always as identity primary key,
  workspace_id bigint not null references public.workspaces(id) on delete cascade,
  entity_type text not null check (entity_type in ('movement', 'obligation', 'subscription')),
  entity_id bigint not null,
  bucket_name text not null default 'receipts',
  file_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  width integer,
  height integer,
  uploaded_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

comment on table public.attachments is
  'Metadata de adjuntos y comprobantes guardados en Storage.';

comment on column public.attachments.entity_type is
  'Entidad funcional dueña del archivo: movement, obligation o subscription.';

comment on column public.attachments.file_path is
  'Ruta exacta en Storage. La estructura esperada es workspace_id/entity_type/entity_id/uuid.webp.';

create index if not exists idx_attachments_workspace
  on public.attachments(workspace_id);

create index if not exists idx_attachments_entity
  on public.attachments(entity_type, entity_id);

create index if not exists idx_attachments_uploaded_by
  on public.attachments(uploaded_by_user_id, created_at desc);

alter table public.attachments enable row level security;

drop policy if exists attachments_select_workspace_members on public.attachments;
create policy attachments_select_workspace_members
  on public.attachments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = attachments.workspace_id
        and wm.user_id = auth.uid()
    )
  );

drop policy if exists attachments_insert_workspace_members on public.attachments;
create policy attachments_insert_workspace_members
  on public.attachments
  for insert
  to authenticated
  with check (
    uploaded_by_user_id = auth.uid()
    and exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = attachments.workspace_id
        and wm.user_id = auth.uid()
    )
  );

drop policy if exists attachments_delete_workspace_members on public.attachments;
create policy attachments_delete_workspace_members
  on public.attachments
  for delete
  to authenticated
  using (
    uploaded_by_user_id = auth.uid()
    or exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = attachments.workspace_id
        and wm.user_id = auth.uid()
    )
  );

grant select, insert, delete on public.attachments to authenticated;
grant all on public.attachments to service_role;
grant usage, select on sequence public.attachments_id_seq to authenticated;
grant all on sequence public.attachments_id_seq to service_role;
