# Cunde — estado actual

> Reescrito el **11 ago 2026**. La versión anterior era del 28 jul y describía
> una app sin motor, sin catálogo y con datos de ejemplo. Nada de eso sigue
> siendo cierto: hoy hay motor determinista, catálogo real de Mercadona y
> precios que se actualizan sin publicar versión.
>
> Fuente de verdad complementaria: `CLAUDE.md` (reglas de producto, voz, modelo
> de datos). Este documento cubre **qué hay construido**, no qué debería haber.

---

## 1. En una frase

App móvil española que resuelve la compra semanal con presupuesto cerrado:
comensales + presupuesto → menú, lista de la compra con SKU y precios reales de
Mercadona, y el total antes de salir de casa. **No es una app de recetas; es
una app de dinero que se paga en comida.**

## 2. Lo que hay, en números

```
151 recetas          118 ingredientes canónicos (17 de despensa)
117 SKU elegidos     28 recetas con foto (72% de los platos servidos)
30 componentes       13 ficheros de test · 275 tests en verde
precios del          catálogo Mercadona real, actualizable sin
2026-08-10           publicar en Play Store
```

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

---

## 9. Qué falta antes de publicar

| | qué | quién |
|---|---|---|
| 1 | **Rotar la contraseña de Postgres** y la **clave de OpenAI** — las dos se pegaron en un chat | tú |
| 2 | Añadir `SUPABASE_DB_URL` como secreto de GitHub para que el cron corra | tú |
| 3 | ~~Conectar un sumidero de analítica~~ **Hecho el 11 ago.** Falta poner `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`, y aplicar la migración | tú |
| 4 | Política de privacidad | — |
| 5 | Build de release firmada | — |
| 6 | Consultar con abogado de PI antes de lanzar en público (ver nota legal de `CLAUDE.md`) | tú |

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
