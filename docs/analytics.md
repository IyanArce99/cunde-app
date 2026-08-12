# Analítica de Cunde

## 1. Para qué existe

Para responder **una** pregunta: ¿esto es un negocio?

La métrica principal **no** son descargas, ni sesiones, ni instalaciones. Es:

> **qué porcentaje de usuarios genera una SEGUNDA semana.** Y luego una tercera
> y una cuarta.

Todo lo demás está para explicar por qué unos vuelven y otros no.

El embudo completo:

```
app_opened → onboarding_started → onboarding_completed → week_generated
           → shopping_opened → (se usa la lista) → checkout_completed
           → week_generated con week_number ≥ 2
```

**No existe `week_2_started`.** La semana viaja como columna (`week_number`) en
`week_generated`, así que semana 2, 3 y 4 son un `where` sobre un solo evento.
Tres eventos serían la misma información escrita tres veces y con tres sitios
donde equivocarse.

---

## 2. Arquitectura

```
componente / reductor
      ↓  analitica('week_generated', { … })
sumidero registrado          ← lo enchufa main.tsx, y solo main.tsx
      ↓
cola local (localStorage)
      ↓  lotes de 50
RPC track_events (Supabase)
      ↓
public.analytics_events
```

**Ningún componente, página ni reductor conoce Supabase.** Emiten con
`analitica(...)` y no saben a dónde va. Cambiar de proveedor es reescribir
`src/lib/analitica-supabase.ts` y nada más.

Eso no es una buena intención: hay un test que lo comprueba
(`analitica-desacople.test.ts`) y falla si alguien importa la cola, la identidad
o la RPC desde fuera de su sitio.

| fichero | qué hace |
|---|---|
| `src/lib/analitica.ts` | `analitica()` y `registrarSumideroAnalitica()`. Los tipos de evento y propiedades. |
| `src/lib/analitica-identidad.ts` | `install_id`, `session_id`, plataforma, versión. |
| `src/lib/analitica-cola.ts` | La cola persistente. |
| `src/lib/analitica-buckets.ts` | Los tramos. |
| `src/lib/analitica-supabase.ts` | El sumidero. **El único que sabe de Supabase.** |
| `src/main.tsx` | Lo enchufa. |
| `supabase/migrations/20260811_analitica.sql` | Tabla, índices, RPC, permisos. |

### El orden nunca se invierte

```ts
dispatch({ type: 'TOGGLE_ITEM', id });   // primero
analitica('shopping_item_checked', {});  // después, sin await
```

Emitir es apilar en memoria y programar un volcado. **No toca la red.** Si
Supabase está caído, Cunde funciona exactamente igual: `analitica()` envuelve el
sumidero en un `try/catch` y una métrica perdida no es un fallo del producto.

---

## 3. Privacidad

### Lo que se guarda

- Un identificador de instalación anónimo (`install_id`).
- Un identificador de sesión.
- Plataforma (`android`/`ios`/`web`) y versión de la app.
- El nombre del evento y el número de semana.
- La pantalla, de **una lista cerrada**.
- Propiedades: números, booleanos y tramos.

### Lo que NO se guarda, y no por descuido

| | por qué |
|---|---|
| Nombre, email, teléfono, dirección | La app no los pide. No hay cuentas. |
| Código postal | Ni exacto ni aproximado. |
| **Alergias e intolerancias concretas** | Son datos de salud. Sale `has_diet_filters` y `diet_filters_count`; nunca cuáles. |
| **Nombres de extras** | El usuario escribe ahí lo que quiere — «Medicinas mamá». Sale `has_price` y nada más. |
| Nombres de sustituciones | Igual. |
| Importes exactos | Tramos. Ver §7. |
| Identificadores publicitarios | No se usan. |
| GPS o ubicación | No se pide. |
| Texto libre de cualquier tipo | Hay un test que lo busca y falla si aparece. |

`dish_id` sí viaja: es un identificador del recetario (`lentejas_chorizo`), igual
para todos los usuarios y sin nada personal dentro. Que alguien bloquee un plato
es una preferencia, no un dato de salud.

### Para la política de privacidad

El apartado 7 de la política dice hoy que la analítica es «agregada y anónima» y
que los datos «se almacenan localmente». **Con esto conectado, eso se queda
corto y hay que actualizarlo.** Lo que habría que reflejar, sin afirmaciones
legales por mi parte:

> Se envía a nuestro servidor un identificador aleatorio de la instalación —no
> del dispositivo ni de la persona—, junto con qué pantallas se usan, en qué
> semana y con qué resultado, en tramos y nunca con importes exactos. No se
> envía nombre, correo, ubicación, alergias concretas ni ningún texto escrito
> por el usuario. Borrar los datos de la app genera un identificador nuevo y
> corta el vínculo con lo anterior.

Revísalo con un profesional antes de publicar.

---

## 4. Identidad

**`install_id`** — UUID aleatorio creado la primera vez y guardado en
`localStorage` bajo `cunde:install-id`. No sale de un correo, ni de un nombre,
ni del identificador publicitario, ni de una huella del dispositivo.

Sus límites, asumidos:
- Dos instalaciones de la misma persona son dos usuarios.
- Borrar los datos de la app crea un usuario nuevo.
- Sin `localStorage` (modo privado), cada arranque cuenta como instalación.

Arreglar eso exigiría identificar a la persona, que es justo lo que no se hace.

**`session_id`** — UUID nuevo **en cada arranque real de la app**. Se crea al
cargar el módulo y no caduca por inactividad: volver tras dos horas en segundo
plano es la misma sesión. No es la definición de un analytics de empresa y es
suficiente para la beta.

**`platform`** — de Capacitor si está (`Capacitor.getPlatform()`), `web` si no.
No se analiza el user-agent: es frágil y mentiría en un WebView de desarrollo.

**`app_version`** — de `package.json`, incrustada por Vite en compilación
(`__VERSION_APP__`). De un solo sitio, para que no se desincronice.

---

## 5. Cola offline

La pantalla Compra se usa en el sótano de un supermercado. Si la analítica
dependiera de la red, justo la parte que más interesa medir no se mediría.

```
evento → memoria → volcado agrupado a localStorage
                 → intento de envío
                 → si va: fuera de la cola
                 → si no: se queda
```

- **Clave:** `cunde:analytics-queue`.
- **Se vacía** al arrancar, al recuperar conexión (`online`) y al irse la app a
  segundo plano (`visibilitychange`). Lo último importa: en móvil, cerrar la app
  es lo normal.
- **Lotes de 50.** Cuarenta casillas marcadas no pueden ser cuarenta peticiones.
- **Volcado agrupado** cada 400 ms: serializar la cola entera en cada evento
  sería O(n) por casilla marcada.
- **Límite: 1.000 eventos, FIFO.** Al llegar se descartan los más antiguos.
  Se eligió FIFO frente a un sistema de prioridades a sabiendas: un esquema de
  prioridades obliga a decidir hoy qué evento importará dentro de tres meses, y
  equivocarse ahí se paga con datos que no existen. Lo descartado queda contado.
- **Si el cupo de `localStorage` se llena**, se recorta la cola a la mitad. Es
  mejor media cola que dejar el almacenamiento lleno para el estado de la app,
  que es lo que de verdad no se puede perder.
- **JSON corrupto** → se descarta y se empieza de cero. La app ni se entera.

### Duplicados

Cada evento lleva un `event_id` UUID de cliente. La columna es `unique` y la RPC
hace `on conflict do nothing`.

Esto resuelve el caso normal de una cola offline: el lote llega al servidor, la
respuesta se pierde por el camino, el cliente lo da por fallido y lo reenvía.
Sin `event_id` eso duplicaría todo; con él, reenviar es gratis.

---

## 6. Eventos

| evento | cuándo | propiedades | para qué |
|---|---|---|---|
| `app_opened` | al arrancar, en `main.tsx` | — | denominador de todo |
| `onboarding_started` | toque en «Cuadrar mi semana» | `screen` | primer escalón |
| `onboarding_completed` | `COMPLETAR_ONBOARDING` | `people`, `budget_bucket`, `has_diet_filters`, `diet_filters_count` | conversión de onboarding |
| **`week_generated`** | en `regenerar()`, el único punto por el que pasa una semana | `week_number`, `people`, `meals`, `within_budget`, `budget_bucket`, `has_diet_filters`, `diet_filters_count`, `has_dessert`, `variety`, `protein` | **la métrica principal** |
| `shopping_opened` | al montar Compra | `week_number`, `items_total` | ¿llega la gente al súper? |
| `shopping_item_checked` / `_unchecked` | al marcar una casilla | `week_number` | ¿se USA la lista o solo se abre? |
| `checkout_opened` | toque en «Cerrar la compra» | `items_checked`, `items_total` | fuga entre abrir y completar |
| `checkout_completed` | `GUARDAR_CIERRE` | `within_budget`, `difference_bucket`, `has_extras`, `has_unpriced_extras`, `items_checked`, `items_total` | ¿acierta Cunde con el presupuesto? |
| `week_start_date_changed` | cambio de día de inicio | `days_from_today`, `source` | — |
| `dish_liked` / `dish_disliked` | valoración | `dish_id`, `dish_type` | qué gusta |
| `dish_preference_set` / `_removed` | bloquear / desbloquear | `dish_id` | — |
| `disliked_dish_restored` | devolver un plato | `dish_id` | — |
| `generation_affected_by_preferences` | al generar con preferencias | `total_disliked_dishes`, `total_liked_dishes` | — |
| `generation_failed_by_disliked_dishes` | no cuadra por bloqueos | `total_disliked_dishes` | fallo real de producto |
| `extra_item_added` / `_removed` / `_checked` / `_unchecked` | extras | `has_price` — **nunca el nombre** | — |
| `extra_item_price_added` / `_changed` | precio de un extra | `has_price` | — |
| `shopping_closed_with_extras` | cierre con extras | `extras_count`, `unpriced_extras_count` | — |
| `share_sheet_opened`, `share_image_generated`, `share_image_failed`, `share_completed`, `share_dismissed`, `share_downloaded` | compartir | `share_type`, `generation_ms`, `diff_bucket` | métrica 5 |

### Eventos deliberadamente NO implementados

| descartado | por qué |
|---|---|
| `week_2_started`, `week_3_started`, `week_4_started` | `week_generated` + `week_number` lo responde. |
| `onboarding_step_1_viewed`, `_button_clicked`… | Ruido. Si algún día hace falta medir abandono por paso, un solo `onboarding_step_viewed` con `{ step: 'super' }`. |
| `week_adjusted` (declarado, sin disparar) | Existe en el tipo pero no se emite todavía: la hoja de ajustes ya genera un `week_generated` al guardar, y disparar los dos sin haber decidido qué distinguen sería duplicar. |
| `purchase_price_corrected` y compañía | **La funcionalidad no existe**: la app no registra hoy precios reales por producto ni sustituciones. Cuando exista, los eventos van con `sku`, `has_real_price`, `variable_weight` y `price_delta_bucket`. |
| Cualquier evento con nombres de producto o texto libre | Privacidad. |

---

## 7. Buckets

En `src/lib/analitica-buckets.ts`, y **solo ahí**: repartidos por los
componentes, a la tercera semana habría tres definiciones de «poco».

**`tramoPresupuesto(euros)`**
`<30` · `30-50` · `50-75` · `75-100` · `100-150` · `150+` · `desconocido`

**`tramoDiferencia(previsto, pagado)`** — con signo, porque pasarse un 8% y
ahorrar un 8% son resultados opuestos:
`clavado` (<2%) · `±2-5pct` · `±5-10pct` · `±10-20pct` · `±20pct+`

**`tramoDeltaPrecio(esperado, real)`**
`igual` (<1%) · `±0-10pct` · `±10-25pct` · `±25pct+`

---

## 8. Supabase

Migración: `supabase/migrations/20260811_analitica.sql`.

**Tabla `public.analytics_events`** — independiente de precios, catálogo y
recetas. `event_id uuid not null unique` para la idempotencia. `ocurrido_en`
además de `created_at`: con cola offline, una semana de uso sin cobertura
aparecería toda el día que el usuario recuperó red.

**Restricciones en la tabla, no solo en la RPC**: longitud de `event_name`, de
`screen`, rango de `week_number`, plataforma en tres valores y `properties`
acotado a 4 KB. Aunque alguien cambiara la función, la tabla no admite basura.

**Cuatro índices**, no más — la tabla es pequeña y las inserciones son el 99%
del tráfico:
- `install_id`
- `(event_name, created_at)` — sirve también para filtrar solo por evento, así
  que sustituye a un índice suelto
- `created_at`
- parcial sobre `(week_number, install_id) where event_name = 'week_generated'`
  — el de la métrica principal

**Seguridad.** La tabla queda cerrada al cliente:

```sql
alter table public.analytics_events enable row level security;
revoke all on public.analytics_events from anon, authenticated;
```

RLS activada **sin una sola política**: ni `anon` ni `authenticated` pueden
leer, insertar, actualizar ni borrar, ni siquiera con la clave publishable —que
viaja dentro del APK y hay que dar por conocida.

La única puerta es `track_events(jsonb)`, `security definer`, con:
- `set search_path = public, pg_temp` — sin fijarlo, quien llama puede anteponer
  un esquema suyo y hacer que `analytics_events` apunte a otra tabla. Es la
  vulnerabilidad clásica de estas funciones.
- Sin SQL dinámico: no hay `execute`.
- `revoke execute from public` y grant explícito a `anon` — en Postgres toda
  función nace ejecutable por `public`.
- Tope de 100 eventos por llamada.
- Validación por evento: sin `event_id` o `install_id` válidos, el evento se
  ignora **en silencio** en vez de tumbar el lote. Si fallara la petición
  entera, el cliente la reintentaría para siempre.
- `on conflict (event_id) do nothing`.

**Vista `analytics_funnel`** con `security_invoker = true`, para que no sea otra
puerta trasera: se ejecuta con los permisos de quien consulta, así que desde el
cliente tampoco se puede leer. Es para el panel de Supabase.

### Variables de entorno

```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable/anon>
```

Sin ellas, **la app no encola ni envía nada**. Es el estado correcto en
desarrollo y en un clon sin credenciales. Nunca `service_role` ni la contraseña
de Postgres dentro de la app.

---

## 9. SQL útil

```sql
-- Instalaciones
select count(distinct install_id) from analytics_events;

-- Conversión de onboarding
select
  count(distinct install_id) filter (where event_name = 'onboarding_started')   as empiezan,
  count(distinct install_id) filter (where event_name = 'onboarding_completed') as terminan,
  count(distinct install_id) filter (where event_name = 'week_generated')       as generan
from analytics_events;

-- LA MÉTRICA: retención por número de semana
select week_number, count(distinct install_id) as usuarios
from analytics_events
where event_name = 'week_generated'
group by week_number
order by week_number;

-- Semana 2, 3 y 4 en una fila
select
  count(distinct install_id) filter (where week_number >= 1) as s1,
  count(distinct install_id) filter (where week_number >= 2) as s2,
  count(distinct install_id) filter (where week_number >= 3) as s3,
  count(distinct install_id) filter (where week_number >= 4) as s4
from analytics_events
where event_name = 'week_generated';

-- ¿Se USA la lista, o solo se abre?
select
  count(distinct install_id) filter (where event_name = 'shopping_opened')      as abren,
  count(distinct install_id) filter (where event_name = 'shopping_item_checked') as marcan,
  count(distinct install_id) filter (where event_name = 'checkout_completed')   as cierran
from analytics_events;

-- ¿Acierta Cunde con el presupuesto?
select properties ->> 'difference_bucket' as tramo, count(*)
from analytics_events
where event_name = 'checkout_completed'
group by 1 order by 2 desc;

-- Qué hacen los que retienen, y qué los que no
with retienen as (
  select install_id
  from analytics_events
  where event_name = 'week_generated' and week_number >= 2
)
select
  e.event_name,
  count(distinct e.install_id) filter (where r.install_id is not null) as retienen,
  count(distinct e.install_id) filter (where r.install_id is null)     as no_retienen
from analytics_events e
left join retienen r using (install_id)
group by 1 order by 2 desc;

-- Embudo completo, una fila por instalación
select * from analytics_funnel order by primera_vez desc;

-- Compartir
select count(distinct install_id) from analytics_events
where event_name = 'share_completed';

-- Cambios de plato y extras
select event_name, count(*) from analytics_events
where event_name like 'dish_%' or event_name like 'extra_%'
group by 1 order by 2 desc;
```

---

## 10. Cómo añadir un evento

1. Añádelo al tipo `EventoAnalitica` en `src/lib/analitica.ts`.
2. Si necesita propiedades nuevas, añádelas a `PropsAnalitica`.
3. **Pregúntate si contiene datos sensibles.** Si es un importe, va en tramo. Si
   es texto del usuario, no va.
4. **Pregúntate si ya se responde con otro evento + propiedades.** Si sí, no lo
   añadas.
5. Dispáralo en el punto semántico correcto, después del `dispatch` y sin
   `await`.
6. Añade un test.
7. Añádelo a la tabla del §6 de este documento.

---

## 11. Reglas

**Nunca:**

- llamar a Supabase desde un componente, una página o el reductor
- bloquear la interfaz esperando a la analítica
- enviar texto escrito por el usuario
- enviar importes exactos
- enviar alergias concretas
- crear eventos que dupliquen información que ya se obtiene con propiedades
- añadir un evento «por si acaso»

---

## 12. Deuda técnica y límites

- **`localStorage` síncrono.** Volcar 1.000 eventos son unos 200 KB de
  `JSON.stringify` en el hilo principal. Con el volcado agrupado no se nota,
  pero es el primer sitio que se rompería con órdenes de magnitud más de tráfico.
- **Sin muestreo.** Con cientos de miles de usuarios, `shopping_item_checked`
  sería el evento más voluminoso con diferencia y no aporta por cada pulsación:
  lo suyo sería agregarlo por sesión o muestrearlo.
- **Sin retención en el servidor.** No hay política de borrado de filas viejas.
  Hoy no importa; a partir de unos millones de filas, sí.
- **`analytics_funnel` es una vista, no una tabla materializada.** Con muchos
  datos habrá que materializarla o mover el análisis fuera.
- **La sesión no caduca por inactividad.** Documentado en §4.
- **Un lote rechazado con 4xx se descarta.** Si la RPC cambiara de firma sin
  actualizar el cliente, se perderían eventos en silencio. Es a propósito —la
  alternativa es una cola atascada para siempre— pero conviene saberlo.
- **`week_adjusted` está declarado y no se dispara.** Decidir qué lo distingue
  de `week_generated` antes de emitirlo.
