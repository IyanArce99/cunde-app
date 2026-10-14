-- ═══ LAS CUATRO CIFRAS DE LA BETA ═══
--
-- Solo lectura. Se pegan en el editor SQL del panel de Supabase. No crean nada.
--
-- Unidad: `install_id` (un teléfono). Con 5-10 personas, porcentajes y medias
-- engañan: se cuentan personas, y la última consulta enseña a cada una.
--
-- Fecha: `ocurrido_en` (cuándo pasó), no `created_at` (cuándo llegó). La
-- pantalla Compra se usa sin cobertura y los eventos llegan días después.
--
-- Cambia la fecha de arranque de la beta en el CTE `desde` de cada consulta.

-- 1 · Embudo: cuántas personas llegan a cada paso, alguna vez.
--   semana generada → abre la lista → cierra la compra → genera la semana 2
with desde as (select timestamptz '2026-10-15' as t),
e as (
  select install_id, event_name, week_number
  from public.analytics_events, desde
  where coalesce(ocurrido_en, created_at) >= desde.t
)
select
  count(distinct install_id) filter (where event_name = 'app_opened')                          as abren_la_app,
  count(distinct install_id) filter (where event_name = 'week_generated')                      as generan_semana,
  count(distinct install_id) filter (where event_name = 'shopping_opened')                     as abren_la_lista,
  count(distinct install_id) filter (where event_name = 'checkout_completed')                  as cierran_la_compra,
  count(distinct install_id) filter (where event_name = 'week_generated' and week_number >= 2) as vuelven_semana_2
from e;

-- 2 · Retorno: de quienes generaron la semana N, cuántos generaron la N+1.
--   `week_generated` se repite al ajustar; por eso se cuenta por persona.
with desde as (select timestamptz '2026-10-15' as t),
s as (
  select distinct install_id, week_number
  from public.analytics_events, desde
  where event_name = 'week_generated' and coalesce(ocurrido_en, created_at) >= desde.t
)
select a.week_number                         as semana,
       count(*)                              as personas,
       count(b.install_id)                   as vuelven_a_la_siguiente
from s a
left join s b on b.install_id = a.install_id and b.week_number = a.week_number + 1
group by a.week_number
order by a.week_number;

-- 3 · Cierres de compra: si el ticket cuadró con lo previsto. Sin importes:
--   la app solo manda el tramo de la diferencia (`difference_bucket`).
with desde as (select timestamptz '2026-10-15' as t)
select week_number                               as semana,
       properties ->> 'within_budget'            as dentro_del_presupuesto,
       properties ->> 'difference_bucket'        as diferencia,
       count(*)                                  as cierres
from public.analytics_events, desde
where event_name = 'checkout_completed' and coalesce(ocurrido_en, created_at) >= desde.t
group by 1, 2, 3
order by 1, 2, 3;

-- 4 · Persona a persona: hasta dónde llegó cada teléfono y cuándo fue la
--   última vez. Con diez personas, esta es la tabla que se mira.
with desde as (select timestamptz '2026-10-15' as t)
select left(install_id::text, 8)                                                         as telefono,
       min(app_version)                                                                  as version,
       max(week_number) filter (where event_name = 'week_generated')                     as ultima_semana,
       count(*) filter (where event_name = 'shopping_opened')                            as veces_en_la_lista,
       count(*) filter (where event_name = 'checkout_completed')                         as compras_cerradas,
       max(coalesce(ocurrido_en, created_at))::date                                      as ultimo_uso
from public.analytics_events, desde
where coalesce(ocurrido_en, created_at) >= desde.t
group by install_id
order by ultimo_uso desc;
