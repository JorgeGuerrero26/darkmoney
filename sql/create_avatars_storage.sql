-- ============================================================
-- BUCKET: avatars
-- ============================================================
-- Crea este bucket manualmente desde el Dashboard de Supabase:
--   Storage → New bucket
--   Name: avatars
--   Public: true  (las URLs son publicas, no necesitan firma)
--   File size limit: 2 MB  (2097152 bytes)
--   Allowed MIME types: image/jpeg, image/png, image/webp
--
-- Luego ejecuta las policies de este archivo en el SQL Editor.
-- ============================================================

-- Columna avatar_url en profiles
alter table profiles
  add column if not exists avatar_url text default null;

-- ── POLICIES ────────────────────────────────────────────────

-- SELECT: cualquiera puede leer (bucket publico)
create policy "Avatars publicos de lectura"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- INSERT: solo usuarios Pro autenticados, solo en su propia carpeta
create policy "Usuario pro puede subir su avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1
      from user_entitlements
      where user_id = auth.uid()
        and pro_access_enabled = true
    )
  );

-- UPDATE: solo el propio usuario puede sobreescribir su avatar
create policy "Usuario puede actualizar su propio avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- DELETE: solo el propio usuario puede eliminar su avatar
create policy "Usuario puede eliminar su propio avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
