-- Soporte de archivado para notificaciones (web + móvil).
-- Añade una columna nullable archived_at; NULL = activa, timestamp = archivada.
-- El fetch del cliente cae con gracia si la columna aún no existe, así que esta
-- migración se puede aplicar sin downtime y antes/después de desplegar el front.

alter table public.notifications
  add column if not exists archived_at timestamptz;

create index if not exists notifications_user_archived_idx
  on public.notifications (user_id, archived_at);
