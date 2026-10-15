# Envase compartido, fichas de las recetas nuevas y preferencia por la carne · 16 oct 2026

> Datos completos:
> - `docs/motor-envase-compartido-2026-10-16.md` (generado por
>   `catalogo/_aud-envase-compartido.ts`);
> - `docs/preferencia-carne-2026-10-16.md` (`catalogo/_aud-preferencia-carne.ts`).
>
> Experimento `diversidad` apagado. Sin push a `main` ni despliegue.
>
> **Caso controlado:** 35007 → 3120 · 2 personas · comidas y cenas · semana
> desde el lunes 19 oct 2026 · sin filtros · proteína normal · sin postre ·
> variedad alta.

## 1 · Dónde fallaba

**El cálculo final no fallaba.** `acumularNecesidad` suma por SKU y
`totalesDeNecesidad` redondea a envases enteros: si dos recetas usan la misma
bandeja, al final no sobra nada.

**Fallaba la selección anticipada, en `construir()`.** Cada candidato se
puntúa con su perecedero *marginal*. La primera receta que abre la bandeja de
500 g paga como desperdicio la mitad que no usa, sin que nada considere que
otra receta podría gastarla. Pierde siempre frente a un plato sin sobrante
fresco, y la segunda receta nunca llega a tener ocasión.

**Lo que el inventario no tiene, y no se ha cambiado: fechas.** Suma por SKU sin
mirar el día de cada uso. Antes de este cambio el motor daba por aprovechados
sobrantes fuera de plazo. En el caso controlado:

- un bote de champiñón abierto el martes y gastado el domingo;
- media barra de pan cinco días después.

## 2 · Qué se ha implementado

Todo dentro de `construir()`, sobre `totalesDeNecesidad`, sin otra
contabilidad.

1. **Crédito al abrir.**
   - Si un candidato deja sobrante de un producto de vida corta (7 días o
     menos, no congelado), se busca otra receta que lo use. Tiene que ser
     elegible (por eso respeta filtros, alergias y tiempo de cocina),
     distinta, no usada y dentro del tope de recetas de la variedad.
   - Además tiene que haber un hueco libre dentro del plazo.
   - Si existe, el candidato paga solo el sobrante que esa receta no podría
     gastar.
   - Coste: una búsqueda en un índice por SKU calculado una vez por semana. No
     es una búsqueda exhaustiva.
2. **Reserva.** Mientras quede un hueco en plazo, las recetas que pueden
   terminar ese envase reciben el mismo peso que se adelantó.
   - Sin esto, la segunda receta perdía después frente a las penalizaciones de
     repetir proteína en días seguidos, y el crédito era una promesa vacía.
   - Si no se elige, el sobrante aparece en el carrito final como siempre.
3. **Plazo.** No se reutiliza un sobrante fuera de plazo (pasada estricta,
   como las reglas de «comida de verdad»).
   - Lo fresco vale desde el día de la compra, el primero de la semana, hasta
     sus días de conservación.
   - Si la ficha da horas una vez abierto, tampoco más allá de eso desde el
     primer uso.
   - Lo congelado no cuenta. No se supone que el usuario congele nada.
   - **Solo para carne, pescado y marisco.** Aplicarlo también a verdura y
     botes abiertos hacía que las semanas de presupuesto justo dejaran de
     cuadrar con las 8 primeras semillas, y el motor probaba el recetario
     entero.
4. **Horas una vez abierto**, en el vocabulario (`horas_abierto`), sacadas de
   la ficha de Mercadona de 3120 y con la fuente escrita junto al dato:

   | producto | ficha | una vez abierto |
   |---|---|---|
   | pechuga de pollo | 3400 | 24 h |
   | lomo de cerdo | 4119 | 48 h |
   | carne picada de cerdo | 5241 | 24 h |
   | carne picada mixta | 5077 | 24 h |

   - 24 h equivale a «hasta el día siguiente».
   - Madrid usa para el lomo y las picadas otra referencia con el mismo
     nombre, cuya ficha no he comprobado.
5. **Latencia acotada.** Si con el crédito ninguna de las 8 primeras semillas
   cuadra, se reintentan las mismas 8 sin él antes de escalar a 24 y a todas.
   Así nunca cuadra menos que antes, y en el peor caso paga el doble de la
   primera etapa.
6. **No se hace nada de esto:**
   - no se suben raciones;
   - no se obliga a repetir plato;
   - no cambia otra prioridad del motor;
   - no se activa el experimento `diversidad`.

   `sinEnvaseCompartido` reproduce el motor anterior, solo para comparar.

## 3 · Resultados

### Gran Canaria

| tope | antes | ahora | carne |
|---|---|---|---|
| 60 € | 58,23 € · 7 categorías (máx. 4) · perecedero 2,97 € | 58,62 € · 7 (máx. 3) · perecedero 5,03 € | **2 → 4** tandas |
| 80 € | 69,92 € · 8 (máx. 3) · 4,79 € | 73,89 € · 8 (máx. 2) · 4,77 € | 1 → 2 |
| 100 € | 75,51 € · 8 (máx. 3) · 5,14 € | 71,71 € · 7 (máx. 2) · 6,17 € | 2 → 3 |

**Qué carne entra a 60 €:**

- jamoncitos al ajillo;
- **salteado de pollo con judías y almendra** (miércoles) y **ensalada de
  pollo con maíz** (jueves), que **comparten la bandeja de pechuga**. Se abre
  el miércoles y se termina el jueves, dentro de las 24 h. Sobran 30 g;
- hamburguesa de cerdo.

**El perecedero sube 2,06 € a 60 €.** No es por la pechuga: es la lechuga
(jueves y sábado, fuera de plazo) y medio bote de champiñón. Los dos son
verdura, que no entra en la regla de plazo (ver §2, punto 3).

**A 80 y 100 €** la carne nueva no encuentra pareja dentro del menú:

- **80 €:** la carne son jamoncitos al ajillo y lentejas con chorizo, frente
  a solo jamoncitos antes. Mismo perecedero, mismas 8 categorías, y el tipo
  más repetido baja de 3 a 2 platos.
- **100 €:** entra el pollo al limón, sin pareja. Una categoría menos y
  +1,03 € de perecedero. **No es una mejora clara.**

### Con despensa

Semana 2, tras la semana 1 de 80 €:

| | antes | ahora |
|---|---:|---:|
| caja | 48,27 € | 46,49 € |
| consumo | 43,78 € | 45,73 € |
| perecedero | 6,54 € | **3,17 €** |
| tandas de carne | 3 | **5** |

Ahora comparten envase:

- pechuga: salteado (lunes) + ensalada (martes);
- **lomo:** lomo con champiñones (miércoles) + lomo en salsa de almendra
  (jueves), dentro de las 48 h.

Es el caso donde el cambio funciona mejor: más carne, menos caja y la mitad de
perecedero.

### Madrid (control)

| tope | antes | ahora |
|---|---|---|
| 60 € | 56,69 € · 6 categorías · perecedero 5,83 € | 59,89 € · 7 · 6,10 € |
| 80 € | 67,31 € · 7 · 5,19 € | 72,30 € · 9 · 6,49 € |
| 100 € | 78,32 € · 8 · 4,98 € | 74,59 € · 7 · 6,61 € |

Más categorías a 60 y 80 €. Algo más de perecedero en los tres.

### Banco del motor (33 semanas)

| | antes | ahora |
|---|---:|---:|
| caja media | 52,07 € | 52,35 € |
| comida nueva | 35,80 € | 36,27 € |
| desperdicio | 16,27 € | 16,08 € |
| perecedero | 3,53 € | **3,77 €** |
| perecedero con despensa (15 semanas) | 47,39 € | **52,79 €** |
| proteína | 56,3 g | 56,7 g |

- **Desperdicio** (caja − consumo + perecedero): mejor en 15 semanas, peor en
  12.
- **Perecedero:** mejor en 11, peor en 16.

Parte de la subida de perecedero es honestidad. Antes, la carne reutilizada
fuera de plazo se daba por comida. No sé separar cuánto.

### Tiempo de generación

Medido por candidatos evaluados, que no depende de la carga del ordenador:

| caso | antes | ahora |
|---|---:|---:|
| 2 personas, 45 € | 7.889 | 15.724 (dobla: reintento sin crédito) |
| 2 personas, 65 € | 7.836 | ~8.000 |

- En tiempo, el banco da **+44 % de media** (las dos versiones medidas en las
  mismas condiciones).
- En Gran Canaria, entre 60 y 115 ms por semana, frente a 45-90 ms antes.
- Hubo una versión intermedia, ya descartada, en la que el crédito y la regla
  juntos disparaban la búsqueda a 2,8 s con 45 €. Está resuelta con el
  reintento del punto 5.

### «No cocino» sobre la pareja

A 60 €, al liberar la ensalada de pollo, que comparte pechuga con el salteado:

- la caja baja de 58,62 € a 58,02 € (**no sube**);
- el perecedero sube de 5,03 € a 7,70 € (vuelve a sobrar media bandeja);
- calculado de cero desde las tandas, también 7,70 €.

Comprobado también en `src/motor/envase-compartido.test.ts`.

### Lo que queda sin resolver

El plazo solo se exige a carne, pescado y marisco. **Verdura y botes abiertos
pueden seguir reutilizándose fuera de plazo**, como antes de este cambio:
lechuga, champiñón, judía en tarro. Arreglarlo de verdad es dar fechas al
inventario (`Necesidad`), y eso cambia todas las semanas del motor.

## 4 · Fichas de las recetas nuevas

Consultadas en la API de Mercadona (almacén 3120) el 16 oct 2026, con 450 ms
entre peticiones.

| duda | ficha | evidencia | qué se ha cambiado |
|---|---|---|---|
| Presentación del bacalao | 62050 «Lomo de bacalao MareDeus ultracongelado», 384 g | «**en su punto de sal**». Ingredientes: bacalao 90 %, agua 8 %, sal 2 %. «Descongelar en el frigorífico 12 horas… una vez descongelado consumir en 24 horas» | Bacalao a la gallega: **no se sala el bacalao**; la sal (1,5 g por ración) es para el agua de la patata. Descongelar sobre rejilla 12 h y cocinar en 24 h |
| Carne picada «preparado» | 5241 cerdo y 5077 mixta, bandejas de 500 g | Cerdo: carne 82,2 %, agua, fibra vegetal, antioxidantes, sulfito; trazas de soja. Mixta: vacuno 45 %, cerdo 45 %, agua, fibra de guisante, antioxidantes, sulfito. **No lleva sal añadida.** «Una vez abierto consumir en 24 horas» | La sal de la hamburguesa y del pastel se queda: la duda de que ya la llevaran era infundada. Las 24 h pasan al motor (§2) |
| Harina de maíz | 9588 «Harina fina de maíz Hacendado» | Denominación legal y único ingrediente: «**Almidón de maíz**» | Puerros gratinados: el paso dice almidón y la leche sube a 320 ml para 20 g, unos 62 g/l, una bechamel espesa de gratinar |

**Ninguna duda documental queda sin resolver, y ninguna receta sale de los
menús de la beta por esto.**

Siguen pendientes las **pruebas culinarias**, que son otra cosa:

- textura de la salsa de los puerros;
- si las albóndigas de merluza aguantan la forma;
- tiempos del papillote y de los jamoncitos.

## 5 · La semana que no cuadra

Es `inalcanzable` (2 personas, 14 comidas, 30 €), un caso imposible a
propósito. **Es la única que no cuadra** en las tres versiones:

- el banco guardado del 13 oct (`b.json`);
- con el lote de Gran Canaria;
- con este cambio.

No hay regresiones nuevas.

## 6 · «Soy más de carne»

- **Solomillo en 3120: no habilitado.** Existe (4460, «Solomillo de cerdo»,
  paquete de ~0,5 kg, 4,00 €), pero la ficha sigue sin lista de ingredientes ni
  de alérgenos («x99», que no significa «sin alérgenos»). Le falta lo mismo que
  el 14 oct: una foto de la etiqueta.
  - La ficha sí dice «una vez abierto consumir en 48 horas».
  - No lo he confundido con el lomo. De las dos recetas de solomillo de
    Madrid, la del horno necesita además calabacín, que no está validado.
- **Lo que la app ya permite:** marcar platos con «me gusta» (`platosFavoritos`).
  El motor los premia por hueco sin tocar filtros, presupuesto ni proteína.
  - He simulado a alguien que marca los 11 platos de pollo y de lomo de cerdo
    disponibles en 3120, y no la legumbre con chorizo ni la picada.

| | caja | perecedero | categorías | carne | legumbre | pescado |
|---|---:|---:|---:|---:|---:|---:|
| 80 € general | 73,89 € | 4,77 € | 8 | 2 | 2 | 3 |
| 80 € con favoritos | 74,74 € | 4,38 € | 7 | **4** | 1 | 2 |
| 100 € general | 71,71 € | 6,17 € | 7 | 3 | 2 | 3 |
| 100 € con favoritos | 74,57 € | **4,30 €** | 7 | **5** | 2 | 1 |

**A 100 € con favoritos:**

- ensalada de pollo (lunes) y salteado de pollo (martes) comparten pechuga;
- lomo en almendra (martes) y lomo con champiñones (miércoles) comparten
  lomo;
- jamoncitos (jueves y sábado).

Siguen dos de legumbre y uno de pescado. +2,86 € de caja y 1,87 € **menos** de
perecedero. Los menús completos están en
`docs/preferencia-carne-2026-10-16.md`.

**Cómo encajarlo en los ajustes, sin hacerlo todavía.** Hoy hay que marcar
plato a plato. Se podría añadir, en «Lo que no cambia cada semana», una línea
«Lo que más te apetece» con fichas por tipo (pollo, cerdo, pescado,
legumbre…):

- marcar «pollo» haría que todos los platos de pollo cuenten como
  favoritos, con el mismo peso que un «me gusta»;
- vacío por defecto;
- no toca filtros;
- no es premium: es lo mismo que ya hace «me gusta».
