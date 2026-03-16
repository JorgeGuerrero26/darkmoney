drop policy if exists receipts_select_workspace_members on storage.objects;
create policy receipts_select_workspace_members
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'receipts'
    and exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id::text = split_part(name, '/', 1)
        and wm.user_id = auth.uid()
    )
  );

drop policy if exists receipts_insert_pro_members on storage.objects;
create policy receipts_insert_pro_members
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'receipts'
    and exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id::text = split_part(name, '/', 1)
        and wm.user_id = auth.uid()
    )
    and (
      lower(coalesce(auth.jwt() ->> 'email', '')) = 'joradrianmori@gmail.com'
      or exists (
        select 1
        from public.user_entitlements ue
        where ue.user_id = auth.uid()
          and ue.pro_access_enabled = true
      )
    )
  );

drop policy if exists receipts_delete_pro_members on storage.objects;
create policy receipts_delete_pro_members
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'receipts'
    and exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id::text = split_part(name, '/', 1)
        and wm.user_id = auth.uid()
    )
    and (
      lower(coalesce(auth.jwt() ->> 'email', '')) = 'joradrianmori@gmail.com'
      or exists (
        select 1
        from public.user_entitlements ue
        where ue.user_id = auth.uid()
          and ue.pro_access_enabled = true
      )
    )
  );
