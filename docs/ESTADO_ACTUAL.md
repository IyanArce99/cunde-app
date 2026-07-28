# Cunde — estado actual del proyecto (resumen para retomar contexto)

> Generado el 2026-07-28 para poner al día a otra sesión/instancia de Claude.
> Fuente de verdad complementaria: `CLAUDE.md` en la raíz del repo (reglas de
> producto, voz, modelo de datos, stack). Este documento cubre lo que
> `CLAUDE.md` **no** refleja todavía: qué se ha construido de verdad en `src/`.

## 1. Qué es Cunde, en una frase

App móvil española (Ionic React + Capacitor) que resuelve la compra semanal
del súper con presupuesto cerrado: comensales + súper + presupuesto → menú de
7 días + lista de la compra con precios reales + coste total, antes de dar un
email o una tarjeta. **No es una app de recetas, es una app de dinero que se
paga en comida.** Diferenciación frente al competidor gratuito (ChatGPT):
precios reales de SKUs concretos.

## 2. Estado real vs. lo que dice CLAUDE.md

`CLAUDE.md` tiene una sección "Estado actual" **desactualizada** — sigue
diciendo que solo hay maquetas y componentes con datos falsos. La realidad:
todo el frontend del onboarding + Semana + Compra + monetización está
construido y funcional sobre datos mock. Lo que falta es exactamente lo que
`CLAUDE.md` ya identifica como "Siguiente": el motor de menús real, Supabase,
el scraping de precios. Nada de eso existe. Todo lo que se ve en la app hoy
es determinista en código pero **sobre datos de ejemplo**, no sobre un
catálogo ni un motor real.

**Sin commitear.** El repo tiene un único commit ("Initial commit"). Todo lo
construido esta sesión está sin commitear en el working tree.

## 3. Stack tal cual está montado

- Ionic React + Capacitor + Vite. React 19, TypeScript estricto.
- Enrutado: `react-router-dom` v5 + `IonReactRouter`.
- Estado: **un único `useReducer` + Context** (`src/state/AppStateContext.tsx`),
  persistido en `localStorage` bajo la clave `cunde:estado:v3`. No hay
  Zustand ni Redux (CLAUDE.md permite useState/Zustand; se optó por
  useReducer porque da acciones nombradas sin añadir una librería).
- Fuentes autoalojadas vía paquetes `@fontsource/*` (IBM Plex Mono,
  Bricolage Grotesque, Inter) — bundling de Vite, cero peticiones de red en
  tiempo de ejecución. No son ficheros sueltos en `src/assets/fonts/` como
  decía CLAUDE.md original, pero cumplen el mismo objetivo (offline-first).
- Sin backend. Sin Supabase. Sin scraping. Todo lo que parece "catálogo de
  Mercadona" es mock estático en `src/data/`.
- Nunca se ha verificado que el proyecto Android nativo funcione en esta
  máquina (no se ha ejecutado `npx cap add android`). Cualquier plan que
  dependa de un plugin nativo (notificaciones, share nativo) debe verificar
  esto primero.

## 4. Sistema visual (implementado, no solo especificado)

Concepto: ticket de compra térmico. Tokens en `src/theme/tokens.css`:

```
--papel   #EFEDE6   --tinta   #1A1917   --azulete #2B4C7E
--gris    #6E6A5F   --pauta   #A9A498   --roja    #B32C19
--oferta  #FFD400
```

Nota: `--gris` y `--roja` son la corrección de accesibilidad de la v2 del
diseño (`#6E6A5E`→`#6E6A5F`, `#C8341F`→`#B32C19`), **distintos** de los valores
literales que todavía aparecen en la sección "Sistema visual" de CLAUDE.md.
CLAUDE.md no se actualizó tras aplicar la corrección; el código es la fuente
correcta.

Tipografía: IBM Plex Mono (datos/precios, `tabular-nums`), Bricolage
Grotesque (titulares y la cifra grande), Inter (cuerpo). Escala 13/15/17/22/34/56.

Componente firma: `TicketRow` (`src/components/TicketRow.tsx`) — concepto +
línea de puntos elástica + importe. Es el componente más reutilizado de la
app; ahora hace `flex-wrap` para no romperse a 200% de zoom (ver §6).

Prohibido y respetado: sin verde, sin emojis, sin fotos de comida grandes,
sin degradados/glassmorphism, sin gamificación, sin urgencia artificial.

## 5. Pantallas construidas (todas navegables desde `/`)

**Onboarding** (`src/pages/onboarding/`)
1. **Portada** — titular + "Empezar". Cabecera con línea de puntos (igual que el resto de pantallas).
2. **Datos** (1a) — comensales (grid 1-5+) + súper (6 cadenas), una sola pantalla, paso 1/2.
3. **Presupuesto** (1b) — paso 2/2, cifra 56px, slider 30-200€, deriva €/persona/día y €/plato. **Detecta presupuesto imposible** al vuelo (mínimo viable = 3€/persona/día × 7 × comensales): si no cuadra, aviso inline con salida real ("Subir a X€" o volver a Datos a reducir personas) — nunca bloquea el CTA.
4. **Generando** — pantalla de carga ~2.2s. **Es una espera artificial, no hay cómputo real detrás** (ver hallazgo pendiente en §7).

**Semana** (`src/pages/Semana.tsx` + componentes)
- Total animado (56px, cuenta con `requestAnimationFrame` sobre un ref, nunca `useState`), barra de presupuesto (roja si te pasas — el rojo vive solo en la cifra, no en fondos/bordes de alarma).
- "Te sobran/pasas X€" → abre `AjustesSemana`.
- "Dime lo que no comes" → abre el mismo `AjustesSemana` con copy distinta.
- 7 tarjetas de día, **tappables**: abren `HojaDeDia`.
- **`HojaDeDia`** (sheet): Cambiar plato (otro de esfuerzo parecido, al azar), Bájame el precio (el más barato disponible, con el ahorro exacto mostrado antes de aplicar), Este día no cocino (abre `EsteDiaNoCocino`), Ver receta (abre `RecetaPlato`).
- **`EsteDiaNoCocino`**: reorganiza de verdad — el día libre pasa a coste 0, otro día del resto de la semana recibe un plato nuevo del pool de alternativas, con las cuentas del cambio línea a línea antes de confirmar.
- **`RecetaPlato`**: pasos mock (3 por plato) para los 17 platos posibles (7 del menú base + 10 del pool de alternativas). Contenido real, no un placeholder vacío.
- **`AjustesSemana`**: comidas/cenas, esfuerzo, exclusiones. **Ninguna función de `lib/menu.ts` lee estas preferencias todavía** — guardar cuenta como "ajuste" (la métrica 2 se alimenta de verdad) pero no cambia ni un plato. Es un gap conocido, no un bug oculto.
- **Muro de pago** (`MuroDePago`): se dispara al abrir Semana con semana efectiva ≥2 y sin suscripción. La "semana efectiva" no depende solo de haber cerrado la compra (paso saltable): si pasan 7+ días reales desde que se generó la semana, se considera semana 2+ igual. Recap con datos reales (presupuesto/pagaste/diferencia), dos planes iguales sin preseleccionar, salida gratuita al mismo peso visual (17px, no un link gris pequeño). La decisión de "seguir gratis" se persiste en estado global por nº de semana — no reaparece en cada navegación dentro de la misma semana.

**Compra** (`src/pages/Compra.tsx`)
- Lista agrupada por pasillo real (FRUTA Y VERDURA / CARNICERÍA / PESCADERÍA / DESPENSA), cabecera de pasillo sticky con subtotal.
- 28 productos mock con formato real de venta ("Bandeja 700 g"), coherentes entre sí en precio.
- Filas memoizadas (`React.memo` + `useCallback` en el toggle) — **verificado con instrumentación real**, no solo revisado: marcar un producto no repinta las otras 27 filas.
- Aviso "sin conexión" real (`navigator.onLine` + listeners), no decorativo.
- Pie fijo: LLEVAS (animado), restan, barra de progreso, "Cerrar la compra" → abre `CierreDeSemana`.
- **`CierreDeSemana`**: un solo campo (importe real del ticket), calcula Previsto/Pagado/Diferencia (rojo solo si hay desviación real, azul si aciertas al céntimo)/Sobre-presupuesto. Guardar avanza el contador de semana; "Ahora no" descarta sin penalizar.

**Ruta secundaria**: `/semana/variante` (2a) — la "hipótesis arriesgada" del propio material de diseño (€/persona/día como cifra grande). No está enlazada desde ningún sitio de la navegación real. Candidata a eliminar (ver §8).

## 6. Auditoría UX/UI reciente — qué se encontró y qué se arregló

Se hizo una auditoría completa contra las 5 métricas de negocio de CLAUDE.md
(toques hasta ver el menú, ajustes en primera sesión, apertura de Compra en
tienda, retorno semana 4, tarjetas compartidas). Hallazgos **verificados**
(contraste calculado con la fórmula WCAG real, tap targets medidos con
Playwright, memoización probada con contadores de render reales, no nada
supuesto a ojo).

**Arreglado esta sesión:**
- El muro de pago se re-disparaba en cada navegación Semana↔Compra dentro de
  la misma semana (vivía en `useState`, no en estado global). Ahora persiste.
- `TicketRow` y el markup propio de la cabecera de pasillo / pie de Compra /
  pestañas no colapsaban a 200% de zoom (texto cortado, "€" solapado). Ahora
  todos hacen `flex-wrap` correctamente; las pestañas además hacen
  `scrollIntoView` de la activa si no caben las dos.
- Botones `:disabled` usaban `opacity` en el contenedor entero → contraste
  real de 1,59:1 (medido). Cambiado a un tratamiento de color propio sin
  opacity, ≥4,17:1.
- "Cambiar plato" no comprobaba si quedaban alternativas (a diferencia de
  "Bájame el precio"); ahora se desactiva con explicación igual que su vecino.
- Presupuesto imposible (ej. 54€/5 personas) ahora se detecta en la propia
  pantalla de Presupuesto, con salida real, nunca un muro ni una mentira
  aguas abajo.
- Exceso de rojo en Semana: se quitó el fondo/borde de alarma de "Te pasas
  X€"; el rojo vive solo en la cifra.
- Tap targets bajo 48px medidos y corregidos: pestañas (23→56px), botones ✕
  de Hoja de día/Receta (25→56px), chips de dieta (39→56px).
- Marca "LA COMPRA" → "CUNDE" en todo el onboarding, `index.html`,
  `manifest.json`.
- Bug de layout raíz: `.pantalla` usaba `min-height:100%` en vez de
  `height:100%`, y faltaba `min-height:0` en los contenedores flex
  scrolleables — en pantallas bajas, el pie con el botón principal quedaba
  fuera de la vista sin forma de hacer scroll hasta él. Arreglado y
  verificado en 4 tamaños de pantalla reales.

**Pendiente, no tocado a propósito** (el usuario pidió revisarlos él antes):
- Cero uso de `rem` en toda la app: el ajuste de tamaño de letra del sistema
  no tiene ningún efecto.
- `public/manifest.json` referenciaba iconos que no existen en `public/`
  (puede seguir sin arreglar del todo — revisar).
- Estado de lista de la compra vacía sin diseñar (zona en blanco, sin
  mensaje, "Cerrar la compra" sigue activo).
- Pantalla "Generando": 2,2s de espera fija sin cómputo real detrás — friction
  gratuita contra la métrica 1.
- `AjustesSemana` no conectado a `lib/menu.ts` (ver §5).
- `src/theme/variables.css` sigue siendo el comentario vacío de la plantilla
  Ionic, importado sin usarse.
- `/semana/variante` sin enlazar (ver §8).

## 7. Datos mock — qué existe y dónde

- `src/data/mockMenu.ts` — 7 platos del menú base (Lunes a Domingo).
- `src/data/mockLista.ts` — 28 productos de la compra, agrupados por pasillo,
  con formato de venta real, algunos con etiqueta de procedencia de precio
  ("precio del 24 jul", "estimado").
- `src/data/mockAlternativas.ts` — 10 platos candidatos para "Cambiar plato"
  / "Bájame el precio" / reorganizar.
- `src/data/mockRecetas.ts` — pasos (3 por plato) para los 17 platos posibles.

Todos coherentes entre sí en precio (verificado: 30,60€ × comensales cuadra
exactamente con el total mostrado en Semana).

## 8. Qué añadiría / qué quitaría (de la auditoría, no ejecutado)

**Añadir** (candidatos que mueven una métrica real, caben en <2 días, no
dependen de datos nuevos — evaluados y no descartados):
1. Tarjeta compartible 9:16 (mueve la métrica 5 directamente; es la única
   mecánica que existe para ella; nunca se construyó).
2. Recap "la semana pasada" para usuarios ya suscritos (hoy ese recap solo
   lo ven los que no pagan, dentro del muro).

**Rechazado explícitamente**: recordatorio local tipo "domingo, planea tu
semana" — sobre el papel movería la métrica 4, pero no se puede prometer
"menos de 2 días" sin haber verificado antes que el proyecto Android nativo
compila en esta máquina.

**Quitaría**: `/semana/variante` — no enlazada, no mueve ninguna métrica, el
propio material de diseño la presenta como hipótesis no decidida.

## 9. Decisiones tomadas sin especificación explícita (para que las conozca quien retome esto)

- Numeración de pasos del onboarding: "1/2" y "2/2" en vez del "1/3"→"3/3"
  literal del material de diseño (el propio fichero fuente tenía un salto
  inconsistente, sin un "2/3" real).
- `/semana/variante` como ruta de referencia secundaria, no como sustituto
  de la Semana principal (el material de diseño la presenta como hipótesis).
- Mínimo viable de presupuesto: 3€/persona/día, heurística propia (no hay
  motor de menús real todavía que dé un número exacto).
- Reorganizar ("Este día no cocino") no usa lógica de caducidad real (no
  existe modelo de ingredientes por día); el copy se dejó deliberadamente
  genérico para no inventar una razón que no se puede sostener.
