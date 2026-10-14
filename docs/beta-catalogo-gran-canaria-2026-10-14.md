# Catálogo, SKU y precios para la beta · y Gran Canaria

> 14 oct 2026 · rama `beta/preparacion`. Revisión del catálogo de cara a la
> beta e investigación de Gran Canaria como segunda zona. El motor no se ha
> reoptimizado: solo ha cambiado lo que le entra (cantidades por envase,
> alérgenos, catálogo por zona).
>
> Anexo con la tabla SKU a SKU: [catalogo-auditoria-2026-10-14.md](catalogo-auditoria-2026-10-14.md).
> Capturas: `docs/capturas/2026-10-14/`.

## Resumen

| | |
|---|---|
| Catálogo de Madrid | 118 SKU consultados uno a uno en `mad3`. **0 discrepancias** tras las correcciones (había 23). 75 comprobados; 43 pendientes de que una persona confirme la correspondencia (el nombre o la categoría no la prueban) |
| Lo que estaba mal y afectaba al importe | 16 conservas se contaban por peso neto y la receta pide escurrido: se compraban menos botes de los necesarios. 9 piezas de fruta y verdura con peso de julio |
| Lo que estaba mal y afectaba a la salud | La gamba no declaraba **sulfitos** ni trazas de pescado; dorada y lubina no declaraban trazas de **marisco**. 15 SKU no tenían su etiqueta guardada |
| Gran Canaria | 9 almacenes con reparto online, medidos uno a uno. **31 de 118 SKU no existen en la isla**; de los demás, 113 de 118 dan lo mismo en los 9 almacenes |
| Recetas en Gran Canaria | **49 de 152** con lo verificado; **122** si apruebas 24 alternativas propuestas |
| App | Zona por código postal, catálogo por zona, instantáneas por zona, el plan no se reutiliza al cambiar de zona, una actualización no cambia una compra en silencio, sin conexión sigue con su zona |
| Tests | 422 en verde (eran 392). `tsc` limpio. Build de producción correcta |
| Bloqueado | Supabase sigue sin resolver en DNS (comprobado hoy contra 1.1.1.1): no se puede publicar ninguna instantánea, ni la de Madrid ni la de Gran Canaria |

**Recomendación para tu compra de prueba en Gran Canaria:** sí, como prueba
controlada y no como beta pública de Canarias, después de dos cosas tuyas:
revisar las 24 alternativas (sin ellas el menú repite mucho) y decirme tu
código postal. Detalle al final.

---

## 1. Auditoría del catálogo

### Método

`catalogo/auditar-catalogo.ts <almacén>` pide la ficha de cada SKU que usa la
app —recetas, postres y despensa— a `GET /api/products/{sku}/?wh=<almacén>`,
una petición cada 300-500 ms, con `User-Agent` identificable, y para en seco
ante un 403 o 429 (no pasó ninguno en unas 2.000 consultas). Para cada SKU contrasta:

- nombre, precio, contenido, unidad, unidades por pack, peso variable, envase;
- que las unidades de las recetas se puedan pasar al envase;
- peso escurrido frente a lo que la app cuenta como aprovechable;
- alérgenos y trazas de la etiqueta frente al vocabulario;
- qué respalda que el producto **es** el ingrediente: la lista legal de
  ingredientes (`etiqueta`), solo la categoría, solo el nombre, o nada;
- duplicados y SKU sin uso.

Estados: `comprobado` solo si todo cuadra **y** lo respalda la etiqueta;
`discrepancia` si algo no cuadra; `pendiente` si falta información para
afirmarlo. Lo que solo coincide por nombre queda pendiente, nunca comprobado.

**Una descarga fallida no es un producto retirado.** El cliente común
(`catalogo/mercadona-api.ts`) distingue `ok`, `no-existe` (solo un 404) y
`fallo` (red, 5xx, cuerpo que no es JSON); un fallo queda pendiente con su
motivo. En toda la jornada no hubo ningún fallo.

Cada fila guarda su procedencia: URL, momento de la consulta y código HTTP. Lo
derivado va a `catalogo/auditoria/<almacén>-<fecha>.json`; la respuesta cruda,
a `catalogo/capturas-crudas/`, que no entra en git. No se publica nada de Mercadona.

### Resultado en Madrid (`mad3`)

| | antes | después |
|---|---|---|
| comprobado | 57 | **75** |
| discrepancia | 23 | **0** |
| pendiente | 38 | 43 |

Pendientes no es «mal»: es «sin prueba suficiente». Suben porque el auditor
ahora mira el escurrido en cualquier producto y no solo en una lista de nombres.

| por qué está pendiente | cuántos | cuáles |
|---|---|---|
| solo la categoría respalda el ingrediente | 29 | aceite_oliva, atun_lata, bacon, bebida_arroz, bebida_soja, calabacin, caldo_pollo, caldo_verduras, carne_picada_vacuno, cebolla, chorizo, colorante_alimentario, contramuslo_pollo, fideo, hummus, macarron, mostaza, muslo_pollo, pan, patata, pollo_troceado, queso_fresco, repollo, sardina_fresca, yogur_natural, postre_yogur_natural, postre_gelatina, postre_platano, postre_natillas |
| solo el nombre | 10 | brocoli, calabaza, coliflor, curry, lomo_merluza, mejillon_congelado, panceta, romero, tofu, edamame_congelado |
| ni etiqueta, ni categoría, ni nombre | 3 | espagueti («Spaghetti fino»), salchicha_fresca («Longaniza fresca estilo criollo»), cuscus («Cous cous mediano») — los tres son lo que dicen ser; falta que lo confirme una persona |
| la ficha no trae ni ingredientes ni alérgenos | 5 | contramuslo_pollo, muslo_pollo, pollo_troceado, repollo, sardina_fresca. **Sus alérgenos no se pueden contrastar con la etiqueta** |
| la receta cuenta piezas y se vende a peso | 1 | limon |

Avisos que no bloquean: 5 SKU sin ninguna receta que los use (arroz_integral,
bacon, bebida_arroz, carne_picada_mixta, panceta); `yogur_natural` y
`postre_yogur_natural` comparten SKU a propósito; el vocabulario declara más de
lo que dice la etiqueta en cacahuete, costilla_cerdo, panceta y natillas (huevo),
que es el lado seguro.

### Lo que se ha corregido

**1 · Conservas por su peso escurrido.** 15 de las 17 recetas con garbanzos
dicen «los garbanzos escurridos». El tarro pone 570 g netos y 400 g
escurridos, y la app lo contaba por los 570, así que para 480 g de garbanzo
compraba un tarro y en casa salían 400. Mercadona calcula su precio por kilo
sobre el escurrido (0,80 € / 0,4 kg = 2,00 €/kg).
Ahora cada envase rinde su escurrido, y el precio por kilo de la app coincide
con el precio de referencia de la etiqueta en los 16 casos. El formato que ves
en la lista sigue siendo el de la etiqueta («Tarro 570 g»).

- Afecta a: garbanzo, alubia blanca, pinta y roja, lenteja cocida, champiñón,
  aceituna, atún, caballa, mejillón, acelga, judía verde, guisante, alcachofa,
  queso fresco y tofu.
- Supuesto, dicho: la cantidad de la receta es peso escurrido. Lo dicen los
  pasos, no un campo de datos.
- Ficheros: `catalogo/escurridos.ts` → `catalogo/peso-escurrido.json` →
  `generar.ts`. Nuevo campo `Sku.contenido_etiqueta`.

**2 · El peso de hoy de cada pieza.** La fruta y la verdura a granel se venden
por pieza, a precio fijo y con un peso aproximado que cambia con la temporada.
El calabacín pesaba 410 g en julio y 370 g ahora, al mismo 0,70 €; el pepino,
250 → 200 g; el tomate, 140 → 120 g; el limón, 230 → 150 g. Como las recetas
piden gramos, la app compraba piezas de menos. Afecta a 9 piezas.
Ficheros: `catalogo/piezas.ts` → `catalogo/peso-pieza.json`, que aplican
`generar.ts` y `postres.js`.

**3 · Alérgenos.**

- Las etiquetas de 15 SKU nunca llegaron a `alergenos-por-ean.json`.
  `enriquecer.js` pide la ficha sin almacén, y lo que solo está en Madrid
  vuelve vacío. Se recuperan de la auditoría, sin volver a la red
  (`catalogo/etiquetas-desde-auditoria.ts`).
- `propagar-alergenos.ts` añadió:
  - gamba: **+ sulfitos** y trazas de pescado;
  - dorada: trazas de marisco;
  - lubina: trazas de marisco.

  Con «sin sulfitos» o «sin marisco» puesto, la app podía servir esos platos.

**4 · Postres.** Sus alérgenos se comparan con el nombre del filtro
(«Lactosa») y no con el alérgeno en minúscula, y `postres.ts` no mira trazas.
Hoy funciona: ninguna etiqueta de postre declara trazas. Un test nuevo se pone
rojo si un postre declara algo que no es un filtro, o trae trazas.

**Efecto en la semana de ejemplo** (2 personas, 65 €, de lunes a domingo):
54,32 € → **54,23 €**. Con el escurrido subía a 55,04 €; con el peso de las
piezas cambia la selección y baja. La cifra está fijada en `noCocino.test.ts`,
con el porqué.

---

## 2. Gran Canaria

### Qué almacén sirve cada código postal

Se preguntó a Mercadona por cada código postal de la isla
(`PUT /api/postal-codes/actions/change-pc/`, cabecera `x-customer-wh`). El
resultado está en `catalogo/zonas/gran-canaria-cp.json`. Para las pruebas se usa
**35001 (Las Palmas, almacén 4701) como código de PRUEBA**. No lo he tomado como
tu zona: no sé tu código postal.

| almacén | zona |
|---|---|
| 4701 | Las Palmas 35001-35004, 35011, 35014 |
| 3120 | Las Palmas 35005-35009 |
| 3544 | Las Palmas 35010, 35012, 35013, 35019 |
| 3864 | Las Palmas 35015, 35016 |
| 4745 | Las Palmas 35017-35018, Telde 35200/35210/35213, Santa Brígida |
| 4418 | Telde 35211/12/14/15/19, Valsequillo, Ingenio, Agüimes 35118/35260 |
| 4570 | Agüimes 35119, Santa Lucía 35110, San Bartolomé 35100/06/07 |
| 4377 | Mogán |
| 4677 | Arucas, Firgas, Moya, Guía, Gáldar, Agaete |

**Sin almacén** (Mercadona no reparte online): 35111, 35280, 35290 (sur), 35470
(La Aldea), 35418, 35457, 35468, 35489 (norte), Teror, Valleseco, San Mateo,
Tejeda, Artenara.
Controles: Lanzarote 35500 → 4256 y Fuerteventura 35600 → 3885, que son otras
zonas.

**Un almacén no representa la isla, así que se midieron los nueve.** Los 118
SKU, en cada uno (`catalogo/comparar-zona.ts`). Hay 113 idénticos en los nueve.
Las 5 diferencias:

- **Apio, brócoli y puerro en 4745:** otro peso aproximado de pieza, pero el
  mismo precio por kilo (por ejemplo, 2,15 €/0,66 kg y 1,82 €/0,56 kg dan
  3,26 y 3,25 €/kg).
- **Caldo de verduras Gallina Blanca:** solo existe en 4701 y 4570.
- **Barra de pan:** solo existe en 4701.

Por eso hay **un catálogo de Gran Canaria para los 9 almacenes** que solo lleva
lo que existe en todos. Vale para esos 9 y en esa fecha. Un código de la isla
sin almacén queda **sin cobertura**: la tienda física no está medida.

### Madrid frente a Gran Canaria (`mad3` frente a `4701`, mismo día)

| | |
|---|---|
| No existen en la isla | **31**: aceituna verde, acelga, alcachofa, bacon, berenjena, calabacín, calabaza, calamar, carne picada de cerdo y mixta, chuleta de cordero, costilla, entrecot, espinaca, filete y taco de vacuno, gamba, garbanzo seco, lomo de cerdo, lomo de merluza, muslo de pollo, pepino, pimiento verde, repollo, salchicha fresca, sardina fresca, solomillo, yogur natural (y su postre), habas, natillas |
| Existen | 87 |
| Mismo formato | 80: 32 al mismo precio, 29 más baratos y 19 más caros en Gran Canaria. Esos 80 suman 151,55 € en Madrid y 152,98 € en Gran Canaria (+0,9 %) |
| Otro formato | 7 piezas: apio, brócoli, limón, puerro, tomate, plátano, manzana |
| Las mayores diferencias | lechuga +37 %, zanahoria +30 %, panceta +26 %, contramuslo +25 %, pechuga +14 %, huevos +11 %; romero −37 %, vinagre de manzana −22 %, jamoncitos −17 %, alubia pinta −16 % |

### Qué recetas dejan de poder hacerse

Con lo verificado, **49 de 152** (30 veganas, 35 sin gluten). Lo que más recetas
tumba, contando solo las que caen por una sola cosa:

- pimiento verde: 16;
- calabacín: 7;
- espinaca: 7;
- caldo de verduras: 6;
- aceituna: 5.

Si apruebas las 24 alternativas propuestas: **122 de 152**. Las 30 que siguen
fuera son por el caldo de verduras (14), la acelga (4), la sardina fresca (4),
las habas (3), el calamar (2), la gamba (2), el taco de vacuno (1) y el yogur
natural (1).

---

## 3. El modelo de varias zonas

- **Identidad, una sola vez:** recetas, vocabulario de ingredientes y alérgenos
  viven en `src/data/motor-datos.json`. Las recetas no se duplican.
- **Lo que cambia por zona** vive en `src/data/zonas/<zona>.json`:
  - un SKU por ingrediente canónico, con su precio, formato y escurrido, o
    `null` si no hay uno verificado;
  - su `estado` (`mismo-sku`, `alternativa`, `alternativa sin revisar`,
    `rechazada`, `ninguno`) y el motivo;
  - la `version` (la fecha de la medición), las fechas de consulta, los
    almacenes y la tabla de códigos postales.
- **Historial:** las auditorías fechadas en `catalogo/auditoria/`; en la base de
  datos, la tabla `precio` con `capturado_en` en la clave, como siempre.
- **Cuando falta un producto:**
  - solo entra una alternativa propuesta en
    `catalogo/zonas/gran-canaria-alternativas.json`, **aprobada por una
    persona** (`revisado: true`) y sin discrepancias en la auditoría de los
    nueve almacenes (existe, mismo precio y formato, alérgenos dentro del
    vocabulario);
  - si no, se quitan las recetas que lo necesitan, y `recetasFuera` dice cuáles
    y por qué;
  - si con lo que queda no sale semana, la app ya da la salida (la de siempre,
    no un muro).
- **Nunca se rellena con Madrid.** Un canónico que la zona no trae cuenta como
  sin producto (`src/motor/zona.ts`, con test).

Por qué la máquina propone y una persona aprueba: la búsqueda automática
propuso «filetes de hígado» para el entrecot, «caldo de pollo» para el caldo de
verduras (que es servir pollo a un vegetariano) y «ensaladilla» para las habas.
La comprobación por categoría las habría dejado pasar. El yogur Danone pasaba
todos los filtros salvo uno: su etiqueta dice «puede contener gluten», y se
rechaza solo.

`catalogo/construir-zona.ts` tiene tres pasos: `proponer` (sin red), la
auditoría en los nueve almacenes (con red, la lanza una persona) y `cerrar`
(sin red).

---

## 4. Implementación en la app

**Recorrido completo:**

1. **Código postal → zona** (`src/lib/zona.ts`), en el teléfono y sin red. La
   app nunca pregunta a Mercadona. Hay tres coberturas:
   - `medida`: Madrid 28xxx o un código de los 9 almacenes de Gran Canaria;
   - `referencia`: el resto de España, con precios de Madrid y así se dice;
   - `sin-cobertura`: el resto de Canarias, con Madrid como ejemplo y «allí no
     te sirven para comprar».
2. **Zona → catálogo:** `data/motor.ts` lee el código postal guardado al
   arrancar y carga `datosDeZona(...)`. Si al seguir del paso 1/3 el código cae
   en otra zona, la app **recarga**: varias cifras se calculan una vez con el
   catálogo (el suelo de presupuesto, el recetario), y cambiarlo en caliente
   las dejaría de una zona junto a productos de otra.
3. **Generación y compra:** el mismo motor sobre los datos de la zona. El plan
   anota `zonaDelPlan`. Si al arrancar la zona es otra, **el plan no se
   reutiliza**: se monta uno nuevo y se conservan perfil, preferencias,
   historial y despensa.
4. **Actualización de precios:**
   - cada instantánea lleva `zona`; las de antes, sin campo, son de Madrid;
   - se guardan con una clave por zona;
   - **una de otra zona se rechaza entera**;
   - del mismo producto solo se toma el precio, porque lo que rinde el envase
     es del APK;
   - si cambia el neto del envase, esa línea se rechaza (es otro formato, no
     otro precio);
   - `VITE_PRECIOS_URL` admite `{zona}`; sin él, solo Madrid pide precios;
   - `publicar-precios.js --zona gran-canaria` empaqueta la de Gran Canaria
     (probado en local: 85 SKU, 22 KB).

**Cuándo se aplica una actualización:**

- se descarga en segundo plano y se aplica al abrir la app, nunca en caliente
  (como antes);
- si la compra está **empezada** (algo marcado), la lista no se toca y Compra
  dice, por ejemplo: «Hay precios del 15 oct. No te cambio la lista a mitad de compra.»;
- si no, se revalora y Compra dice, por ejemplo: «Precios del 15 oct: tu lista pasa de
  54,23 € a 55,10 €.»

**Sin conexión.** El catálogo de cada zona va dentro del APK, así que sin red
se usa siempre el de la zona elegida.

- **Catálogo viejo:** a los 7 días la cabecera dice «Precios de Mercadona Gran
  Canaria de hace N días».
- **Zona sin cobertura:** se dice en Semana y en Compra, cada vez.

Son dos mensajes distintos para dos situaciones distintas.

**Probado en el navegador** con la build de producción: 35001 → «almacén
4701», 28001 → Madrid y 38001 → sin cobertura. En las tres, la zona y la fecha
salen en Compra, y sin red la lista, la zona y la fecha se mantienen. Los 37
productos de la lista de Gran Canaria son de su catálogo.

Tests nuevos:

- `src/motor/zona.test.ts`: ningún producto de Madrid se cuela y las recetas
  se filtran, no se copian.
- `src/lib/zona.test.ts`: códigos postales.
- `src/lib/precios.test.ts`: zona, clave por zona y escurrido.
- `src/state/zona.test.ts`: cambio de zona, compra empezada, compra sin
  empezar, precios de Madrid sobre una lista de Gran Canaria.
- `postres.test.ts`: alérgenos de postre.

---

## 5. Revisión final de la app

Textos que prometían lo que no hay, corregidos:

| dónde | decía | dice |
|---|---|---|
| Portada | «Con los precios de tu súper, los de hoy.» | «Con precios reales de Mercadona, producto a producto.» |
| Cierre de la compra | «Afino los precios de tu tienda y te llevo la cuenta semana a semana.» | «Con esto te digo cuánto te sobró de verdad.» |
| Cadena sin catálogo | «…Empieza con Mercadona y te aviso cuando esté.» | «…Empieza con Mercadona.» |
| Paso 1/3 | «Hoy los precios son los de Madrid. Con tu código sé qué zona cargar después.» | La zona real según el código, o que no la hay |

**Lo que se ha comprobado:**

- «No cocino» y «Cocino» siguen con su barrido de tests;
- cantidades, envases, postres y total de Compra salen del motor sobre los
  datos corregidos;
- la zona y la fecha se ven en Compra, y en Semana cuando la zona no está
  medida;
- persistencia, sin conexión y cambio de semana: los tests de estado siguen en
  verde, más los nuevos de zona.

**Observado y no tocado:** en el navegador de escritorio sin service worker
activo, navegar sin red da un error de consola al pedir un trozo de Ionic. En el
APK los ficheros van dentro y no aplica, pero conviene confirmarlo en el
teléfono.

---

## 6. La misma semana en cada zona

2 personas, 65 €, variedad normal, de lunes a domingo, sin filtros
(`catalogo/_aud-zonas.ts`, salida en `catalogo/zonas/ejemplo-2p-65.json`). La
tercera tabla **no la ve nadie**: supone que apruebas las alternativas, para
medir qué cambia.

### Madrid (mad3) · 54,23 € · recetas 152
| Día | Comida | Cena |
|---|---|---|
| LUN | Lentejas con calabaza | Ensalada de garbanzos con caballa |
| MAR | Espaguetis con soja | Jamoncitos al ajillo |
| MIÉ | Lentejas con calabaza (sobras) | Tofu a la mostaza |
| JUE | Espaguetis con soja (sobras) | Cuscús con alubias y maíz |
| VIE | Merluza en salsa verde | Tofu a la mostaza (ensamblaje) |
| SÁB | Cuscús con alubias y maíz (sobras) | Pollo al limón |
| DOM | Sardinas al horno | Jamoncitos al ajillo |

| SKU | Producto | Envases | Importe |
|---|---|---|---|
| 51097 | Tofu firme Hacendado | 3 | 5,25 € |
| 16618 | Champiñones laminados Hacendado | 5 | 5,00 € |
| 62113 | Lomos y centros de merluza del Cabo Hacendado ultracongelados | 1 | 4,90 € |
| 3400 | Filetes pechuga de pollo corte fino | 1 | 4,10 € |
| 25183 | Jamoncitos de pollo congelados | 1 | 3,50 € |
| 69079 | Cebollas | 1 | 3,00 € |
| 13632 | Filetes de caballa del sur en tomate Hacendado | 1 | 2,85 € |
| 13926 | Soja texturizada Luengo | 1 | 2,70 € |
| 87916 | Sardina sin limpiar | 1 | 2,40 € |
| 26019 | Alubia cocida blanca Hacendado | 3 | 2,25 € |
| 69853 | Media calabaza cacahuete | 1 | 2,10 € |
| 9395 | Cous cous mediano Hacendado | 1 | 1,95 € |
| 69297 | Ajos morados | 1 | 1,85 € |
| 5330 | Lenteja pardina Hacendado | 1 | 1,85 € |
| 18480 | Caldo de verduras casero Gallina blanca | 1 | 1,80 € |
| 61289 | Maíz dulce Hacendado ultracongelado | 1 | 1,24 € |
| 35221 | Pimiento rojo y verde Hacendado ultracongelado | 1 | 1,20 € |
| 69580 | Brócoli | 1 | 1,10 € |
| 69586 | Zanahorias | 1 | 1,00 € |
| 61279 | Espinaca en porciones Hacendado ultracongelada | 1 | 0,90 € |
| 6277 | Spaghetti fino Hacendado | 1 | 0,80 € |
| 26029 | Garbanzo cocido Hacendado | 1 | 0,80 € |
| 16044 | Tomate triturado Hacendado | 1 | 0,55 € |
| 69912 | Tomate pera | 2 | 0,52 € |
| 3210 | Limón | 1 | 0,39 € |
| 69320 | Pimiento verde freír | 1 | 0,23 € |

### Gran Canaria · catálogo de la app · 53,59 € · recetas 49
| Día | Comida | Cena |
|---|---|---|
| LUN | Macarrones a la boloñesa | Garbanzos gratinados |
| MAR | Jamoncitos al ajillo | Cuscús con alubias y maíz |
| MIÉ | Macarrones a la boloñesa (ensamblaje) | Cuscús con alubia roja |
| JUE | Jamoncitos al ajillo (ensamblaje) | Tofu al limón |
| VIE | Lentejas con huevo | Cuscús con alubia roja (sobras) |
| SÁB | Tofu al limón (ensamblaje) | Revuelto de champiñones |
| DOM | Pasta con atún | Jamoncitos al ajillo |

| SKU | Producto | Envases | Importe |
|---|---|---|---|
| 30167 | Huevos | 1 | 5,85 € |
| 25183 | Jamoncitos de pollo congelados | 2 | 5,80 € |
| 51097 | Tofu firme Hacendado | 3 | 5,25 € |
| 16618 | Champiñones laminados Hacendado | 5 | 5,00 € |
| 69079 | Cebollas | 1 | 3,20 € |
| 13926 | Soja texturizada Luengo | 1 | 2,40 € |
| 26000 | Alubia cocida roja Hacendado | 2 | 2,30 € |
| 26029 | Garbanzo cocido Hacendado | 3 | 2,25 € |
| 18037 | Atún en salsa de tomate Hacendado | 1 | 2,00 € |
| 69297 | Ajos morados | 1 | 1,85 € |
| 9395 | Cous cous mediano Hacendado | 1 | 1,80 € |
| 16044 | Tomate triturado Hacendado | 3 | 1,65 € |
| 34031 | Cacahuete tostado Hacendado 0% sal añadida | 1 | 1,55 € |
| 3210 | Limón | 3 | 1,44 € |
| 26011 | Lenteja cocida Hacendado | 2 | 1,40 € |
| 69586 | Zanahorias | 1 | 1,30 € |
| 35221 | Pimiento rojo y verde Hacendado ultracongelado | 1 | 1,25 € |
| 61289 | Maíz dulce Hacendado ultracongelado | 1 | 1,15 € |
| 16315 | Judías verdes redondas Hacendado | 1 | 1,10 € |
| 23621 | Queso rallado especial fundir mezcla Hacendado | 1 | 1,10 € |
| 13577 | Fideo cabello de ángel Hacendado | 1 | 0,80 € |
| 6277 | Spaghetti fino Hacendado | 1 | 0,80 € |
| 6260 | Macarrón fino Hacendado | 1 | 0,80 € |
| 26019 | Alubia cocida blanca Hacendado | 1 | 0,80 € |
| 7313 | Caldo de pollo Hacendado | 1 | 0,75 € |

### Gran Canaria · SUPONIENDO revisadas las alternativas · 51,06 € · recetas 122
| Día | Comida | Cena |
|---|---|---|
| LUN | Lentejas al curry | Garbanzos con soja |
| MAR | Alubias al pimentón | Jamoncitos al ajillo |
| MIÉ | Lentejas al curry (sobras) | Tofu a la mostaza |
| JUE | Alubias al pimentón (ensamblaje) | Macarrones con pollo |
| VIE | Pasta con atún | Tofu a la mostaza (ensamblaje) |
| SÁB | Macarrones con pollo (sobras) | Ensalada templada de edamame y maíz |
| DOM | Revuelto de champiñones | Jamoncitos al ajillo |

| SKU | Producto | Envases | Importe |
|---|---|---|---|
| 30167 | Huevos | 1 | 5,85 € |
| 51097 | Tofu firme Hacendado | 3 | 5,25 € |
| 2789 | Contramuslos de pollo deshuesados y sin piel | 1 | 4,68 € |
| 16618 | Champiñones laminados Hacendado | 4 | 4,00 € |
| 69079 | Cebollas | 1 | 3,20 € |
| 26019 | Alubia cocida blanca Hacendado | 4 | 3,20 € |
| 25183 | Jamoncitos de pollo congelados | 1 | 2,90 € |
| 13986 | Espinacas en porciones Hacendado ultracongeladas | 2 | 2,50 € |
| 69580 | Brócoli | 1 | 2,44 € |
| 13926 | Soja texturizada Luengo | 1 | 2,40 € |
| 18037 | Atún en salsa de tomate Hacendado | 1 | 2,00 € |
| 69297 | Ajos morados | 1 | 1,85 € |
| 5330 | Lenteja pardina Hacendado | 1 | 1,80 € |
| 70740 | Edamame soja verde Hacendado ultracongelada | 1 | 1,67 € |
| 35221 | Pimiento rojo y verde Hacendado ultracongelado | 1 | 1,25 € |
| 61289 | Maíz dulce Hacendado ultracongelado | 1 | 1,15 € |
| 17151 | Tomate frito Hacendado | 1 | 0,90 € |
| 6277 | Spaghetti fino Hacendado | 1 | 0,80 € |
| 6260 | Macarrón fino Hacendado | 1 | 0,80 € |
| 26029 | Garbanzo cocido Hacendado | 1 | 0,75 € |
| 68379 | Pimiento verde | 1 | 0,64 € |
| 16044 | Tomate triturado Hacendado | 1 | 0,55 € |
| 3210 | Limón | 1 | 0,48 € |

---

## 7. Lo que necesito de ti

| | qué | por qué |
|---|---|---|
| 1 | **Revisa las 24 alternativas** de `catalogo/zonas/gran-canaria-alternativas.json` y pon `revisado: true` en las que te valgan. Las dudosas: chuleta de cordero (congelada en vez de fresca), muslo de pollo (contramuslo sin piel en vez de muslo con piel), calabacín blanco, longaniza «de pueblo». Luego: `construir-zona.ts cerrar gran-canaria 2026-10-14` | Sin ellas, 49 recetas y una semana que repite (jamoncitos tres veces). Con ellas, 122 |
| 2 | **Dime tu código postal** | Si es de 4701 (Las Palmas centro) o 4570 (sur), allí sí hay caldo de verduras y, en 4701, pan: son 14 recetas más. Hoy no se usan porque no están en los nueve almacenes. Para usarlos haría falta una capa por almacén, que no he montado sin saber si te afecta |
| 3 | **Supabase**: restaurar el proyecto (sigue en NXDOMAIN hoy) | Sin él no se publica ninguna instantánea. La de Gran Canaria necesita además una URL por zona (`VITE_PRECIOS_URL` con `{zona}`) y que el cron mida los 9 almacenes. No he tocado nada de infraestructura |
| 4 | **Guarda el ticket** de la compra de prueba | Los precios medidos son los de la **tienda online**. Que la tienda física cobre lo mismo es un supuesto que nadie ha comprobado: tu ticket es la primera prueba |
| 5 | Rotar la contraseña de Postgres y la clave de OpenAI | Sigue pendiente desde el 13 oct |
| 6 | Revisión humana de los 43 pendientes de Madrid, sobre todo los 5 sin etiqueta (pollo, repollo, sardina) | Sus alérgenos no se pueden contrastar con una etiqueta: el vocabulario los declara a mano |
| 7 | Nota legal | Hoy ha habido unas 2.000 consultas a la API de Mercadona en 10 almacenes, a ritmo educado y sin ningún 403 o 429. Medir 9 almacenes cada día multiplica el acceso automatizado que su `robots.txt` pide no hacer. Es una razón más para consultar al abogado antes de abrir Canarias |

## 8. ¿Está listo el catálogo canario para una compra de prueba?

**Para una compra de prueba tuya, sí, con condiciones. Para usuarios de
Canarias, todavía no.**

A favor:

- cada producto que la app te mande comprar existe en los 9 almacenes, con el
  mismo precio y formato, medido hoy;
- ninguno es de Madrid;
- los alérgenos de esos productos están contrastados o declarados a mano del
  lado seguro;
- la semana cuadra con 65 € para 2.

En contra, y por eso la prueba no es de beta pública:

- con lo verificado hoy hay **49 recetas**, y la semana repite;
- los precios son de la **tienda online** y de **hoy**. No hay actualización
  automática para la isla hasta que vuelva Supabase y el cron mida los 9
  almacenes. Pasados 7 días, la app lo dice;
- las 24 alternativas las he propuesto yo; hasta que las revises no se usan.

**Cómo haría la prueba:**

1. Revisa las alternativas.
2. Pon tu código postal en la app.
3. Genera la semana y compra con la lista en la mano.
4. Compara cada línea con el ticket.

Lo que salga distinto entre el ticket y la lista es exactamente lo que falta
por medir: precio de tienda física frente a online, y pesos de pieza.
