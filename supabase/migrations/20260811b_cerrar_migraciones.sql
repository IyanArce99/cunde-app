-- ════════════════════════════════════════════════════════════════════════════
-- CERRAR LA TABLA `migraciones` AL CLIENTE
--
-- La creó `catalogo/migrar.ts` y heredó los permisos por defecto del esquema
-- `public`, que en este proyecto dan a `anon` todo: SELECT, INSERT, UPDATE,
-- DELETE y TRUNCATE.
--
-- Hoy no es explotable —RLS está activada y no hay ninguna política, así que
-- deniega todo— pero es una bomba de relojería: el día que alguien añada una
-- política permisiva «para poder leer algo», `anon` recupera de golpe el
-- permiso de BORRAR el registro de migraciones.
--
-- El cliente no tiene nada que hacer aquí. Esta tabla solo la toca `migrar.ts`,
-- que se conecta con la contraseña de la base de datos.
-- ════════════════════════════════════════════════════════════════════════════

revoke all on public.migraciones from anon, authenticated;

comment on table public.migraciones is
  'Qué migraciones se han aplicado. La escribe catalogo/migrar.ts con la '
  'contraseña de la BD. Sin permisos para anon: el cliente no la necesita.';
