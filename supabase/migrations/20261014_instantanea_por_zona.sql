-- ═══ UNA INSTANTÁNEA DE PRECIOS POR ZONA ═══
--
-- Hasta aquí había una sola instantánea activa por cadena y la versión era la
-- clave primaria: Madrid y Gran Canaria con la misma fecha chocaban, y la RPC no
-- sabía de zonas. La app (src/lib/precios.ts) ya rechaza una instantánea de otra
-- zona; esto hace que el servidor pueda servir la de cada una.
--
-- Orden de despliegue (ver docs/beta-privada-2026-10-14.md):
--   1. esta migración;
--   2. publicar Madrid y Gran Canaria con `supabase.ts publicar --zona …`;
--   3. solo entonces, la app con VITE_PRECIOS_URL terminada en `&p_zona={zona}`.
-- Una app vieja sigue funcionando: `p_zona` tiene 'madrid' por defecto.
--
-- Idempotente: se puede repetir. Copia exacta en catalogo/esquema-precios.sql.

alter table instantanea add column if not exists zona text not null default 'madrid';

do $$
begin
  alter table instantanea drop constraint if exists instantanea_pkey;
  alter table instantanea add constraint instantanea_pkey primary key (cadena, zona, version);
end $$;

drop index if exists instantanea_una_activa;
create unique index if not exists instantanea_una_activa_por_zona
  on instantanea (cadena, zona) where activa;

drop function if exists instantanea_actual(text);
create or replace function instantanea_actual(p_cadena text default 'mercadona', p_zona text default 'madrid')
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select datos from instantanea where cadena = p_cadena and zona = p_zona and activa limit 1;
$$;
revoke execute on function instantanea_actual(text, text) from public;
grant execute on function instantanea_actual(text, text) to anon;

notify pgrst, 'reload schema';
