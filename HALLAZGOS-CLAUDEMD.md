# Lo que `CLAUDE.md` dice y el código no cumple

Esto NO va en el documento del diseñador: es ruido interno para él y trabajo
pendiente para ti.

Salió de documentar la app leyendo solo el código. Son nueve puntos donde el
manual del proyecto y lo construido no coinciden. Ninguno está resuelto: hace
falta decidir, en cada uno, si manda el código (y se actualiza `CLAUDE.md`) o
manda el manual (y se cambia el código).

El número 4 y el 8 son los que yo miraría primero: uno es una pantalla de
producto navegable que nadie sabe que existe, y el otro es una bomba de relojería
para el rediseño.

---

Entre `CLAUDE.md` (la fuente de verdad declarada) y el código. **No las he
resuelto.** Las dejo señaladas con fichero y línea para que las decida quien
corresponda.

**1. Dos valores de la paleta no coinciden.**
`CLAUDE.md:61` declara `--roja #C8341F`; `src/theme/tokens.css:23` define
`--roja: #B32C19`.
`CLAUDE.md:63` declara `--gris #6E6A5E`; `src/theme/tokens.css:32` define
`--gris: #6E6A5F`.
El código lleva un comentario que justifica el valor del gris («4.61:1 sobre
papel. Pasa AA de justo: no bajarlo más»), lo que sugiere que el ajuste fue
deliberado y `CLAUDE.md` no se actualizó. Del rojo no hay justificación escrita.

**2. Las fuentes no están donde dice el documento.**
`CLAUDE.md:73` dice «Autoaloja las fuentes en `src/assets/fonts/`».
`src/theme/tokens.css:1-9` las importa de los paquetes `@fontsource/*`
(`package.json:21-23`), y **el directorio `src/assets/` no existe**. El espíritu
de la regla se cumple —las fuentes van empaquetadas, no hay enlaces a Google
Fonts— pero la ubicación es otra.

**3. La sección de despensa se llama distinto.**
`CLAUDE.md:143-144` dice que la despensa va «en una sección al final llamada
"Por si te falta", con casilla de "ya lo tengo"».
`src/pages/Compra.tsx:158` la llama **`YA LO TIENES`**, y además ha fusionado dos
secciones en una (despensa declarada + sobrantes de semanas anteriores) y la ha
convertido en una hoja plegada en vez de una sección. El código documenta el
cambio y sus motivos en `Compra.tsx:35-48`.

**4. Existe una tercera ruta de producto además de las dos pestañas.**
`CLAUDE.md:29` dice «Dos pestañas: Semana y Compra. Ninguna más. Nunca.»
`src/App.tsx:70-72` registra `/semana/variante`, servida por
`src/pages/SemanaVariante.tsx`. No es una pestaña y no está enlazada, pero es una
tercera pantalla de producto navegable por URL, que pinta la barra de pestañas
con «SEMANA» activa y contiene un botón muerto.

**5. El gestor de estado no es el declarado.**
`CLAUDE.md:40` dice «Estado: `useState` / Zustand. Nada de Redux.»
`src/state/AppStateContext.tsx` usa `useReducer` + Context con un reducer de 16
acciones y un `STORAGE_KEY` versionado — que es el patrón de Redux sin la
librería. Zustand no está en `package.json`.

**6. El apartado «Estado actual» está desfasado.**
`CLAUDE.md:179-180` dice que los componentes Semana y Compra funcionan «con datos
falsos que tienen la forma real del backend», y `CLAUDE.md:185-189` lista como
«siguiente» el esquema de Supabase, las 30 recetas y el motor de menús.
En el repositorio hay un **motor completo y determinista** (`src/motor/`, con
`seleccionar.ts` de más de 1800 líneas y su batería de tests), un catálogo real
en `src/data/motor-datos.json` (generado el 2026-07-28, con **112 recetas**, 114
SKU y 12 grupos de ensamblajes), y funciones que no aparecen en el documento:
despensa persistente, memoria de tres semanas, postres, ensamblajes, cierre de
semana con deshacer y muro de pago.

**7. `CLAUDE.md` no menciona ni el postre, ni los ensamblajes, ni la despensa
persistente, ni el nivel de proteína.** Son cuatro conceptos centrales del
producto tal y como está construido hoy (los cuatro tienen tipos propios en
`src/state/types.ts` y controles propios en la interfaz), y ninguno aparece en el
modelo de datos ni en las reglas del motor del documento.

**8. Modo oscuro de Ionic activado sobre una paleta que no lo contempla.**
`src/App.tsx:39` importa `@ionic/react/css/palettes/dark.system.css`, que activa
el modo oscuro automático de Ionic según la preferencia del sistema. La paleta
del proyecto es de papel claro y está escrita a mano en `tokens.css` sin ninguna
variante oscura. `CLAUDE.md` no dice nada del modo oscuro. Hoy no rompe nada
visible porque los tokens propios ganan, pero es una fuente de sorpresas si el
rediseño toca componentes nativos de Ionic.

**9. La regla de la cifra más grande se cumple, pero el 56 no está solo en el
total de semana.**
`CLAUDE.md:71` dice «La 56 se reserva al total de la semana».
Además de Semana (`Semana.css:14`) y de la variante (`SemanaVariante.css:13`),
el 56 se usa en Portada (`Portada.css:94`, el total del ticket de muestra) y en
Presupuesto (`Presupuesto.css:71`, la cifra que el usuario elige). Los dos casos
están argumentados en los comentarios del código —el total del ticket de la
portada **es** un total de semana— pero no dejan de ser dos usos que el documento
no contempla.
