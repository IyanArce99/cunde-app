# Motor · investigación y mejora de la cuota con despensa

> 13 de octubre de 2026. Todo lo de este documento está leído en `src/motor/` y
> comprobado ejecutándolo, salvo donde se dice lo contrario. Nada se ha
> publicado ni desplegado; los cambios están sin commit.
>
> **Posterior a este informe:** la comparación de variantes
> (`docs/motor-variantes-informe-2026-10-13.md`) llevó a apagar la pasada de
> holgura por defecto. Las cifras de aquí se midieron con la pasada encendida;
> `catalogo/_aud-existencias.ts` la enciende con `conHolgura` para seguir
> reproduciéndolas.

---

## 1. Diagnóstico del motor

### Algoritmo (`src/motor/seleccionar.ts`)

1. **Filtro duro.** `recetarioAdaptado()` quita recetas por alergia (mira
   trazas), preferencia (no mira trazas), tiempo y platos bloqueados. Nada
   posterior puede saltarse esto.
2. **Greedy por hueco** (`construir()`, líneas 1033-1560). Rellena los 14
   huecos en orden. Para cada hueco puntúa cada receta elegible con el coste
   marginal *de caja* sobre el carrito acumulado —así emerge compartir
   ingredientes— más términos en euros: variedad (+100 por estrenar), proteína
   (+30 escalado), sabor repetido, fuente repetida, memoria de semanas
   anteriores, registro comida/cena, minutos de fogón. El coste **no se
   minimiza**: solo penaliza pasarse de la cuota del hueco (`excesoCoste`).
   Restricciones duras: tope por base, reserva de fresco, suelo de proteína
   alcanzable, presupuesto como techo mientras haya con qué.
3. **Multiarranque determinista** (`construirMejor()`). 8 semillas baratas,
   24, luego todas si no cuadra; después afloja la memoria.
4. **Pasada de holgura.** Si el gasto efectivo (caja + armario) está por debajo
   del 85 % del tope, rehace la semana con cuatro palancas
   (`PALANCAS_HOLGURA`) y acepta solo si mejora en todo: proteína, fresco,
   comida, perecedero, sobras.
5. **Reparación.** Si no cuadra, salidas (subir tope, bajar variedad o
   proteína); `repararHueco()` y `rehacerDesde()` para los retoques.

### Envases, despensa, sobrantes (`src/motor/carrito.ts`)

- Necesidad acumulada por SKU, `ceil` al envase, sobrante partido en larga y
  corta conservación con `factorPenalizacion(7 / días)`.
- Los 17 ingredientes `es_despensa` **sí participan** en la selección (están en
  las recetas) pero se excluyen del total y de la puntuación de coste. No hay
  ninguna verdad sobre si el usuario tiene aceite: se supone que lo tiene.
- Los postres entran como base de la necesidad antes del primer candidato.
- Las existencias se descuentan como `min(enCasa, necesario)`; la comida del
  armario se valora a precio de catálogo en `totalDelArmario`.

### Dónde toma decisiones baratas localmente y caras en global (medido)

- El presupuesto es objetivo interno (apunta al 95 %) y entra en la puntuación
  hueco a hueco. El propio código documenta que subir el tope puede dar menos
  comida (nota «PENDIENTE» en `seleccionar.ts`). No se ha tocado: es rediseño.
- **Inconsistencia corregida:** las cuotas por hueco restaban solo la caja,
  mientras la pasada de holgura mide caja + armario.

### Qué garantizan los tests existentes y qué no

`src/motor/motor.test.ts` (45 tests antes de este trabajo): nunca vacío, forma
de la semana, `cuadra` honesto, filtros nunca saltados, determinismo, retoque
local, memoria, despensa que no recompra, caducidad, cenas ligeras, fresco
mínimo.

No detectan: si una semana es «buena» en comida por euro; si tener despensa
encarece la caja; nada sobre la pasada de holgura con existencias. El test «el
euro de más acaba en el plato» se mide sin despensa.

---

## 2. Causa del caso de las existencias

Reproducido con los parámetros originales: 2 personas, 14 comidas, 65 €,
variedad y proteína normal, semana 2 con lo que sobró de la 1 y memoria de
la 1. Con el catálogo de hoy sale **62,45 € con despensa** frente a **48,72 €
con la cocina vacía**. La cifra anterior (63,16 € / 55,10 €) era con el
catálogo de antes de las recetas de cuscús. `catalogo/_aud-existencias.ts` lo
reproduce.

No es un error de contabilidad del carrito. La traza paso a paso:

- Greedy base con despensa: **40,87 €** (sí aprovecha: 10,15 € del armario).
  Con la cocina vacía: 48,72 €.
- La pasada de holgura ve 51,02 € de gasto efectivo sobre 65 y arranca. Con la
  cocina vacía, sus 27 intentos fallan por poco en las puertas (rendimiento
  por debajo del 55 % o proteína). Con despensa, el quinto intento pasa:
  carrito 62,45 €, consumo 45,96 €, tres bolsas de calamar congelado.
- Pasa porque dentro de `construir` **la cuota de cada hueco no descontaba lo
  que ya salía del armario**: con 13 € en casa, cada hueco tenía su cuota
  entera de dinero nuevo encima. El resultado valía 75,74 € de comida sobre un
  tope de 65, por encima de lo que la propia pasada dice respetar.

Los menús son distintos y el de la despensa come más (45,96 € frente a
27,48 €), así que no es una comparación de ahorro limpia. Lo que sí es un
fallo es que **tener comida en casa hiciera pagar 13,73 € más por caja**.

---

## 3. Alternativas estudiadas

Hubo acceso a internet. Fuentes:

- **LNS (destruir y reparar).** Pisinger, D. y Røpke, S. (2010), *Large
  Neighborhood Search*, en *Handbook of Metaheuristics*, 2.ª ed., Springer,
  pp. 399-420. <https://orbit.dtu.dk/en/publications/61a1b7ca-4bf7-4355-96ba-03fcdf021f8f>.
  Encaja bien aquí porque `construir()` con `ArranqueParcial` ya es un
  reparador: destruir 2-4 tandas y reconstruir. Coste: varias construcciones
  por iteración (35-100 ms cada una en PC); en móvil, segundos. Descartada esta
  vez por latencia y porque el problema medido no era de búsqueda.
- **Beam search frente a greedy.** Wilt, C., Thayer, J. y Ruml, W. (2010), *A
  Comparison of Greedy Search Algorithms*, SoCS 2010, pp. 129-136.
  <https://ojs.aaai.org/index.php/SOCS/article/view/18182>. Beam y best-first
  rinden parecido y mejor que hill-climbing; aquí sería multiplicar el coste
  del greedy por la anchura del haz.
- **GRASP.** Feo, T. A. y Resende, M. G. C. (1995), *Greedy randomized
  adaptive search procedures*, *Journal of Global Optimization* 6(2),
  pp. 109-133. <https://link.springer.com/doi/10.1007/BF01096763>. El motor ya
  hace la mitad (multiarranque determinista por semillas); le falta la
  búsqueda local por intercambios. Candidato natural para una segunda fase.
- **Pilot y rollout.** Runarsson, T. P., Schoenauer, M. y Sebag, M. (2012),
  *Pilot, Rollout and Monte Carlo Tree Search Methods for Job Shop
  Scheduling*. <https://arxiv.org/pdf/1210.0374>. La cita de Duin y Voß (1999)
  no se pudo verificar en fuente primaria.
- **Programación entera con envases discretos.** van Rooijen, M. A.,
  Gerdessen, J. C., Claassen, G. D. H. y de Leeuw, S. L. J. M. (2024),
  *Optimizing household food waste: The impact of meal planning, package
  sizes, and performance indicators*, *Resources, Conservation and Recycling*
  205. <https://doi.org/10.1016/j.resconrec.2024.107559>. Confirma que el
  problema real es un MILP con tamaños de envase; un solver en móvil no está
  justificado hoy.
- **Revisión de planificación de menús.** GRASP e ILS aparecen como lo
  habitual: <https://link.springer.com/article/10.1007/s12351-022-00702-4>.

### Elección

La mejora más pequeña con efecto medible era corregir la cuota, no cambiar de
técnica. Se probaron tres variantes; ninguna cambia nada en semanas sin
despensa:

| Variante | Qué hace | Resultado |
|---|---|---|
| **A** | Los frenos de la pasada de holgura se miden sobre comida nueva y caja, no sobre consumo y gasto efectivo | 33 de 33 semanas idénticas. Combinada con B, premia abandonar el armario y comprar nuevo. **Descartada.** |
| **B** | La cuota por hueco descuenta lo que ya sale del armario | **Adoptada.** Ver sección 5. |
| **C** | B + la pasada rechaza intentos con gasto efectivo por encima del tope | −8 % de caja, pero −15 % de huecos con fresco y perecedero ×2,4 en la semana clave. **Descartada.** |

---

## 4. Cambios implementados

- `src/motor/seleccionar.ts`: tres líneas funcionales en `construir()`
  (`armarioActual` entra en `permitidoPorHueco`) y un comentario con las
  cifras. El coste marginal sigue siendo por caja a propósito, para que el
  plato que gasta lo abierto siga ganando. Interfaces intactas.
- `src/motor/motor.test.ts`: test nuevo «con la nevera llena, la construcción
  base no planifica más comida de la que cabe en el tope» (N de 1 a 4 ×
  despensa ×1, ×2, ×4, más determinismo con despensa). Comprobado que el motor
  de HEAD lo falla en 2 de 15 casos (67,18 € y 69,58 € sobre 65) y el nuevo
  en 0.
- Sondas nuevas, que no modifican nada:
  - `catalogo/_aud-bench-motor.ts`: banco de 33 semanas con `guardar` y
    `comparar`.
  - `catalogo/_aud-existencias.ts`: reproduce el caso.
  - `catalogo/_aud-bench-cadenas.mjs` y `catalogo/_aud-bench-frescos.mjs`:
    agregados sobre el banco.
  - Resultados en `catalogo/bench-motor/`: `antes.json`, `b.json`
    (adoptado), `a.json`, `ab.json`, `bc.json` (descartados).
- Nota en `docs/ESTADO_ACTUAL.md`.
- Nada tocado fuera del motor. Sin commit ni despliegue.

---

## 5. Antes y después (medido, mismo banco)

18 semanas sin despensa: **menú idéntico** las 18.

Las 15 semanas con despensa, sumadas por cadena:

| Cadena | Caja | Consumo | Perecedero | Huecos con fresco |
|---|---|---|---|---|
| 2 personas · 65 € (3 sem) | 146,78 → 139,90 | 113,14 → 108,83 | 10,71 → 11,99 | 16 → 18 |
| 1 persona · 45 € (3) | 92,79 → 93,66 | 50,78 → 54,41 | 12,20 → 10,82 | 20 → 14 |
| 4 personas · 100 € (2) | 172,65 → 151,93 | 144,87 → 134,02 | 10,55 → 7,49 | 13 → 13 |
| 2 personas · 50 € (3) | 126,55 → 116,79 | 98,48 → 97,71 | 12,48 → 8,10 | 17 → 17 |
| 3 personas · 80 € · postre (2) | 132,77 → 125,55 | 119,06 → 115,18 | 6,99 → 6,86 | 15 → 11 |
| 2 personas · 55 € · vegano (2) | 66,48 → 64,87 | 51,49 → 52,40 | 7,88 → 8,47 | 0 → 0 |
| **Total, 15 semanas** | **738,02 → 692,70 (−6,1 %)** | **577,82 → 562,55 (−2,6 %)** | **60,81 → 53,73 (−11,6 %)** | **81 → 73** |

- Consumo por euro de caja: 0,783 → 0,812.
- Proteína media: 57,5 → 57,6 g. Las 15 cumplen el suelo antes y después.
- `cuadra` y exceso de presupuesto: sin cambios. El único caso que no cuadra
  (30 € para dos) sigue igual.
- Latencia media: 298 → 311 ms en este PC (semanas con despensa 231 → 281 ms).
  Máximo 2,4 → 2,1 s (ruido).

El caso original pasa de 62,45 € a 56,19 € con despensa, comiendo 43,36 €.
Sigue por encima de los 48,72 € de la cocina vacía porque la pasada de holgura
gasta la banda del presupuesto, que es una decisión de producto documentada
en el código y que no se ha cambiado.

---

## 6. Pruebas, limitaciones y riesgos

**Pruebas ejecutadas**
- Suite completa: 21 ficheros, 359 tests en verde (4 min 47 s).
- `tsc --noEmit` limpio. `eslint` limpio en `seleccionar.ts` y
  `motor.test.ts`.
- Banco de 33 semanas antes y después sobre exactamente las mismas entradas;
  dos pasadas del motor nuevo dan los 33 menús idénticos.

**Limitaciones**
- El ahorro es honesto solo en parte: las semanas con despensa comen un 2,6 %
  menos y tienen medio hueco de fresco menos por semana (5,4 → 4,9). Lo que
  mejora es comida por euro y perecedero.
- No se afirma que el motor sea óptimo ni validado nutricionalmente;
  «proteína» es la suma de tablas por ingrediente.
- Las cadenas dependen del camino: a partir de la semana 3 no se compara la
  misma despensa, solo el agregado tiene sentido.
- Latencia medida en este PC; en Android se estima ×3-6, sin medir.

**Riesgos abiertos, documentados y sin resolver**
1. La pasada de holgura puede dejar el gasto efectivo por encima del tope.
   Sigue pasando en 2 de 15 semanas con despensa.
2. El presupuesto como objetivo interno hace que subir el tope pueda dar menos
   comida (nota «PENDIENTE» en `seleccionar.ts`).
3. «Gastar la banda» choca con el objetivo de que el presupuesto sea límite y
   no meta. Es una decisión de producto, no técnica: si el tope pasa a ser
   solo límite, el cambio está en `BANDA_PRESUPUESTO` y en la pasada de
   holgura, y conviene medirlo con el mismo banco.

Todo sigue sin commit, junto con el código postal obligatorio y las recetas
de cuscús del mismo día.
