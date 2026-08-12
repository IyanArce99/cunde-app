-- ════════════════════════════════════════════════════════════════════════════
-- ANALÍTICA DE PRODUCTO · tabla, RPC y permisos
--
-- La métrica principal de Cunde no son descargas ni sesiones: es qué parte de
-- la gente genera una SEGUNDA semana, y luego una tercera y una cuarta. Todo
-- esto existe para poder contestar eso con SQL.
--
-- Ver docs/analytics.md.
--
-- ═══ NO TOCA NADA DE PRECIOS ═══
--
-- `producto`, `precio` e `instantanea` son otro subsistema, con su cron y sus
-- permisos. Esta migración no los lee, no los modifica y no cambia un solo
-- grant suyo. Si algún día se separan en dos proyectos de Supabase, esta tabla
-- se lleva sola.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.analytics_events (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),

  -- ═══ IDEMPOTENCIA ═══
  -- Lo genera el cliente. Sin esto, un lote que llega al servidor pero cuya
  -- respuesta se pierde por el camino —el caso normal de una cola offline en un
  -- sótano— se reenvía y duplica todo. Con UNIQUE + ON CONFLICT DO NOTHING,
  -- reenviar es gratis.
  event_id      uuid not null unique,

  event_name    text not null,

  -- Identificación anónima. `install_id` es un UUID aleatorio del dispositivo:
  -- no sale de un correo, ni de un nombre, ni de un identificador publicitario.
  install_id    uuid not null,
  session_id    uuid,

  app_version   text,
  platform      text,

  -- En columna y no dentro de `properties` porque es la dimensión de la métrica
  -- principal: con esto, «semana 2/3/4» es un `where`, no un `jsonb ->>`.
  week_number   integer,
  screen        text,

  -- Cuándo pasó DE VERDAD. `created_at` es cuándo llegó, y con cola offline
  -- pueden ser días distintos: sin este campo, una semana entera de uso sin
  -- cobertura aparecería toda el día que el usuario recuperó red.
  ocurrido_en   timestamptz,

  properties    jsonb not null default '{}'::jsonb,

  -- ═══ LÍMITES EN LA PROPIA TABLA ═══
  -- La RPC ya valida, pero estas restricciones son la última línea: aunque
  -- alguien cambiara la función, la tabla no admite basura.
  constraint analytics_event_name_valido
    check (event_name <> '' and length(event_name) <= 64),
  constraint analytics_screen_valido
    check (screen is null or length(screen) <= 40),
  constraint analytics_week_number_valido
    check (week_number is null or (week_number >= 0 and week_number <= 1000)),
  constraint analytics_platform_valido
    check (platform is null or platform in ('android', 'ios', 'web')),
  constraint analytics_properties_acotado
    check (pg_column_size(properties) <= 4096)
);

-- ─── Índices ────────────────────────────────────────────────────────────────
-- Cuatro, y ni uno más. La tabla es pequeña en la beta y cada índice se paga en
-- cada inserción; aquí las inserciones son el 99% del tráfico.

create index if not exists analytics_events_install_id_idx
  on public.analytics_events (install_id);

-- Compuesto (event_name, created_at): sirve para filtrar por evento, para
-- filtrar por evento y fecha, y —por ser prefijo— sustituye a un índice suelto
-- sobre event_name. Uno en vez de dos.
create index if not exists analytics_events_name_fecha_idx
  on public.analytics_events (event_name, created_at);

create index if not exists analytics_events_created_at_idx
  on public.analytics_events (created_at);

-- El de la métrica principal: «cuántos install_id distintos llegan a la semana
-- N». Parcial, porque solo `week_generated` responde esa pregunta y así el
-- índice ocupa una fracción.
create index if not exists analytics_events_semana_idx
  on public.analytics_events (week_number, install_id)
  where event_name = 'week_generated';

-- ─── RLS y permisos ─────────────────────────────────────────────────────────
--
-- La tabla queda CERRADA al cliente. Con RLS activada y sin una sola política,
-- ni `anon` ni `authenticated` pueden leer, insertar, actualizar ni borrar —ni
-- siquiera con la clave publishable, que viaja dentro del APK y por tanto hay
-- que dar por conocida.
--
-- La única puerta es `track_events`, que es `security definer`: se ejecuta con
-- los permisos de su propietario y salta RLS, pero solo hace lo que hace.

alter table public.analytics_events enable row level security;

revoke all on public.analytics_events from anon, authenticated;
revoke all on sequence public.analytics_events_id_seq from anon, authenticated;

-- ─── La RPC ─────────────────────────────────────────────────────────────────
--
-- POR LOTES y no de uno en uno: marcar cuarenta casillas de la compra no puede
-- ser cuarenta peticiones, y al recuperar cobertura la cola se vacía de golpe.
--
-- `security definer` obliga a tres cuidados, y los tres están:
--   1. `set search_path = public, pg_temp` — sin fijarlo, quien llama puede
--      anteponer un esquema suyo y hacer que `analytics_events` apunte a otra
--      tabla. Es la vulnerabilidad clásica de estas funciones.
--   2. No se interpola nada en SQL dinámico: no hay `execute`.
--   3. `revoke execute from public` y luego un grant explícito, porque en
--      Postgres toda función nace ejecutable por `public`.

create or replace function public.track_events(p_events jsonb)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_insertados integer;
begin
  -- Ni un array vacío ni un camión. 50 es lo que manda el cliente por lote; se
  -- deja margen hasta 100 por si algún día cambia, y se corta ahí: sin tope,
  -- una sola petición podría insertar un millón de filas.
  if p_events is null or jsonb_typeof(p_events) <> 'array' then
    raise exception 'p_events tiene que ser un array jsonb';
  end if;

  if jsonb_array_length(p_events) = 0 then
    return 0;
  end if;

  if jsonb_array_length(p_events) > 100 then
    raise exception 'lote demasiado grande: % eventos (máximo 100)',
      jsonb_array_length(p_events);
  end if;

  insert into public.analytics_events (
    event_id, event_name, install_id, session_id,
    app_version, platform, week_number, screen, ocurrido_en, properties
  )
  select
    (e ->> 'event_id')::uuid,
    left(e ->> 'event_name', 64),
    (e ->> 'install_id')::uuid,
    nullif(e ->> 'session_id', '')::uuid,
    left(nullif(e ->> 'app_version', ''), 32),
    -- Cualquier plataforma que no sea una de las tres entra como NULL en vez de
    -- tumbar el lote entero por la restricción de la tabla.
    case when e ->> 'platform' in ('android', 'ios', 'web')
         then e ->> 'platform' end,
    -- Fuera de rango → NULL. Un `week_number` absurdo es un dato perdido, no
    -- una razón para perder los otros 49 eventos del lote.
    case when (e ->> 'week_number') ~ '^\d{1,4}$'
              and (e ->> 'week_number')::integer between 0 and 1000
         then (e ->> 'week_number')::integer end,
    left(nullif(e ->> 'screen', ''), 40),
    case when (e ->> 'ocurrido_en') is not null
         then (e ->> 'ocurrido_en')::timestamptz end,
    -- Si las propiedades vienen gordas se sustituyen por una marca en vez de
    -- rechazar el evento: se pierde el detalle, no el hecho de que ocurrió.
    case
      when e -> 'properties' is null then '{}'::jsonb
      when jsonb_typeof(e -> 'properties') <> 'object' then '{}'::jsonb
      when pg_column_size(e -> 'properties') > 4096
        then jsonb_build_object('_recortado', true)
      else e -> 'properties'
    end
  from jsonb_array_elements(p_events) as e
  -- Sin los obligatorios, el evento se ignora en silencio. Un cliente viejo o
  -- un JSON a medio escribir no puede hacer fallar la petición entera: el
  -- cliente daría el lote por fallido y lo reintentaría para siempre.
  where (e ->> 'event_id') is not null
    and (e ->> 'event_id') ~ '^[0-9a-fA-F-]{36}$'
    and (e ->> 'install_id') is not null
    and (e ->> 'install_id') ~ '^[0-9a-fA-F-]{36}$'
    and coalesce(e ->> 'event_name', '') <> ''
  -- Aquí está la idempotencia: reenviar un lote ya recibido no duplica nada.
  on conflict (event_id) do nothing;

  get diagnostics v_insertados = row_count;
  return v_insertados;
end;
$$;

-- En Postgres toda función nace con EXECUTE para `public`. Se quita y se
-- concede solo a los roles del cliente.
revoke all on function public.track_events(jsonb) from public;
grant execute on function public.track_events(jsonb) to anon, authenticated;

comment on function public.track_events(jsonb) is
  'Única puerta de entrada de la analítica. Idempotente por event_id. La tabla '
  'analytics_events no es accesible directamente para anon ni authenticated.';

-- ─── Vista de embudo ────────────────────────────────────────────────────────
--
-- Una fila por instalación con las fechas de cada escalón. No es un cuadro de
-- mando: es lo que evita repetir siete subconsultas en cada análisis.
--
-- `security_invoker` para que la vista NO sea otra puerta trasera a la tabla:
-- se ejecuta con los permisos de quien consulta, así que desde el cliente
-- tampoco se puede leer. Es para consultar desde el panel de Supabase.

create or replace view public.analytics_funnel
with (security_invoker = true) as
select
  install_id,
  min(created_at)                                                    as primera_vez,
  min(created_at) filter (where event_name = 'onboarding_started')   as onboarding_empezado,
  min(created_at) filter (where event_name = 'onboarding_completed') as onboarding_completado,
  min(created_at) filter (where event_name = 'week_generated')       as primera_semana,
  min(created_at) filter (where event_name = 'shopping_opened')      as compra_abierta,
  min(created_at) filter (where event_name = 'checkout_completed')   as compra_cerrada,
  max(week_number) filter (where event_name = 'week_generated')      as ultima_semana,
  count(*) filter (where event_name = 'shopping_item_checked')       as casillas_marcadas,
  count(*) filter (where event_name = 'share_completed')             as veces_compartido,
  max(platform)                                                      as plataforma,
  max(app_version)                                                   as version
from public.analytics_events
group by install_id;

revoke all on public.analytics_funnel from anon, authenticated;
