-- Silenciar notificaciones por tipo (kind). Guarda en notification_preferences
-- un arreglo JSON de kinds silenciados; el cliente oculta esos tipos de la bandeja.
-- El fetch cae con gracia si la columna aún no existe, así que se puede aplicar
-- sin downtime y en cualquier orden respecto al despliegue del front.

alter table public.notification_preferences
  add column if not exists muted_kinds jsonb not null default '[]'::jsonb;
