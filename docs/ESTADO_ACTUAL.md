# Cunde — estado actual

> Reescrito el **11 ago 2026**. La versión anterior era del 28 jul y describía
> una app sin motor, sin catálogo y con datos de ejemplo. Nada de eso sigue
> siendo cierto: hoy hay motor determinista, catálogo real de Mercadona y
> precios que se actualizan sin publicar versión.
>
> Fuente de verdad complementaria: `CLAUDE.md` (reglas de producto, voz, modelo
> de datos). Este documento cubre **qué hay construido**, no qué debería haber.
>
> **Revisado el 13 oct 2026** (secciones 2 y 9). El catálogo llevaba dos meses
> sin tocar: 27 precios movidos, el caldo de verduras Hacendado descatalogado
> en toda España y la quinoa seca fuera de Madrid. Y el proyecto de Supabase
> ha dejado de resolver en DNS — ver el punto 0 de la sección 9.

---

## 1. En una frase

App móvil española que resuelve la compra semanal con presupuesto cerrado:
comensales + presupuesto → menú, lista de la compra con SKU y precios reales de
Mercadona, y el total antes de salir de casa. **No es una app de recetas; es
una app de dinero que se paga en comida.**

## 2. Lo que hay, en números

```
152 recetas          120 ingredientes canónicos (17 de despensa)
118 SKU elegidos     120 recetas con foto · 7 nuevas sin ella
30 componentes       24 ficheros de test · 392 tests en verde
precios del          catálogo Mercadona real, actualizable sin
2026-10-13           publicar en Play Store
```

Eran 151 recetas y 117 SKU hasta el 13 oct. Las seis de quinoa están
**aparcadas** en `docs/recetas-aparcadas/quinoa.json`, con sus fotos al lado:
la quinoa seca (sku 9430) da 404 en `mad1`, `mad3`, `bcn1` y `svq1`, y en
Madrid solo queda la cocida, que no vale para esas recetas tal cual. Una app
que promete precios de productos concretos no puede listar uno que no está en
el lineal. Devolverlas está explicado en la nota de ese fichero.

Las repone `docs/recetas/lote-sin-quinoa.json`: cinco con **cuscús** (sku 9395,
1,95 €/kg contra los 5,30 de la quinoa) y dos con **pasta de lenteja roja**
(sku 6106). Pasan `revisar-lote.ts` y el motor ya las sirve, pero están
**redactadas por IA y sin revisar ni cocinar por una persona, y sin foto**. Las
dos bases llevan gluten declarado —la etiqueta de la pasta de lenteja se
contradice y se ha declarado por prudencia—, así que al vegano sin gluten este
lote no le devuelve lo que perdió con la quinoa.

`fuentes.test.ts` mide ahora la **media** del trío de fuentes sobre cinco
semanas (4,8 con la penalización, 6,0 sin ella, corte en 5,4) en vez de exigir
6 semana a semana: la semana 1 da 7 con y sin penalización, así que el límite
por semana ya no distinguía nada. `catalogo/_aud-trio.ts` es la sonda.

Stack: Ionic React 8 + React 19 + Capacitor 8 + Vite 5, TypeScript estricto.
Vitest. `sharp` para el proceso de fotos. Supabase (Postgres) solo como almacén
de precios. Proyecto Android presente y compilando: hay `app-debug.apk` (12,2 MB)
y `app-release.apk` (10,6 MB) generados.

---

## 3. El motor · `src/motor/`

**La IA no calcula nada.** Todo determinista, sin azar en ningún punto. Los
mismos datos de entrada dan siempre la misma semana.

| fichero | qué resuelve |
|---|---|
| `seleccionar.ts` | elección día a día por coste marginal, y la puntuación |
| `carrito.ts` | coste de consumo vs coste de carrito, proteína por ración |
| `reparto.ts` | cuántos huecos rinde cada tanda, sobras y ensamblajes |
| `postres.ts` | los postres, que **no son recetas**: son ingredientes con bandera |
| `tipos.ts` | `Receta`, `Hueco`, `Tanda`, `LineaCarrito`, `DatosMotor` |

### Los dos costes que no se mezclan

- **Consumo** — proporcional a lo que usa el plato. Es el «4,60 € ración».
- **Carrito** — lo que pasa por caja. Es el total de la cabecera.
- La diferencia es el desperdicio, y minimizarla es la función objetivo.

### La puntuación, toda en euros

```
BONUS_VARIEDAD             100     PESO_APROVECHAR              30
PESO_PROTEINA               30     PESO_CUOTA_PROTEINA           6
PROTEINA_QUE_DEFINE_PLATO    8     PENAL_RECIENTE      [4, 1.6, 0.5]
PENAL_CENA_PESADA            3     BONUS_FAVORITO              2.5
PESO_SABOR_REPETIDO        2.5     PENAL_FUENTE_REPETIDA       1.5
PENAL_PROTEINA_REPETIDA    1.5     BONUS_PROTEINA_FRESCA       1.5
PENAL_COMIDA_LIGERA        0.8     PENAL_POR_MINUTO_DE_MAS    0.02
```

`SEMANAS_DE_MEMORIA = 3`: lo cocinado hace 1, 2 y 3 semanas penaliza cada vez
menos. `PENAL_FUENTE_REPETIDA` está topado en 1,5 porque a 2 anulaba
`BONUS_FAVORITO` y los platos marcados como favoritos dejaban de salir —
medido, no supuesto.

### El armario consume cuota (13 oct 2026)

Las cuotas por hueco de `construir()` solo restaban la caja, mientras que la
pasada de holgura medía el gasto como caja más armario. Con la nevera llena,
cada hueco disponía de su cuota entera de dinero nuevo encima de lo que ya
había: la semana 2 de dos personas con 65 € pagaba 62,45 € por caja teniendo
13,29 € de comida en casa, y 48,72 € con la cocina vacía. Ahora la cuota
descuenta lo que ya sale del armario. Medido en `catalogo/_aud-bench-motor.ts`
(33 semanas, 15 con despensa; resultados en `catalogo/bench-motor/`): las 18
semanas sin despensa salen idénticas; en las 15 con despensa la caja baja un
6 %, el perecedero un 12 % y la comida un 2,6 %, con la proteína igual.
`catalogo/_aud-existencias.ts` reproduce el caso.

La comparación posterior (`docs/motor-variantes-informe-2026-10-13.md`) separa
cuota y pasada de holgura: la pasada costaba un 5,5 % más de compra neta de
inventario en 21 semanas sin comprar variedad ni menos desperdicio.
**Decidido para la beta: la pasada de holgura está apagada**
(`PASADA_DE_HOLGURA = false` en `seleccionar.ts`). El presupuesto es un
límite, no una meta: el motor construye la semana más barata que cumple
proteína y filtros y deja el sobrante a la vista; gastarlo es decisión del
usuario en el selector de variedad. Contrapartida medida: la semana de
arranque (2 personas, 65 €) pasa de 62,02 € a 54,32 €, con 55,7 g de proteína
(suelo 55) y 6 huecos con carne o pescado en vez de 7. La pasada se conserva y
se enciende con `conHolgura` para comparaciones internas; `cuotaSinArmario` y
`holguraPorCalidad` son banderas de calibración, no opciones de usuario.

### Escalar por comensales no es multiplicar

Cada línea lleva marca: `lineal` (proteína, verdura, legumbre, pasta) × N;
`sublineal` (especias, ajo, aceite de sofreír) × N^0,7; `fijo` (laurel, pastilla
de caldo) sin cambio.

### La despensa va aparte

17 ingredientes marcados `es_despensa` salen en «Por si te falta», con casilla
de «ya lo tengo» y **fuera del total principal**. Si fueran dentro, la semana 1
saldría por 78 € y la 2 por 44, y el usuario creería que la app miente.

---

## 4. Pantallas

**Dos pestañas: Semana y Compra.** Ninguna más.

> Hasta el 12 ago había una tercera ruta, `/semana/variante`: la maqueta «2a»
> del fichero de diseño, una hipótesis alternativa a la pantalla Semana que se
> descartó. Nadie navegaba a ella —solo se llegaba escribiendo la URL—, su
> botón ↻ no tenía `onClick` y estaba rota: centraba y recortaba a la vez, así
> que los platos del primer día no se veían y no había forma de llegar a ellos.
> Borrada. Con ella se fue `costePersonaDia`, que era su único consumidor.

### Onboarding — `src/pages/onboarding/`

1. **Portada** — titular y «Empezar».
2. **Súper** — 6 cadenas visibles, **solo Mercadona elegible**. Las otras cinco
   se ven apagadas: nadie puede elegir una cadena sin catálogo y recibir precios
   de otra, porque eso es una cifra en euros que miente.
3. **Datos** — comensales (1 a 5+) y qué resuelve la app (comidas, cenas o ambas).
4. **Presupuesto** — la cifra a 88 px. **El carril no baja del mínimo viable**,
   que lo calcula el motor con el catálogo real y se mueve con los comensales y
   las exclusiones. El techo es 2,5 × el suelo, no un 200 fijo. Antes se dejaba
   bajar y aparecía un aviso; ahora la consecuencia se aprende moviendo el dedo.
5. **Generando** — pantalla de carga. Ya **no es teatro**: detrás se construye
   la semana de verdad.

### Semana — `src/pages/Semana.tsx`

- Total animado a 56 px con `requestAnimationFrame` sobre un `ref`. Nunca
  `useState`: con estado son 25 renders por segundo.
- Barra de presupuesto y «te sobran / te pasas X €».
- Tarjetas de día con su coste, que abren `HojaDeDia`.
- **Botón de compartir** (icono, 56×56): genera un PNG 9:16 en canvas con las
  fuentes del sistema de diseño y lo pasa a `navigator.share`.
- **No hay gráfica de gasto por día.** Se quitó: en una semana cuadrada los
  siete días cuestan casi lo mismo, las barras salían de altura idéntica y no
  llevaban a ninguna acción. 52 px recuperados.

**Hojas que cuelgan de Semana:**

| hoja | qué hace |
|---|---|
| `HojaDeDia` | cambiar plato, bajar el precio, no cocinar ese día, ver la receta, valorar |
| `RecetaPlato` | pasos reales, escalados a los comensales, con foto si la hay |
| `AjustesSemana` | ver más abajo |
| `HojaInicioSemana` | qué día empieza la semana |
| `HojaPlatosBloqueados` | platos que no quieres, y devolverlos |
| `HojaExclusiones` | alergias y dietas |
| `HojaCompartir` | la tarjeta 9:16 |
| `CambioSemana` | cerrar la semana y empezar otra |
| `MuroDePago` | dos planes al mismo peso, salida gratuita al mismo tamaño |

### Ajustes de la semana — `AjustesSemana.tsx`

Dos capas, porque las cinco preguntas seguidas medían 1426 px en una caja de 776.

**Capa 1 · lo de esta semana** — con el total de la cesta pegado arriba, que se
recalcula al tocar cualquier cosa:

- **Empieza** — qué día.
- **Sois** — 1 a 5+. *(Añadido el 11 ago: antes solo se podía contestar en el
  onboarding, una vez en la vida.)*
- **Tu tope** — deslizador con el mismo suelo que el onboarding. *(Añadido el 11
  ago. El presupuesto es semanal por definición: «tengo 65 € **esta semana**».)*
- **Variedad** — dos opciones, y **salen de los datos**: se agrupan por si
  repiten plato o no, y de cada grupo se enseña la del usuario o la más barata.
  «Nunca repites plato» solo puede aparecer sobre una semana con
  `platosRepetidos === 0`, así que no se puede desincronizar. Con 7 comidas el
  selector **desaparece entero**, porque ahí no hay dos grupos.
- **Proteína** — básica / normal / alta.
- **Postre** — sin postre o en cada comida.

**Capa 2 · lo que no cambia** — qué resuelve, cuánto quieres cocinar, alergias,
platos bloqueados.

Guardar emite **una sola acción**, `SET_AJUSTES`. Encadenar
`SET_COMENSALES` + `SET_PRESUPUESTO` + `SET_PREFERENCIAS` fallaba de dos maneras
opuestas: regeneraba dos veces (2,6 s cada una, la primera para tirarla) o
ninguna, si solo movías el tope.

### Compra — `src/pages/Compra.tsx`

- Agrupada por pasillo real, cabecera sticky con subtotal.
- Filas memoizadas con `React.memo` + `useCallback`: marcar un producto no
  repinta la lista. Verificado con contadores de render.
- **Funciona sin conexión.** Los sótanos de los supermercados no tienen cobertura.
- Extras: añadir productos fuera de la lista, con o sin precio.
- **`CierreDeSemana`** — un solo campo (lo que pone el ticket) y
  previsto / pagado / diferencia / sobre-presupuesto. La diferencia se congela
  dentro del `Cierre` porque `GUARDAR_CIERRE` vacía los extras: sin congelarla,
  la tarjeta mentía.

---

## 5. Estado · `src/state/AppStateContext.tsx`

Un único `useReducer` + Context, persistido en `localStorage` bajo
**`cunde:estado:v15`**, con migración desde claves anteriores. 23 acciones:

```
Perfil     SET_COMENSALES · SET_SUPER · SET_PRESUPUESTO · SET_CODIGO_POSTAL
           SET_INICIO_SEMANA · COMPLETAR_ONBOARDING
Semana     SET_PREFERENCIAS · SET_AJUSTES · APLICAR_SEMANA · RETOCAR_HUECO
           VALORAR_PLATO
Compra     TOGGLE_ITEM · TOGGLE_LO_TENGO · TOGGLE_PASILLO
           ANADIR_EXTRA · QUITAR_EXTRA · TOGGLE_EXTRA · PRECIO_EXTRA
Cierre     GUARDAR_CIERRE · DESHACER_CIERRE · OLVIDAR_DESHACER
Pago       SET_SUSCRIPCION · SEGUIR_GRATIS
```

### Cuándo pasa la semana siguiente (13-14 oct 2026)

**Cerrar la compra no es acabar la semana.** Se cierra en el súper, con siete
días de cocina por delante.

- `GUARDAR_CIERRE` solo guarda el ticket. El menú, el historial, la despensa y
  el número de semana se quedan como estaban.
- Cuando la compra está cerrada **y** han pasado los siete días de la vigente
  (`hoy ≥ semana.fechaInicio + 7`, ver `tocaAbrirLaSiguiente()`), Semana
  enseña «Esta semana ya ha terminado» con la acción **«Preparar siguiente
  semana»**. Hasta que se pulsa, el menú y las recetas siguen donde estaban,
  aunque se recargue o se vuelva del segundo plano. Funciona sin conexión.
- Al pulsar (`PREPARAR_SIGUIENTE_SEMANA`) se hace la transición y la
  contabilidad —historial, despensa, número de semana— en
  `abrirSemanaSiTocaba()`, una sola vez: `cierre.guardada` se apaga en la misma
  acción y una segunda pulsación devuelve el mismo estado.
- **Fecha de inicio**: la que tocaba si aún no ha pasado; si ya pasó, hoy. Ni
  un día en el pasado: una semana preparada tarde no nace con días perdidos.
- **Envejecimiento de la despensa**: lo que sobró envejece los días que de
  verdad pasan entre el inicio de la semana vieja y el de la nueva (siete como
  mínimo). Tras tres semanas fuera ya no quedan productos caducados contando
  como «en casa».
- Con el muro activo y sin Cunde+ no cambia nada: la semana se abre al pasar el
  muro (`SEGUIR_GRATIS`), como antes. Con Cunde+ sale el aviso.

Del 13 al 14 oct la transición se hacía sola al arrancar. Se cambió porque le
quitaba el menú a quien compra tarde: cierra el ticket el día 9 de su semana y
al abrir la app al día siguiente ya no estaban los platos que acababa de
comprar.

Lo que esta regla NO cubre, a propósito: **quien nunca cierra la compra**
sigue viendo su semana aunque pasen los días, y no ve el aviso. No se da por
hecha una compra que nadie ha confirmado.

Tests: `src/state/siguienteSemana.test.tsx` (19, con reloj falso, incluido
montar la app con la semana vencida y comprobar que no cambia sola).

### «No cocino este día» (14 oct 2026)

Quita esa comida y recalcula la compra de lo que queda; no elige ningún plato
nuevo (`liberarHueco()` en `seleccionar.ts`):

- hueco cocinado sin sobra → la tanda sale entera;
- hueco de sobra o ensamblaje → la tanda se queda con su día de cocina, para
  un hueco;
- hueco cocinado con sobra → la sobra pasa a cocinarse ese otro día; si era un
  ensamblaje, pasa a ser el plato base.

El postre de esa comida deja de comprarse (`planDePostres(…, libres)`). Las
cantidades solo bajan, así que con los mismos precios y despensa la compra no
puede subir. Antes iba por `repararHueco`, que rehacía la tanda entera: con
2 personas y 65 €, liberar la sobra del miércoles cambiaba las alubias del
lunes por un potaje con bacalao y la compra pasaba de 54,32 € a 69,44 €, fuera
del presupuesto (`catalogo/_aud-no-cocino.ts`).

En un hueco libre, la hoja del día ofrece **«Cocino»**, que rellena solo ese
hueco (`cocinarHueco()`) con un plato distinto de más si hace falta. Añadir una
comida sí puede subir la compra, y `cuadra` lo dice.

Tests: `src/motor/noCocino.test.ts` (barrido de huecos en los tres niveles de
variedad, con postre, despensa y filtros) y `src/state/noCocino.test.ts`
(camino de la app y recarga).

Las acciones que cambian la semana llaman a `regenerar()`. `SET_PRESUPUESTO`
por sí sola **no** regenera — es deliberado, y por eso existe `SET_AJUSTES`.

---

## 6. Catálogo y precios · `catalogo/`

### La cadena de montaje

```
extraer.js       raspa el catálogo de Mercadona
mapear.js        propone SKU por ingrediente canónico
generar.ts       compila src/data/motor-datos.json
postres.js       añade los SKU de postre
aplicar-precios  pone los precios de la última revisión   ← SIEMPRE EL ÚLTIMO
```

**El orden no es opcional.** `generar.ts` recompila desde el volcado y devuelve
los precios a la fecha de ese volcado **sin avisar**. Comprobado el 11 ago
encendiendo una foto: `generadoEn` retrocedió de `2026-08-10` a `2026-07-28` en
silencio.

`mapeo-elegido.json` fija a mano los SKU que un humano ya revisó; `generar.ts`
los devuelve tal cual.

### Precios sin publicar versión

`src/lib/precios.ts` valida y aplica una instantánea descargada;
`sincronizarPrecios.ts` la busca al arrancar (8 s de tope) y la aplica **en el
arranque siguiente**, nunca a media sesión. Defensas: se rechaza un salto de más
del 60% en un precio, y una instantánea que toque más de un tercio del catálogo.
Si una instantánea se rechaza línea a línea y no aplica nada, también se descarta:
el primer intento enseñaba la fecha nueva con los precios viejos.

Servidor: Supabase Postgres, con `capturado_en` en la clave primaria de `precio`
—es el historial y no se puede reconstruir—. Cron diario en GitHub Actions
(`.github/workflows/precios.yml`): **revisa y guarda, no publica**. Publicar es
un acto humano.

### Zonas: Madrid y Gran Canaria (14 oct 2026)

El código postal elige la zona (`src/lib/zona.ts`) y la zona, el catálogo:
`src/data/zonas/<zona>.json` trae un SKU por ingrediente —o `null`— sobre las
mismas recetas, y `src/motor/zona.ts` quita las que necesitan algo que no hay.
**Nunca se rellena con Madrid.** Gran Canaria son 9 almacenes medidos uno a
uno; 31 de los 118 SKU de Madrid no existen allí y hoy quedan 49 recetas (122
si se aprueban las alternativas de `catalogo/zonas/gran-canaria-alternativas.json`).
Instantáneas por zona, plan atado a su zona, y una actualización no cambia una
compra empezada. Todo en
**[beta-catalogo-gran-canaria-2026-10-14.md](beta-catalogo-gran-canaria-2026-10-14.md)**.

Lo que rinde un envase: las conservas cuentan su **escurrido**
(`peso-escurrido.json`) y las piezas, su **peso de hoy** (`peso-pieza.json`).
Los dos salen de una auditoría y los aplica `generar.ts`.

### Reglas de ingesta

`upsert` por `(cadena, sku, almacén)`, nunca `delete` + `insert`. Lo que
desaparece no se borra: se marca `ultima_vez_visto`, y a los 14 días
descatalogado. 300-500 ms entre peticiones, `User-Agent` identificable, nunca
concurrente. Ante 403 o 429: parar y reportar.

**La API nunca raspa. Solo lee de la base de datos.**

### Fotos de plato

```
prompts-fotos.js   escribe los prompts de LO QUE FALTA (las hechas desaparecen)
generar-fotos.js   los genera contra la API, un fichero por receta
fotos.js           recorta a 1080² y convierte a WebP q78
contacto-fotos.js  hoja de contacto rotulada para revisarlas
prompt-foto.js     el prompt, en un solo sitio, compartido por los dos primeros
```

Van **en el prompt un solo sitio** a propósito: estaba duplicado, y así es como
acaban dos tandas con fondos distintos.

**El nombre del fichero es el id de la receta**, y es lo único que une foto y
plato. El 11 ago, diez ficheros bajados a mano vinieron cruzados entre sí
—`revuelto_garbanzos_queso.png` contenía macarrones a la boloñesa— y **eso no da
error en ningún paso**: la app enseña otro plato y nadie se entera. Solo lo caza
la hoja de contacto rotulada. Con `generar-fotos.js` el cruce ya es imposible,
porque el fichero lo escribe el mismo id que generó el prompt.

Peso: 1080×1080 WebP q78, ~105 KB. El primer PNG pesaba 2,7 MB; a ese peso, 151
recetas son 408 MB y Google Play corta el AAB en 200.

### Auditorías

`auditar-catalogo.ts <almacén>` contrasta cada SKU de la app con su ficha de
Mercadona —precio, formato, escurrido, alérgenos, qué prueba que es ese
ingrediente— y separa un 404 de una descarga fallida. Resultado en
`catalogo/auditoria/`; tabla SKU a SKU en
[catalogo-auditoria-2026-10-14.md](catalogo-auditoria-2026-10-14.md).

~55 sondas `catalogo/_aud-*.ts`. No modifican nada: miden. Las que siguen
sosteniendo decisiones vivas son `_aud-cobertura-fotos` (orden de encargo de
fotos), `_aud-cuanta-foto` (cuántos platos de una semana llevan foto),
`_aud-monotonia`, `_aud-fuentes`, `_aud-uso`, `_aud-mapa-almacenes`.

---

## 6 bis. Analítica

Conectada el 11 ago. Detalle completo en **[docs/analytics.md](analytics.md)**.

La métrica principal no son descargas ni sesiones: es **qué parte de la gente
genera una segunda semana**, y luego una tercera y una cuarta.

```
componente → analitica() → sumidero → cola local → RPC → analytics_events
```

- **Ningún componente conoce Supabase.** Hay un test estructural que falla si
  alguien lo importa fuera de `analitica-supabase.ts`.
- **Cola offline** en `localStorage`, lotes de 50, límite de 1.000 FIFO. La
  pantalla Compra se usa sin cobertura: la analítica no puede depender de la red.
- **`install_id`** anónimo, sin correo, sin identificador publicitario, sin
  huella. **`session_id`** por arranque real de la app.
- **Idempotente** por `event_id` UUID de cliente + `unique` + `on conflict do
  nothing`: reenviar tras una respuesta perdida no duplica.
- **Eventos tipados.** El compilador rechaza propiedades inventadas.
- **Privacidad limitada a propósito**: nunca importes exactos, ni alergias
  concretas, ni nombres de extras, ni texto libre. Tramos y booleanos.
- **La tabla está cerrada al cliente**: RLS sin políticas y `revoke all`. La
  única puerta es `track_events`, `security definer` con `search_path` fijado.

**Sin `VITE_SUPABASE_URL` no encola ni envía nada** — el estado correcto en
desarrollo.

## 6 ter. Cunde+ · monetización

Montado el 12 ago, **con el muro apagado**. Detalle completo en
**[docs/monetizacion.md](monetizacion.md)**; lo que hay que hacer fuera del
código, en **[docs/lanzamiento-cunde-plus.md](lanzamiento-cunde-plus.md)**.

```
lib/suscripcion.ts   precios · IDs de producto · MURO_ACTIVO · los dos límites
lib/premium.ts       TODAS las reglas de acceso. Nadie más decide.
lib/compras.ts       RevenueCat. Lo único que habla con la tienda.
MuroDePago.tsx       pinta y avisa. No decide nada.
```

Tres planes —1,49 €/semana, **3,99 €/mes**, 29,99 € para siempre— que conceden
**el mismo entitlement** (`cunde_plus`). Ningún componente pregunta qué plan
tiene alguien: preguntan `tieneCundePlus(estado)`.

Se cobran **dos cosas**, ambas de personalización:

| | gratis | con Cunde+ |
|---|---|---|
| Cambios de plato | 2 por semana | sin límite, sin contar |
| Proteína | básica y normal | + alta |

Gratis para siempre: el menú con precios reales, la lista entera, **todas las
alergias y dietas**, «bájame el precio», «no cocino este día», bloquear platos,
cerrar la semana con el ticket y compartir.

- **El contador guarda a qué semana pertenece**, no solo cuántos van. El reseteo
  no necesita ningún gancho. Y cierra el ciclo de «gasto los dos → muevo el
  presupuesto → regenero → los recupero»: `regenerar()` no incrementa
  `semanaNumero`, solo `GUARDAR_CIERRE`.
- **Solo `APLICAR_SEMANA` gasta un cambio.** Es el único despachador que lo hace.
- **`reglaDeCambios()` es pura** y no mira `MURO_ACTIVO`. Con la bandera apagada,
  probar `accesoACambiarPlato` mediría la bandera y no la regla.
- **`permisoSegunLaTienda()` devuelve `boolean | null`**, y `null` es «no se pudo
  saber» y no toca nada. Antes hacía `catch → false`, o sea que a quien había
  pagado y abría la app en el sótano del súper se le retiraba el acceso.
- **Migración a v16**: quien viene de v15 entra con `{semana: 0, usados: 0}`. La
  semana 0 no coincide con ninguna real, así que migra con cero usados sin
  lógica aparte. Un contador corrupto se repara a cero: regalar dos cambios es
  mejor que una pantalla en blanco al tocar la función que paga.

**Dos límites distintos sobre la misma acción, y los dos activos**:
`ALTERNATIVAS_GRATIS = 1` limita cuántas alternativas se **ven** por hueco;
`CAMBIOS_GRATIS_POR_SEMANA = 2` limita cuántas se **aplican** por semana. Si hay
que aflojar, aflojar uno.

> **Lo más discutible que hay en la app.** Proteína Alta detrás del muro
> contradice un argumento que sigue escrito en `suscripcion.ts` y que no se ha
> refutado: «cobrar por comer legumbre en vez de carne es cobrar por una dieta,
> no por una función». Lo que sí se refutó es el dato que lo sostenía —alta no
> es más cara: sobre 48 combinaciones el precio solo sube en 13, y con 65 € y
> poca variedad son 41,05 € en básica contra 30,94 € en alta—. Quitarlo es
> borrar un valor de un enum.

## 7. Restricciones

12 alergias (`Gluten, Lactosa, Huevo, Frutos secos, Marisco, Pescado, Cacahuete,
Soja, Sésamo, Apio, Sulfitos, Mostaza`) y 3 dietas (`Vegetariano, Vegano,
Cerdo`).

Alergia y preferencia van **separadas**: es la misma línea que decide si las
trazas bloquean y si sale el aviso de «comprueba la etiqueta». Un filtro que el
motor aplica pero la app no enseña es un agujero de seguridad; uno que se enseña
y el motor no conoce es una promesa falsa. Hay un test que impide que las dos
listas se separen.

---

## 8. Cosas medidas que conviene no volver a discutir

- **157 almacenes de Mercadona, no una docena** (medido el 10 ago, y es un
  suelo). Los envasados llevan **referencia nacional**; el mostrador fresco no
  —13 de 108 referencias dan 404 en Oviedo, y dentro de Madrid 15 de 34 frescos
  cambian de precio entre `mad1`, `mad2` y `mad3`—. Conclusión: catálogo
  nacional para lo envasado, capa regional solo para los ~34 de peso variable.
- **Más recetas no compran nada por encima de ~150.** Un usuario consume entre
  20 y 63 en 12 semanas. **79 de las 151 no las ha servido el motor nunca.**
- **La monotonía de proteína no se arregla unificando el objetivo del motor**
  (69% → 71%/70%, medido). Un pool de candidatos compartido sí la arregla
  (0 de 162), pero no está implementado.
- **La semana de arranque es 2 personas y 65 €**, y no estaba en la parrilla de
  auditoría. Por eso el primer orden de encargo de fotos mandaba al puesto #41
  platos que salen en la primera pantalla. Ahora cuenta triple.
- **El fondo de las fotos no necesita clavar el color.** `.foto-plato` lleva un
  borde de 1 px: la foto va enmarcada, no sangra. Dispersión medida entre las
  primeras 20: de 5 a 30 puntos RGB, invisible a 328 px.
- **«Nunca repites plato» no repite ningún plato.** Medido en las tres
  proteínas: 14 huecos, 12 recetas distintas, 12 cocinadas y **ninguna receta
  cocinada dos veces**. Los dos nombres que salen repetidos son una sobra y un
  ensamblaje —aprovechamiento, que es el producto—. Con «repites» sí hay
  recocinadas (3 veces los calamares) y bajan a 5 recetas distintas. La
  distinción funciona; lo que fallaba era la hoja de ajustes, no el motor.
- **Los pasillos ordenan por recorrido de súper, no alfabéticamente.**
  `orden_pasillo` está en el modelo de datos de `CLAUDE.md` pero **nunca se
  capturó**: los productos traen `departamento` y `subfamilia`. El orden vive en
  `ORDEN_PASILLOS` (`data/motor.ts`) y es una **hipótesis razonada, sin
  verificar en tienda** — fresco por el perímetro, seco por el centro,
  congelados al final. Corregirlo es mover una línea de esa lista.

---

## 9. Qué falta antes de publicar

| | qué | quién |
|---|---|---|
| 0 | **El proyecto de Supabase no resuelve en DNS** (comprobado el 13 oct contra 1.1.1.1, y otra vez el 14 oct: NXDOMAIN). Sin él no hay analítica, ni precios actualizables, ni historial del cron. Lo normal es que esté pausado por inactividad: se restaura desde el panel. Después, publicar la instantánea del 13 oct con `supabase.ts publicar` | tú |
| 0b | ~~La semana siguiente no se abría sin muro ni RevenueCat~~ **Hecho el 13 oct.** Ver «Cuándo se abre la semana siguiente» en la sección 5 | — |
| 1 | **Rotar la contraseña de Postgres** y la **clave de OpenAI** — las dos se pegaron en un chat | tú |
| 2 | Añadir `SUPABASE_DB_URL` como secreto de GitHub para que el cron corra | tú |
| 3 | ~~Conectar un sumidero de analítica~~ **Hecho el 11 ago.** Falta poner `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`, y aplicar la migración | tú |
| 4 | ~~Política de privacidad~~ **Hecha** (`landing/privacidad.html`). ~~Condiciones~~ **Hechas** (`landing/condiciones.html`) | — |
| 5 | Build de release firmada. La del 13 oct (`app-release.aab`, versión 1.3, código 4) es **anterior** al código postal obligatorio, a la pasada de holgura apagada y a la apertura de semana: hay que recompilarla | — |
| 5b | **Privacidad contra código**: `landing/src/Privacidad.tsx` dice «nunca enviamos tu ubicación» y `onboarding_completed` envía ya la provincia (dos cifras del código postal). Hay que declararlo antes de publicar | — |
| 5c | ~~«No cocino este día» encarecía la compra~~ **Hecho el 14 oct.** Ver «No cocino este día» en la sección 5 | — |
| 5e | **Quien nunca cierra la compra** no recibe semana nueva ni aviso. Si en la beta la gente no cierra, hay que decidir qué ofrecerle (p. ej. el mismo aviso sin contabilidad de despensa) | — |
| 5f | **«Cocino» puede pasarse del tope**: devolver una comida añade una y puede subir la compra; `cuadra` y la pantalla lo dicen, pero no se impide | — |
| 5d | La portada enseña una **semana de ejemplo** (54,23 € desde el 14 oct) y lo dice. La del usuario depende del día en que empieza. ~~«Con los precios de tu súper, los de hoy»~~ **Cambiada el 14 oct** por «Con precios reales de Mercadona, producto a producto» | — |
| 5g | **Gran Canaria**: revisar las 24 alternativas propuestas (`catalogo/zonas/gran-canaria-alternativas.json`) y rehacer la zona con `construir-zona.ts cerrar`. Sin ellas quedan 49 recetas | tú |
| 5h | **Gran Canaria**: publicar su instantánea (`publicar-precios.js --zona gran-canaria`) y que el cron mida los 9 almacenes. Necesita Supabase y `VITE_PRECIOS_URL` con `{zona}` | tú |
| 5i | Los precios medidos son los de la **tienda online**. Que la tienda física cobre lo mismo no está comprobado: el primer ticket real lo dirá | — |
| 5j | **Beta privada** (14 oct): zonas, alérgenos desconocidos, precios por zona, privacidad y APK «Cunde Beta» → **[beta-privada-2026-10-14.md](beta-privada-2026-10-14.md)**. Bloquean: Supabase (el proyecto no resuelve; probablemente ya no existe), datos del titular en la política, dominio y redespliegue de la landing, y el recorrido en un teléfono real | tú |
| 6 | Consultar con abogado de PI antes de lanzar en público (ver nota legal de `CLAUDE.md`) | tú |
| 7 | Toda la configuración de RevenueCat y Play Console para Cunde+ → **[lanzamiento-cunde-plus.md](lanzamiento-cunde-plus.md)** | tú |
| 8 | Borrar las filas de analítica de prueba antes de la beta: `delete from analytics_events where created_at < '2026-08-12'` | tú |

## 10. Decidido y aparcado

- **Pool compartido** para la monotonía de proteína: prototipado, medido, no
  integrado.
- **Latencia de Ajustes**: abrir la hoja lanza 6 generaciones del motor.
  Mitigado (se pinta al instante con «calculando»), no resuelto.
- **Asturias**: 13 SKU que dan 404 fuera de Madrid, sin remapear.
- **Carrefour vía Awin** (licencia y 5% de comisión) es la fuente limpia cuando
  el scraping deje de ser viable. El escáner de tickets es el plan de
  continuidad, no un extra.
- **79 recetas que el motor no sirve nunca**: la pregunta no es si merecen foto,
  es si merecen estar en el recetario.
