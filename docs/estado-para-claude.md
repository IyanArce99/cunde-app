# Contexto: Cunde — estado a 31 de julio de 2026

Pega esto entero al empezar una conversación nueva. Está escrito para que Claude
pueda opinar de producto y diseño sin tener el repositorio delante.

---

## Qué es

App móvil española que resuelve la compra semanal del súper con un presupuesto
cerrado. El usuario dice "somos 2, compro en Mercadona, tengo 65 € esta semana"
y recibe menú, lista de la compra con productos y precios reales de Mercadona, y
el coste total antes de salir de casa.

**No es una app de recetas. Es una app de dinero que se paga en comida.**

El competidor gratuito es ChatGPT. Lo único que él no puede hacer es dar precios
reales de SKUs concretos. Ese es todo el espacio de diferenciación.

**Stack:** Ionic React + Capacitor (Vite). Estado en useReducer + localStorage.
Motor determinista en TypeScript compartido: corre en Node al generar el
catálogo y en el navegador en tiempo de ejecución. Backend previsto Supabase,
suscripciones RevenueCat. Windows, así que solo Android por ahora.

## Reglas que no se negocian

1. **La IA no calcula nada en tiempo de ejecución.** Todo determinista, en
   código. La IA solo se usa fuera de ejecución (redactar recetas offline).
2. **Valor antes que registro. Registro antes que pago.** El usuario ve su menú
   completo con precio sin dar un email.
3. **La cifra en euros es siempre el elemento más grande de la pantalla.**
4. **Dos pestañas: Semana y Compra. Ninguna más.**
5. **El plan se va a romper el martes.** La app absorbe el fallo y reorganiza,
   no riñe al usuario.
6. **Compra se usa de pie, con una mano, empujando un carro.**

**Prohibido:** verde de cualquier tipo (es el color de Mercadona y de toda app
de salud), emojis, degradados, glassmorphism, sombras difusas, gamificación,
cuentas atrás, escasez falsa. Suscripción semanal o prueba trampa: descartado
por posicionamiento — hay un competidor en España a 9,99 €/semana y queremos ser
lo contrario.

**Sistema visual:** el ticket de compra español. Papel térmico (#EFEDE6), cifras
monoespaciadas (IBM Plex Mono, tabular-nums), líneas de puntos entre concepto e
importe, totales a la derecha. Azulete #2B4C7E para acciones, amarillo #FFD400
para ahorro, rojo #B32C19 para pasarse del presupuesto. **Sin cajas ni
tarjetas**: papel, filetes y cifras.

---

## Estado por funcionalidad

### Motor de menús — FUNCIONA, con un fallo conocido

- 112 recetas, 108 SKUs del catálogo real de Mercadona (almacén mad3, extraído
  el 28 jul; precios reverificados el 30 jul: 105 de 108 sin cambios).
- Reparte 14 huecos (7 días × comida y cena) en tandas, con tipos de hueco:
  `cocinado`, `sobras` (recalientas lo mismo), `ensamblaje` (plato nuevo con la
  tanda de ayer), `libre`.
- Dos costes que nunca se mezclan: **consumo** (lo que se come) y **carrito**
  (lo que pasa por caja). La diferencia es el desperdicio y minimizarla es la
  función objetivo del producto.
- 46 tests de invariantes en vitest, ~12 minutos.
- **Verificado el 31 jul en 6 perfiles × 3 semanas:** todas cuadran, todas
  cumplen el suelo de proteína (56-65 g/día), 9 platos distintos cada una.

**FALLO ABIERTO — el selector de variedad.** Los tres niveles (poca/normal/
mucha) prometen que más variedad cuesta más, y es falso en 12 de 15
combinaciones de comensales × presupuesto. Con 1 persona y 80 €, "mucha" sale
8,57 € más barata que "poca".

Investigado a fondo:
- Ninguna consecuencia se mueve con el precio. Ordenando las tres semanas de
  barata a cara, la monotonía sale así: minutos de cocina 5/15, proteína 4/15,
  tandas 4/15, platos distintos 3/15, perecedero 3/15, repeticiones 1/15. **El
  azar da 5/15.** Todo está en el nivel del azar o por debajo.
- No se arregla arreglando el motor: los tres niveles no son conjuntos anidados
  ("mucha" permite 12 recetas pero prohíbe sobras; "poca" permite 5 pero deja
  recalentar media semana). Ni un optimizador perfecto los ordenaría.
- Mantener los adjetivos mentiría: "poca variedad" tendría más platos que
  "mucha" en 6/15, y "casi sin repetir" repetiría más que la barata en 5/15.

**Propuesta pendiente de decidir:** enseñar las tres semanas reales ordenadas
por precio, cada una con sus números (precio, platos, repeticiones), sin
adjetivos. El orden pasa a ser verdad por construcción. Además quien pide lo
barato se ahorra 2,41 €/semana de media porque hoy "poca" ni siquiera es la más
barata de las tres que ya se calculan.

### Memoria de recetas — FUNCIONA

`PENAL_RECIENTE = [4, 1.6, 0.5]`, tres semanas de memoria, penalización
graduada y no prohibición, y se relaja antes de romper el suelo de proteína.

Solape entre semanas consecutivas, medido en 8 semanas: **4,3 de 10 sin
memoria → 0,4 con memoria**. Sin ella el motor cicla (la semana 7 es idéntica a
la 1). Cuesta 1,02 €/semana de carrito.

### Despensa — ARREGLADA HOY

Guarda lo que sobra de cada semana con caducidad, y el motor lo descuenta antes
de calcular el carrito. Se estabiliza en ~41 productos hacia la semana 6 (la
caducidad funciona, no crece indefinidamente). El ahorro se ve en la lista como
"YA LO TIENES · 7 · −12,45 €".

**El problema que tenía y cómo se arregló:** la despensa liberaba dinero y el
motor se lo gastaba en proteína fresca que se pudría. Ahorraba 3,77 €/semana de
carrito y hacía tirar 3,73 € más: **cuatro céntimos netos**.

Causa: `MAXIMO_TIRADO_POR_EURO` acotaba el *incremento* de desperdicio por euro
de comida ganado, pero no el total, y la búsqueda por coordenadas da dos vueltas
sobre cuatro palancas, así que la deriva se acumulaba sin freno. Y la despensa
lo agravaba: su comida cuenta como consumo pero cuesta 0 € en el carrito, así
que el "he ganado comida" que autoriza más desperdicio se inflaba gratis.

Arreglo: `TOPE_DESPERDICIO = 0.20`, un techo sobre el total y no sobre el paso,
calibrado con un barrido de 7 valores sobre 8 semanas.

| | Antes | Ahora |
|---|---|---|
| Desperdicio con despensa | 23,1% (peor 34,2%) | **15,5% (peor 19,2%)** |
| Ahorro neto de la despensa | +0,04 €/semana | **+8,57 €/semana** |

**Efecto secundario a vigilar:** el uso del presupuesto baja al 80% de media y
hay semanas muy baratas (una a 15,81 € sobre un tope de 65) cuando la despensa
ya cubre casi todo.

### Retoques — FUNCIONAN (252 pruebas, 0 fallos)

Tres acciones sobre cualquier hueco, probadas en 6 perfiles × 3 semanas × 14
huecos:

- **"Bájame el precio"** — 84/84, **0 suben el precio**, 0 se quedan sin nada.
  (Fue un fallo real: 31 de 126 pulsaciones subían hasta +6,37 €.) Ahorra entre
  0,25 € y 15,56 € de media según el perfil.
- **"Cambiar plato"** — 84/84, **0 devuelven lo mismo, 0 se agotan**, incluso en
  vegetariano y en "lo mínimo", que son los filtros más justos de recetas vivas.
- **"Esta comida no cocino"** — 84/84, 0 rompen la semana.

### Onboarding — REHECHO, 3 pasos

1. **1/3 ¿Dónde compras?** — cadena (solo Mercadona tiene catálogo; las demás
   salen apagadas y dicen "próximamente") y, si tiene catálogo, el código
   postal. Se sacó de una fila tocable escondida porque nadie la tocaba.
2. **2/3 ¿Cuántos sois?** — 1-5+ y las restricciones (12 alergias + 3 dietas)
   detrás de un toque, porque la mayoría no tiene ninguna.
3. **3/3 El presupuesto** — deslizador de 30 a 200 €, con la cifra grande y el
   coste por persona y día. Si no cuadra, ofrece la salida ("Con 31 € no me
   salen las cuentas. Con 52 € sí" + botón), nunca un muro.

**El indicador de progreso es el ticket que se va imprimiendo**: cada pantalla
añade su línea. Nada de barras de progreso ni steppers.

Portada: un ticket real generado por el mismo motor, con el total a 56 px.
Titular: "Tú pones el tope. Yo pongo las 14 comidas y la lista."

### Pantalla Semana — REDISEÑADA

Formato "F6": cada día es una línea de ticket con su total en la cabecera, el
plato con guía de puntos hasta el precio, una **barra de coste de 4 px** debajo
(escala común de la semana, no por día) y la línea de servicio
("comida · 25 min · cocinas · de la comida del lunes").

Se quitaron las cajas con borde: la lista pasó de 1.378 a 1.139 px (−17%) y de 4
a 5 comidas visibles sin scroll.

Cabecera condensada que se colapsa al hacer scroll (la cifra baja de 56 a 22 px
y se pone en línea con el saldo). El saldo solo es un botón cuando hay algo que
hacer: por debajo del 15% del presupuesto es texto, no control.

Hay deshacer al cerrar la semana, que era la única acción sin vuelta.

### Pantalla Compra — MEJORADA

Lista por pasillos con subtotales. **La cabecera de cada pasillo marca el
pasillo entero**, con tri-estado real (`aria-checked="mixed"`): marcar la lista
pasó de 27 toques a 9.

La fecha del catálogo va una sola vez arriba en vez de repetida en las 27 filas.
Funciona sin conexión. Al final, "YA LO TIENES" plegado con lo que no hay que
comprar.

### Ajustes — ARREGLADO EL RENDIMIENTO, REDISEÑO PENDIENTE

Congelaba el hilo **7,3 s al abrirse y 7,8 s por toque**. Dos causas: la clave
de caché incluía el eje que el propio cálculo ignora, y las seis estimaciones
del motor corrían dentro del render.

| | Antes | Ahora |
|---|---|---|
| Abrir Ajustes | 7.317 ms | **35 ms** |
| Cambiar variedad | 7.758 ms | **18 ms** |
| Marcar "gluten" | 6.850 ms | **16 ms** |

**PENDIENTE DE IMPLEMENTAR** (diseñado y aprobado, no construido): la hoja con
el total pegado arriba que dice qué le pasa a la cesta al elegir —"la cesta baja
3,67 €" en amarillo, "sube 0,80 €" en tinta, "te pasas 3,40 €" en rojo—. Subir
no va en rojo a propósito: gastarte tu presupuesto en comida no es un error.

### Postre — CONSTRUIDO

`src/motor/postres.ts`. Entra **dentro** del presupuesto, no encima: el coste se
aparta ANTES de elegir platos —no depende de cuáles salgan— y se descuenta del
techo con el que el motor optimiza. Si se sumara al final, encender el
interruptor reventaría el tope y la app mentiría con su propia cifra. Medido a
390×844: la cesta pasa de 57,40 € a 60,63 € dentro de un tope de 65.

Un postre **no es una receta**: no se cocina, no tiene pasos ni minutos. Va por
el mismo camino que cualquier ingrediente —necesidad por SKU, redondeo a
envases, sobrante— y sale en la lista de la compra con «para: el postre».

**La unidad del reparto es la COMIDA, y esto se corrigió tarde.** Al principio se
repartían solo raciones («esta semana entran 7 yogures y 7 plátanos»), que basta
para comprar y para cobrar pero no responde a «¿qué me como el martes?». Como el
dato no existía, la pantalla no tenía nada que enseñar: el interruptor subía el
precio y no cambiaba ni una línea de lo que el usuario ve. Reportado tal cual —
«sube el precio pero no sale en el menú ni en la receta»—. Ahora `postrePorHueco`
es la fuente de la verdad y las raciones se derivan de ella, así que lo que se
compra es exactamente lo que el menú dice que se come.

Dónde se ve: en la tarjeta del día, dentro de la línea que ya existe («comida ·
25 min · postre: yogur natural») para no gastar 18 px por hueco; y en la hoja del
día con su precio, que es la única respuesta a por qué sube la cifra. No entra en
`precioRacion` —si entrara, comparar dos platos incluiría un yogur idéntico en
los dos y el ahorro dejaría de ser el del plato—.

Tests en `src/motor/postres.test.ts`.

### Accesibilidad — CERRADA

Contraste AA limpio en 13 estados (había 2 fallos, uno apagaba el precio de una
opción imposible a 2,12:1). Ningún control sin nombre. Foco visible en todas las
paradas de tabulación. Siete controles que pintaban "seleccionado" sin
anunciarlo ahora lo hacen.

**El deslizador del presupuesto no se podía usar con teclado ni existía para un
lector de pantalla** — era un `div` con `pointerdown`. Ahora es `role="slider"`
con flechas, Inicio/Fin y `aria-valuetext`.

### Precios por almacén — INVESTIGADO, MECANISMO PUESTO

Medido contra la API de Mercadona con 6 códigos postales de 6 provincias:

- **El precio apenas cambia: 0,7%** (1,04 € sobre 145 en la misma cesta). Y con
  patrón limpio: **0 de 69 productos envasados cambian de precio; 11 de 14 de
  peso variable, sí.** Nacional para el tarro, regional para el fresco.
- **Lo que cambia es la REFERENCIA.** El mismo producto lleva SKU distinto por
  zona: los filetes de vacuno son 8936 en Madrid y 2900 en Sevilla, con nombre
  idéntico; la dorada es 87300 en A Coruña y 81234.1 en Sevilla.
- 25 de nuestros 108 SKUs no existen en algún almacén, **pero el ingrediente sí**
  (Sevilla tiene 5 corderos y 6 doradas). Es un problema de **mapeo**, no de
  surtido: no hay que tocar ninguna receta, hay que correr la extracción por
  almacén.

El código postal ya se pide y se guarda, pero **todavía no hace nada**: solo hay
un catálogo cargado (Madrid). La app avisa de ello si pones un CP de fuera.

### Muro de pago — MAQUETA, CONGELADO

No se toca hasta que haya método de pago. Estado real, para que conste:

- Solo tapa la ruta `/semana`. Con el muro puesto, `/compra` y `/semana/variante`
  cargan enteras.
- "Seguir con el plan gratis" abre la semana completa y reaparece la siguiente:
  el plan gratis es el de pago menos un toque por semana.
- Su texto promete "ajustes sin límite" como función de pago y **ese límite no
  existe en el código**.
- Abre enseñando "Pagaste 68,40 € · Te pasaste 3,40 €": le enseña al usuario que
  fracasó justo antes de pedirle dinero.

Lo que sí está bien y hay que conservar: ningún plan preseleccionado, la salida
gratis en tinta y no en gris pequeño, y "Se cobra hoy. Cancelas cuando quieras".

### Calorías — INVESTIGADO, NO CONSTRUIDO

Viable pero no como se pensaba. **La API de Mercadona no trae la tabla
nutricional** (solo alérgenos e ingredientes en texto), y Open Food Facts solo
encontró 9 de nuestros 93 EAN. Tienen que venir de una tabla de composición de
alimentos, colgadas del **ingrediente canónico**, no del SKU: son 109 números y
el camino ya existe (el canónico lleva `proteina_g_por_100` y el motor ya
convierte "por 100 g" en "por ración" descontando hueso y espina).

Hallazgo colateral: **las semanas actuales dan ~1.000 kcal/día de comida y
cena**, cuando con el reparto español (desayuno 20% · comida 40% · merienda 10%
· cena 30%) a la app le tocarían ~1.400. Nadie eligió eso: se optimizó por
dinero y proteína y la energía no se midió nunca. Cerrar el hueco cuesta 2,30 €
de arroz.

Riesgo a respetar: "macros detallados" está en la lista de lo que no se
construye. Las calorías serían **una entrada, nunca un cuadro de mandos** — un
techo en Ajustes, sin total diario ni anillo de progreso.

### Lanzamiento — NO LISTA

- **iOS imposible desde Windows.** Compilar necesita Xcode. La salida son los
  runners macOS de GitHub Actions.
- `appId` sigue siendo `io.ionic.starter`, el de la plantilla. **Una vez
  publicada no se puede cambiar.**
- No hay carpetas `ios/` ni `android/`: nunca se corrió `npx cap add`.
- **Apple rechazaría la app**: guideline 3.1.1, el muro enseña precios y no
  cobra.
- Los precios raspados tienen exposición legal asumida (consultar con abogado de
  PI antes de lanzar en público; el escáner de tickets es el plan de
  continuidad).

Para un test con amigos: **Android, y solo con gente de Madrid**, que es el
único almacén con el catálogo completo.

---

## Decisiones abiertas

1. **El selector de variedad**: tres semanas reales ordenadas por precio sin
   adjetivos, o conservar los nombres forzando el orden por dentro.
2. **Qué capar en el muro** cuando haya pago. La propuesta sobre la mesa: el
   bucle de esta semana gratis para siempre, y se paga por lo que se acumula (el
   historial de presupuestado contra pagado) y por los ejes extra del motor.
3. **El uso del presupuesto oscila** entre semanas en los perfiles con filtro
   (sin gluten: 86% → 98% → 46%). Vegetariano nunca pasa del 65%.
4. **La semana siempre empieza en lunes**, te bajes la app el martes o el sábado.
   No hay selector de día de inicio.
5. **La métrica del techo de desperdicio** usa `perecedero/consumo`, que penaliza
   estructuralmente a quien vive solo (come menos, así que el denominador es
   pequeño). Contra el carrito todos los perfiles salen igual: 10-14%.

## Qué NO proponer

Escaneo de despensa por foto (nunca). Multi-supermercado comparador. Comunidad o
recetas de usuarios. Importador de recetas de redes. Macros detallados. Modo
cocina por voz. Nutricionistas o B2B. Chat con IA como interfaz principal. Una
tercera pestaña.

## Voz

Tuteo. Frases cortas. Verbos activos. Sin emojis, sin exclamaciones, sin
disculpas. Una acción conserva su nombre en todo el recorrido: si el botón dice
"Guardar la semana", el aviso dice "Semana guardada".

| En vez de | Escribe |
|---|---|
| "¡Ups! Te has excedido un poquito 😅" | "Te pasas 8,40 €." |
| "Generando tu plan personalizado…" | "Cuadrando 7 días con 65 €." |
| "No se han encontrado resultados" | "Con ese presupuesto no me salen las cuentas. Con 46 € sí." |

## Métricas que importan

1. % que llega del primer toque a ver su menú con precio (>65%)
2. Nº de ajustes en la primera sesión (predice conversión a pago)
3. % que abre Compra estando en un supermercado
4. **Retorno en la semana 4 (>35%)** ← la que decide si esto es un negocio
5. Tarjetas compartidas por usuario activo

"Engagement" no significa tiempo en la app. La app ideal se usa 4 minutos el
domingo y 20 en el súper.
