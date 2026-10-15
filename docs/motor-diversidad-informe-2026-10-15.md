# Presupuesto y variedad · pescado en Gran Canaria, criterio experimental y catálogo · 15 oct 2026

> Producción no cambia: el experimento solo se activa con una opción que la
> app no pasa (`PeticionSemana.diversidad`). Está comprobado con el banco del
> motor: 33 de 33 semanas idénticas antes y después del cambio.
>
> - Datos, menús completos y compra por envases:
>   `docs/motor-diversidad-2026-10-15.md`, generado por
>   `catalogo/_aud-diversidad.ts informe 8 4`.
> - Diagnóstico del pescado: `catalogo/_aud-pescado-gc.ts`.
>
> Sin push a `main`, sin despliegue.

**Caso controlado**, idéntico en todas las comparaciones:

- 35007, almacén 3120;
- 2 personas, comidas y cenas (14 comidas);
- semana desde el lunes 19 oct 2026, semana 1;
- sin despensa, sin historial, sin filtros;
- proteína normal, sin postre, variedad alta.

Los 16,93 € de tu prueba siguen pendientes de tus ajustes y tu versión
exactos. Aquí no se intentan reproducir.

---

## 1 · Por qué no entra el pescado con 100 €

Gran Canaria tiene **2 recetas de pescado** de 37: dorada al horno y lubina a
la espalda. Ninguna de marisco. Lo que las deja fuera, por orden, son cuatro
decisiones del motor y un problema de envase. **El presupuesto no es una de
ellas.**

| decisión | dónde | qué pasa con el pescado | cifra |
|---|---|---|---|
| **1. Las semillas son las 8 recetas más baratas por ración** | `construirMejor`, `SEMILLAS_REINTENTO` | Dorada y lubina son las dos más caras de las 37 (puestos 37 y 36), así que nunca arrancan una semana. Las etapas de 24 semillas y de todas solo se abren si las 8 primeras no cumplen suelo y presupuesto, y con 100 € las cumplen | 3,77 € y 3,27 € por ración, frente a 1-2 € de las semillas |
| **2. En cada comida pierde por el perecedero** | `construir`, término `objetivo.peso × perecederoMarginal` | Es lo que más pesa contra ellas, entre 4,6 y 9,7 puntos según la comida. El coste por encima de la cuota del hueco pesa poco: −3,1 como mucho, y 0 en los huecos con cuota alta | La lubina pierde entre 2,8 y 9,9 puntos frente al plato elegido |
| **3. Reglas de «comida de verdad»** | `familia_mismo_dia`, `tope_por_base` | En 4 comidas ni se llegan a evaluar: ese día ya hay pescado o la misma base | 6 descartes en la semilla ganadora |
| **4. Gana la semana que menos desperdicia** | `rango`, criterio de proteína normal: caja − consumo + perecedero | Forzar la dorada como primer plato da una semana válida que pierde | Dorada: +12,03 € de caja, +4,88 € de perecedero, criterio 39,66 contra 28,77. Lubina: +10,63 €, +4,72 €, 39,90 |

**El envase es la causa de fondo.**

- La receta pide 230 g por persona, 460 g para dos.
- El producto es una pieza limpia de 400 g (dorada 5,40 €, lubina 5,04 €) que
  dura 2 días.
- Hay que comprar 2 piezas, 800 g, y sobran 340 g de pescado fresco que no
  aguanta hasta otra receta.
- El motor lo cuenta, con razón, como unos 4,7 € a la basura.

Con 60, 80 o 100 € pasa lo mismo: **el dinero sobra, lo que falla es el
desperdicio**.

Madrid no tiene este problema:

- 24 recetas de pescado y marisco;
- productos congelados que no caducan esa semana (lomo de merluza, gamba,
  calamar, mejillón);
- con 60 € ya entran 3 tandas de pescado y 1 de marisco.

**Es catálogo, no motor.**

---

## 2 · El criterio propuesto

**Lo que se quiere:** que el margen se gaste en variedad de platos e
ingredientes según lo que pide el usuario.

**Lo que no se quiere:**

- minimizar siempre el gasto;
- comprar para llegar al tope;
- dar por hecho que la carne o lo caro es mejor.

**Definición de «más variada».** Se compara en este orden y nada de esto mira
el precio:

1. **Favoritos del usuario** que entran. Lo que ha pedido manda.
2. **Tipos de plato distintos** (`receta.proteina`: legumbre, huevo, pollo,
   cerdo, pescado, soja, tofu, lácteo, verdura…). **Todos pesan lo mismo**:
   un plato de lenteja que la semana no tiene vale exactamente lo mismo que
   uno de dorada.
3. **Reparto**: menos tandas del tipo más repetido.
4. **Fuentes de proteína distintas**: familias de ingrediente con 8 g o más
   por 100 g.

**Cómo se busca** (experimento `diversidad`):

- **Semillas por tipo de plato.** Además de las 8 más baratas, la más barata
  de cada tipo que no esté entre ellas. Abre caminos que hoy nunca se
  exploran.
- **Un bonus fijo por estrenar un tipo de plato**, 8 puntos, igual para todos.
  Compite con el perecedero (4,6 a 9,7) sin aplastarlo.
- **La semana de producción es siempre la referencia y siempre candidata.** La
  primera versión medía contra una base ya desviada por el bonus y salía peor
  que producción: 60 € en Gran Canaria, 5 tipos de plato en vez de 6.
  Corregido.

**Cuándo se acepta gastar más.** Solo si se cumplen las cuatro condiciones:

- **Las de siempre:** cabe en el tope y cumple el suelo de proteína.
- **Desperdicio:** caja − consumo + perecedero, como mucho **4 €** por encima
  de la semana de producción. Es más o menos una pieza de pescado fresco
  sobrante.
- **Rendimiento:** de cada euro de más, al menos el 55 % acaba en el plato
  (`RENDIMIENTO_MINIMO_HOLGURA`, ya calibrado).
- **Perecedero:** no más del 20 % de lo que se come (`TOPE_DESPERDICIO`), o no
  más que producción si ya estaba por encima.

**No hay porcentaje mínimo de gasto.** Si nada más variado pasa esas
condiciones, se queda la semana de producción.

**Restricciones que no se tocan:**

- **Dietas y alergias:** las recetas salen de `recetarioAdaptado`, igual que en
  producción. Hay test: vegetariano no trae carne ni pescado.
- **Cantidades:** las de cada receta. Ni se recorta ni se agranda nada.
- **Tiempo de cocina:** el filtro de esfuerzo y la penalización de minutos,
  los de siempre.
- **Presupuesto:** sigue siendo el techo duro.

En las 18 semanas medidas, todas cubren 14 comidas, caben, cumplen el suelo y
salen idénticas al repetirlas.

**No es la antigua holgura:**

- No apunta a un porcentaje del tope.
- No busca subir el consumo.
- Las palancas de la holgura (`objetivoExtra`, `fraccionReserva`…) siguen
  apagadas.
- Lo único que puede comprar el margen es un tipo de plato más o un reparto
  más equilibrado.

---

## 3 · Producción frente al experimento, a 60, 80 y 100 €

Tablas completas, menús y compra por envases en
`docs/motor-diversidad-2026-10-15.md`.

Cómo leer las columnas:

- **«Tipos»:** tipos de plato distintos, y entre paréntesis las tandas del más
  repetido.
- **«No comido»:** caja − consumo. Casi todo es inventario que aguanta (arroz,
  legumbre seca, patatas, cebollas); la parte que se pierde es la columna
  *perecedero*.

### Gran Canaria, catálogo de hoy (37 recetas)

| tope | motor | caja | consumo | perecedero | tipos | fuentes | pescado |
|---:|---|---:|---:|---:|---|---:|---:|
| 60 | producción = experimento | 51,16 € | 27,12 € | 5,61 € | 6 (3) | 12 | 0 |
| 80 | producción = experimento | 55,54 € | 29,08 € | 5,07 € | 5 (3) | 13 | 0 |
| 100 | producción = experimento | 52,04 € | 28,36 € | 5,09 € | 5 (3) | 13 | 0 |

**El experimento no cambia nada.** Las semanas más variadas que encuentra no
pasan las condiciones de gasto. A 60 €, la de 7 tipos cuesta 5,10 € más y solo
2,52 € acaban en el plato (49 %, por debajo del 55 %).

**Lo que compra cada incremento, en producción:**

- **60 → 80 € (+4,38 €):** un tipo de plato menos (sale el plato sin proteína y
  entra otra soja), una fuente más, +1,5 g de proteína y 45 minutos menos de
  cocina.
- **80 → 100 €:** 3,50 € **menos** de caja con la misma composición. Es la
  dependencia del camino ya documentada: el tope cambia las cuotas y el greedy
  acaba en otro valle.

**Por encima de unos 55 €, el catálogo de Gran Canaria no tiene en qué gastar
el margen sin tirar comida.**

### Gran Canaria si aceptaras las 16 alternativas ya validadas (62 recetas; supuesto)

| tope | motor | caja | consumo | perecedero | tipos | fuentes | pescado |
|---:|---|---:|---:|---:|---|---:|---:|
| 60 | producción | 55,82 € | 31,00 € | 3,75 € | 6 (4) | 12 | 3 |
| 60 | experimento | 59,90 € | 33,45 € | 4,49 € | 7 (3) | 12 | 2 |
| 80 | producción | 60,84 € | 33,27 € | 7,06 € | 6 (3) | 12 | 3 |
| 80 | experimento | 62,64 € | 34,74 € | 6,20 € | 7 (3) | 13 | 3 |
| 100 | producción = experimento | 61,62 € | 34,79 € | 4,85 € | 7 (3) | 13 | 3 |

**Solo con aceptar las alternativas, sin tocar el motor**, entran 3 tandas de
pescado (merluza y sardinas) desde 60 €.

**Lo que añade el experimento:**

- **60 € (+4,08 €):**
  - Gana: un tipo de plato (huevo); el más repetido baja de 4 a 3 tandas;
    +2,45 € de comida.
  - Pierde: un pescado (de 3 a 2), +0,74 € de perecedero, y el trío de
    fuentes sube de 6 a 8 tandas.
  - **Mejora discutible.**
- **80 € (+1,80 €):**
  - Gana: un tipo de plato (lácteo), una fuente más, +1,47 € de comida y
    0,86 € **menos** de perecedero.
  - **Mejora clara.**
- **100 €:** igual que producción.

**Lo que compra cada incremento en producción:**

- **60 → 80 €:**
  - la legumbre baja de 4 tandas a 1 y entran huevo, cerdo y pollo;
  - +3,31 € de perecedero.
- **80 → 100 €:**
  - +0,78 € de caja, un tipo de plato más;
  - 2,21 € **menos** de perecedero.

### Madrid, control (152 recetas)

| tope | motor | caja | consumo | perecedero | tipos | fuentes | pescado + marisco |
|---:|---|---:|---:|---:|---|---:|---:|
| 60 | producción | 57,22 € | 32,64 € | 5,35 € | 6 (3) | 12 | 4 |
| 60 | experimento | 58,55 € | 33,91 € | 4,82 € | **8 (3)** | 14 | 4 |
| 80 | producción = experimento | 64,13 € | 32,15 € | 5,98 € | 8 (3) | 14 | 3 |
| 100 | producción | 76,44 € | 39,35 € | 4,97 € | 8 (3) | 16 | 3 |
| 100 | experimento | 81,48 € | 43,97 € | 7,54 € | 9 (3) | 14 | 5 |

**Lo que añade el experimento:**

- **60 € (+1,33 €):**
  - dos tipos de plato más (tofu y lácteo) y dos fuentes más;
  - +1,27 € de comida y 0,53 € **menos** de perecedero.
  - **Mejora clara, por un euro y pico.**
- **80 €:** igual que producción. Producción ya da 8 tipos.
- **100 € (+5,04 €):**
  - Gana: un tipo de plato más y +4,62 € de comida (el 92 % del extra).
  - Pierde: +2,57 € de perecedero, dos fuentes menos, y el trío sube de 5 a 6.
  - **Mejora discutible.** Más tipos de plato, pero menos repartidos por
    dentro, y más basura.

**Lo que compra cada incremento en producción:**

- **60 → 80 € (+6,91 €):**
  - dos tipos de plato más y un trío más repartido (de 6 a 4);
  - pero el consumo **baja** 0,49 €: el extra va a inventario.
- **80 → 100 € (+12,31 €):**
  - dos fuentes más, +1,4 g de proteína;
  - +7,20 € de comida, 1,01 € menos de perecedero.

### Qué se separa con el control

| | Gran Canaria hoy | Gran Canaria + 16 aceptadas | Madrid |
|---|---|---|---|
| Recetas | 37 | 62 | 152 |
| Pescado / marisco | 2 / 0 | 9 / 0 | 17 / 7 |
| Pescado en producción, a cualquier tope | no | sí, 3 tandas | sí, 3-4 |
| Ganancia del experimento | ninguna | +1 tipo a 60 y 80 € | +2 tipos a 60 €; +1 a 100 € |
| Coste en latencia (este PC) | ×2 (unos 60 ms) | ×2-3 (unos 120 ms) | ×3 (unos 370 ms) |

**Lo que limita hoy en Gran Canaria es el catálogo, en dos frentes:**

- Hay pocas recetas.
- Los únicos pescados son piezas enteras de 2 días, que no casan con la
  cantidad de la receta.

El motor, con más catálogo, ya mete pescado sin cambios. El criterio
experimental añade variedad real donde hay recetario (Madrid, y Gran Canaria
ampliada) y nada donde no lo hay. Es lo esperado: no se inventa variedad que no
existe.

### Limitaciones del motor que se ven aquí

1. **Gastar más no siempre mejora.** En Gran Canaria, 100 € da una semana
   más barata que 80 €; en Madrid, de 60 a 80 € el consumo baja. Es la
   dependencia del camino ya documentada en `seleccionar.ts` («subir el tope
   puede darte menos comida»). El experimento no la arregla.
2. **El envase no se planifica.** El motor no sabe juntar dos platos que
   compartan la pieza de pescado sobrante (dorada el lunes, otra receta de
   dorada el martes). Con piezas de 400 g y raciones de 230 g, eso es lo que
   haría entrar el pescado fresco sin tirar comida. Sería un cambio de motor
   aparte. Cambiar la cantidad por ración para que case con el envase sería
   tocar cantidades, y no se ha hecho.
3. **Las semillas son de las más baratas.** Es la puerta por la que el
   experimento abre caminos nuevos. Cuesta latencia: en Madrid, unos 370 ms
   contra 100-150. En Android se estima ×3-6, sin medir.
4. **Una semana sola exagera lo «no comido».** La mitad de la caja es
   inventario que pasa a la despensa. Con semanas encadenadas, la semana
   siguiente lo aprovecha (`existencias`). El perecedero, unos 5 €, es lo que
   se pierde de verdad.

---

## 4 · Equivalencias de Gran Canaria · qué falta y qué desbloquea cada una

**De dónde sale este apartado.**

- **Catálogo supuesto:** el que dan las 16 alternativas validadas
  técnicamente, generado con
  `node --experimental-strip-types catalogo/construir-zona.ts cerrar gran-canaria 2026-10-14 --suponer-aceptadas`.
  Va a `catalogo/capturas-crudas/`, no a la app.
- **No se ha aceptado ni validado nada.** La aceptación culinaria es tuya
  (`catalogo/zonas/gran-canaria-aceptacion.json` o
  `docs/alternativas-3120.html`). La validación técnica pendiente necesita
  fotos de etiqueta o lineal que solo se sacan en la tienda.

**Estado** de los 118 ingredientes con producto en Madrid:

| estado | n.º |
|---|---:|
| Mismo SKU, verificado | 67 |
| Mismo SKU, sin verificar (falta revisión humana) | 18 |
| Alternativa validada, **falta tu aceptación** | 16 |
| Alternativa sin validar (falta foto) | 14 |
| Sin producto | 3 |

**Por orden de lo que desbloquean.** Recetas nuevas si se resolviera SOLO esa:

| ingrediente | qué falta | recetas | de mar | ejemplos |
|---|---|---:|---:|---|
| pimiento verde | foto del cartel o la etiqueta | **14** | 1 | garbanzos con tomate, patatas panaderas |
| espinaca | **tu aceptación** | 7 | 0 | huevos con espinacas, cuscús con garbanzos |
| aceituna verde | **tu aceptación** | 5 | 2 | ensalada con caballa, lubina con aceitunas |
| berenjena | foto | 4 | 0 | escalivada, tumbet |
| calabacín | foto (alérgenos) | 4 | 1 | dorada con verduras |
| calabaza | foto y peso | 4 | 0 | lentejas con calabaza |
| sardina fresca | **tu aceptación** | 4 | **4** | sardinas al horno, en escabeche |
| acelga | sin producto (solo fresca, merma la mitad) | 3 | 0 | |
| tofu | revisión del mismo SKU | 3 | 0 | |
| alcachofa, lomo de cerdo | **tu aceptación** | 2 cada una | 0 | |
| lomo de merluza | **tu aceptación** | 1 | 1 | merluza al horno |
| calamar congelado | foto y peso limpio | 1 | 1 | calamares encebollados |
| atún en lata | revisión del mismo SKU | 1 | 1 | pasta con atún |

**Combinaciones:**

- Las 16 juntas desbloquean 25 recetas (de 37 a 62).
- Resuelto todo lo pendiente, Gran Canaria tendría las 152.

**Lo más rentable:**

1. **Aceptar** espinaca, aceituna verde y sardina fresca: 16 recetas, 6 de
   ellas de mar.
2. **Una foto del pimiento verde** en el lineal de 3120: 14 recetas.

**Efectos separados:**

- **Catálogo:** aceptar las 16 con el motor de producción mete 3 tandas de
  pescado y deja la semana a 55,82-61,62 € con 6-7 tipos de plato.
- **Motor:** el experimento suma un tipo de plato a 60 y 80 €.
- **Orden de impacto:** primero el catálogo.

---

## 5 · Qué recomiendo, sin aplicarlo

1. **Producción sigue igual** hasta que revises esto.
2. **Lo primero, en el catálogo, no en el motor:**
   - decidir las 16 alternativas, empezando por espinaca, aceituna verde y
     sardina;
   - la foto del pimiento verde.
3. **El experimento**, si se adopta:
   - con `bonusFamiliaNueva: 8` y `toleranciaDesperdicio: 4`;
   - después de medirlo en semanas encadenadas con despensa, que es donde el
     de calidad del 13 oct dejó de aceptar nada;
   - y midiendo su latencia en un Android.
   - Hoy no lo activaría: en Gran Canaria no aporta, y en Madrid a 100 € su
     mejora sale con más basura.
4. **Lo que de verdad metería el pescado fresco en Gran Canaria** es planificar
   la pieza entera entre dos comidas. Va aparte, con su propio análisis.

## 6 · Pruebas

- **Banco del motor** (`_aud-bench-motor.ts`) antes y después del cambio: 33 de
  33 semanas idénticas. Producción no cambia.
- **`src/motor/diversidad.test.ts`**, nuevo, 5 tests:
  - con el experimento, la semana cabe, cumple el suelo y los filtros;
  - nunca es menos variada que producción (Madrid y Gran Canaria, a 60 y
    100 €);
  - vegetariano no trae carne ni pescado.
- **Suite completa:** 468 tests en verde. `tsc` y `eslint` limpios.
- **Las 18 semanas del informe**, generadas dos veces: idénticas.
