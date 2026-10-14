-- ═══ EL CATÁLOGO Y SU HISTORIAL ═══
--
-- Tres piezas con tres trabajos distintos, y conviene no confundirlos:
--
--   producto     qué es cada referencia. Cambia poco.
--   precio       cuánto costaba, y CUÁNDO. Una fila por captura.
--   instantanea  lo que la app se descarga. Es un artefacto, no la verdad.
--
-- Se aplica con:  node --experimental-strip-types catalogo/supabase.ts esquema

-- ---------------------------------------------------------------------------
-- PRODUCTO
-- ---------------------------------------------------------------------------
create table if not exists producto (
  cadena          text    not null,
  sku             text    not null,
  nombre          text    not null,
  -- El EAN es lo que permite contrastar alérgenos contra la etiqueta real.
  -- Nullable porque el volcado de Mercadona no siempre lo trae, pero sin él un
  -- producto NO puede entrar en una receta con filtros de alergia.
  ean             text,
  contenido       numeric not null,
  unidad          text    not null,
  packaging       text,
  unidades_pack   integer,
  peso_variable   boolean not null default false,
  departamento    text,
  subfamilia      text,
  -- Los que desaparecen NO se borran: se marcan. A los 14 días sin verse,
  -- descatalogado. Borrarlos perdería la razón por la que se fueron.
  ultima_vez_visto timestamptz not null default now(),
  primary key (cadena, sku)
);

-- ---------------------------------------------------------------------------
-- PRECIO
-- ---------------------------------------------------------------------------
--
-- `capturado_en` ESTÁ EN LA CLAVE PRIMARIA, y es deliberado.
--
-- Es lo que convierte esta tabla en el historial. Con un `update` por SKU se
-- tendría el precio de hoy y nada más: no se podría decir «esto costaba 2,40 €
-- hace un mes», que es la única forma de demostrarle a alguien que la app le
-- está ahorrando dinero. Y es un dato que no se puede reconstruir después: si
-- no se guarda hoy, se perdió hoy.
--
-- Cuesta una fila por producto y día. Con 117 SKU son 43.000 filas al año.
create table if not exists precio (
  cadena          text        not null,
  sku             text        not null,
  almacen         text        not null,
  precio          numeric     not null check (precio > 0),
  precio_unidad   numeric,
  capturado_en    timestamptz not null,
  primary key (cadena, sku, almacen, capturado_en)
);

-- Para «dame el último precio de cada SKU», que es la consulta que hace el
-- publicador. Sin este índice recorre el historial entero.
create index if not exists precio_ultimo
  on precio (cadena, almacen, sku, capturado_en desc);

-- ---------------------------------------------------------------------------
-- INSTANTÁNEA
-- ---------------------------------------------------------------------------
--
-- Lo que la app se descarga, ya empaquetado. NO se genera al vuelo desde
-- `precio`: publicar es una decisión de una persona, no un efecto secundario de
-- que el cron haya corrido. El cron escribe SIEMPRE en `precio` —guardar
-- historial nunca hace daño— y publicar es un paso aparte con sus
-- comprobaciones. Ver catalogo/aplicar-precios.js.
create table if not exists instantanea (
  version       text        primary key,
  cadena        text        not null,
  almacen       text        not null,
  -- El JSON tal cual lo consume el cliente. Ver src/lib/precios.ts.
  datos         jsonb       not null,
  publicada_en  timestamptz not null default now(),
  -- Solo una puede estar activa. La app pide ésta.
  activa        boolean     not null default false
);

-- Que no pueda haber dos activas a la vez: la app pediría una cualquiera.
create unique index if not exists instantanea_una_activa
  on instantanea (cadena) where activa;

-- ---------------------------------------------------------------------------
-- LECTURA PÚBLICA · SOLO LA INSTANTÁNEA ACTIVA
-- ---------------------------------------------------------------------------
--
-- La app lee con la clave `publishable`, que va dentro del APK y por tanto es
-- pública de facto. Así que lo que esa clave puede leer tiene que ser
-- exactamente lo que se publica y nada más: ni el historial de precios, ni la
-- tabla de productos, ni las instantáneas retiradas.
alter table producto    enable row level security;
alter table precio      enable row level security;
alter table instantanea enable row level security;

-- Sin políticas, `producto` y `precio` quedan cerradas a la clave pública. Es
-- lo que se quiere: son de la cocina, no del escaparate.
drop policy if exists instantanea_activa_publica on instantanea;
create policy instantanea_activa_publica
  on instantanea for select
  to anon
  using (activa);

-- ---------------------------------------------------------------------------
-- LO QUE PIDE LA APP
-- ---------------------------------------------------------------------------
--
-- Una función y no la tabla, por una razón concreta: PostgREST devuelve las
-- consultas a tablas envueltas en un array —`[{"datos": {...}}]`— y el cliente
-- espera la instantánea a pelo. Se puede desenvolver en el cliente, pero eso
-- ata `src/lib/precios.ts` a la forma de PostgREST, y ese fichero está escrito
-- a propósito para tragarse una URL cualquiera: Supabase hoy, un fichero
-- estático mañana. El desenvoltorio se hace aquí, que es de donde viene el
-- envoltorio.
--
-- `stable` para que se pueda pedir por GET. `security definer` porque tiene que
-- leer la tabla sin depender de las políticas — su propio WHERE ya limita a la
-- activa, que es exactamente lo que se publica.
create or replace function instantanea_actual(p_cadena text default 'mercadona')
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select datos from instantanea where cadena = p_cadena and activa limit 1;
$$;

grant execute on function instantanea_actual(text) to anon;

-- PostgREST cachea el esquema y no se entera de una función nueva hasta que se
-- le avisa. Sin esto, la app recibe un 404 de un endpoint que existe.
notify pgrst, 'reload schema';

-- ═══ Desde el 14 oct 2026: una instantánea por zona ═══
-- Igual que supabase/migrations/20261014_instantanea_por_zona.sql.

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
