# Gran Canaria · pescado, equivalencias y presupuesto con el catálogo ampliado · 15 oct 2026

> Experimento `diversidad` apagado: la app no lo pasa y aquí no se usa. Sin
> despliegue ni push a `main`.

## 1 · Dorada y lubina: lo que pide la receta y lo que se vende

| | dorada | lubina |
|---|---|---|
| Producto (3120) | «Dorada limpia», bandeja, 5,40 € | «Lubina limpia», bandeja, 5,04 € |
| Formato según la API | `unit_size` 0,4 kg con `approx_size: true`, se vende por bandeja a precio fijo; 13,50 €/kg de referencia | igual; 12,60 €/kg |
| Piezas por bandeja | **la API no lo dice** (`total_units` vacío, la descripción solo repite el nombre) | igual |
| «Limpia» | evisceradas y escamadas, **con cabeza y espina** | igual |
| La receta pide | 230 g por persona, **peso de compra** | 230 g por persona, peso de compra |
| Parte comestible (`rendimiento_comestible`) | 0,55, es decir 126 g por persona | 0,55, 126 g |
| Dónde se aplica el 0,55 | solo a la proteína; el carrito compra peso entero | igual |

Lo que hace el motor con 2 personas:

- necesita 460 g;
- compra 2 bandejas, unos 800 g;
- da por sobrantes 340 g;
- como dura 2 días, los cuenta enteros como perecedero: **4,7 € a la basura**.

**Ese sobrante no está demostrado.** Es un efecto del modelo, no una medida:

- **La receta no pide piezas.** Pide 230 g por persona de un producto que se
  vende en piezas de unos 400 g. Nadie cocina media dorada y guarda la otra
  media.
- **Con 1 pieza por bandeja:** 2 bandejas son 1 dorada por persona, unos 220 g
  comestibles cada una. Eso es una ración normal. Lo que el motor cuenta como
  basura se come.
- **Con 2 piezas pequeñas por bandeja:** 1 bandeja, unos 400 g, se queda corta
  para los 460 g pedidos, y 2 bandejas sobran de verdad.
- **No sé cuál de los dos casos es**: la API no lo dice. Hace falta ver una
  bandeja de 3120, o la foto del producto.

**Lo que cambiaría el resultado:** expresar estas dos recetas en piezas (1 por
persona) en vez de en gramos. Es cambiar la cantidad por ración, de 126 g
comestibles a unos 220 g, y no lo he hecho: es tu decisión. Hasta entonces, el
motor seguirá penalizando la dorada y la lubina por un desperdicio que quizá no
existe.

## 2 · La sardina de Gran Canaria es congelada, no fresca

- **Madrid:** sardina **fresca** sin limpiar (87916, bandeja ~0,4 kg, 2,40 €).
- **Gran Canaria:** no existe. La alternativa propuesta es **«Sardina pequeña
  Hacendado congelada»** (24442): 500 g netos sin glaseado, entera, 3,95 €.
  Hay que descongelarla la víspera.
- **Por qué los informes se contradecían:** el ingrediente se llama
  `sardina_fresca` en los dos catálogos. Mi informe anterior la llamó «sardina
  fresca» en la tabla de equivalencias; era el nombre del ingrediente, no el
  producto.
- **Las cuentas del motor sí la trataban como congelada:** 0,03 € de perecedero
  por 0,20 kg sobrantes.

## 3 · Equivalencias habilitadas: el mismo producto, 9

Son las del grupo `mismo-producto` con formato, cantidades, ingredientes y
alérgenos validados. **No cambian el plato**, así que no piden decisión
culinaria. Entran solas desde hoy (`catalogo/construir-zona.ts`), salvo que
pongas `false` en `catalogo/zonas/gran-canaria-aceptacion.json`.

| ingrediente | en Gran Canaria (3120) | diferencia con Madrid |
|---|---|---|
| aceituna verde | 52783 Aceitunas verdes Hacendado con hueso | mismas, tarro mayor (935 g, 530 g escurridos) |
| alcachofa | 16040 Corazones de alcachofa Hacendado | mismos, tarro pequeño (290 g) |
| carne picada cerdo | 5241 Preparado de carne picada cerdo | mismo producto, otra referencia |
| carne picada mixta | 5077 Preparado de carne picada vacuno y cerdo | mismo producto, otra referencia |
| espinaca | 13986 Espinacas en porciones Hacendado ultracongeladas | misma línea, 500 g en vez de 450 g |
| lomo de cerdo | 4119 Filetes lomo de cerdo extra tiernos | mismo nombre, otra referencia |
| lomo de merluza | 62212 Lomos de merluza del Cabo Hacendado ultracongelados | «lomos» en vez de «lomos y centros», 400 g |
| pan | 83264.1 Barra de pan | mismo nombre, 250 g, 0,50 € |
| natillas (postre) | 68235 Natillas sabor vainilla Hacendado | mismo nombre, otra referencia |

**Efecto:**

- El recetario de 3120 pasa de **37 a 55 recetas** y de 2 a **5 de pescado**:
  merluza al horno, ensalada campera con caballa, lubina con tomate y
  aceitunas, dorada, lubina.
- La semana de referencia de 35007 (2 personas, 65 €, variedad normal) baja de
  57,04 € a **55,73 €**. El test que la vigila está actualizado.
- `docs/verificacion-35007-2026-10-14.md` describe el catálogo anterior.

## 4 · Las 16 propuestas, en una tabla

Las 9 de arriba ya están dentro. **Decides sobre las 7 sustituciones.**

- **«Recetas»** son las que desbloquea esa sola, con el catálogo de hoy (55).
  Las 9 ya habilitadas cuentan sobre el de antes (37).
- **0 recetas** quiere decir que las recetas que la usan necesitan además otro
  ingrediente que falta, sobre todo el pimiento verde.

| ingrediente | propuesta en 3120 | Madrid | diferencia | validación pendiente | recetas | estado |
|---|---|---|---|---|---:|---|
| sardina | 24442 Sardina pequeña Hacendado **congelada**, 500 g | fresca sin limpiar | congelada y pequeña: descongelar la víspera, 2 min menos por lado | ninguna técnica; traza de moluscos añadida en la zona (filtro Marisco) | **4** | **decides tú** |
| garbanzo seco | Garbanzo seco Hacendado, 1 kg | pedrosillano | sin variedad declarada | ninguna | 2 | **decides tú** |
| salchicha fresca | Longaniza fresca de pueblo, ~436 g | longaniza estilo criollo | otro estilo de longaniza | ninguna | 1 | **decides tú** |
| bacon | Bacón Hacendado en cintas, 260 g | Monells sin corteza en taco, 310 g | cintas en vez de taco, otra marca | ninguna | 0 | **decides tú** |
| gamba congelada | Gamba pelada cruda Hacendado, 360 g netos (7 % de agua) | gamba arrocera pequeña Hacendado congelada, 550 g | otra gamba; no está comprobado si la de Madrid viene pelada | ninguna; la etiqueta declara sulfitos y trazas de moluscos y pescado | 0 | **decides tú** |
| yogur natural | Danone natural, 4 × 125 g | Hacendado 6 × 125 g | marca; no hay natural Hacendado | ninguna; trazas de gluten y frutos de cáscara añadidas en la zona | 0 | **decides tú** |
| yogur natural (postre) | el mismo Danone | Hacendado | igual que el anterior | igual | 0 | **decides tú** |
| espinaca | ver §3 | | | | 7 | habilitada |
| aceituna verde | ver §3 | | | | 5 | habilitada |
| alcachofa | ver §3 | | | | 2 | habilitada |
| lomo de cerdo | ver §3 | | | | 2 | habilitada |
| lomo de merluza | ver §3 | | | | 1 | habilitada |
| carne picada cerdo | ver §3 | | | | 1 | habilitada |
| carne picada mixta | ver §3 | | | | 0 | habilitada |
| pan | ver §3 | | | | 0 | habilitada |
| natillas (postre) | ver §3 | | | | 0 | habilitada |

Las 7 juntas llevarían el recetario de 55 a **62**.

Fuera de la tabla quedan **14 alternativas que no están validadas** y necesitan
una foto en la tienda. Las que más desbloquean:

- **pimiento verde: 14 recetas**;
- berenjena, calabacín y calabaza: 4 cada una;
- calamar: 1.

## 5 · El caso controlado con el catálogo ampliado

**Caso:** 35007, 2 personas, comidas y cenas, semana desde el lunes 19 oct,
sin despensa, sin filtros, proteína normal, sin postre, variedad alta.
**Motor de producción.** `catalogo/_aud-diversidad.ts produccion`.

| tope | caja | consumo | perecedero | tipos de plato (máx.) | fuentes | trío | proteína | pescado |
|---:|---:|---:|---:|---|---:|---:|---:|---:|
| 60 € | 52,59 € | 30,32 € | 4,82 € | 6 (4: huevo) | 11 | 8 | 55,7 g | 1 (merluza) |
| 80 € | 58,13 € | 31,94 € | 6,84 € | 6 (3) | 11 | 7 | 57,1 g | 1 (merluza) |
| 100 € | 60,47 € | 33,01 € | 6,23 € | 6 (4: legumbre) | 14 | 6 | 57,9 g | 1 (merluza) |

Antes de habilitar las 9 equivalencias, la misma semana daba 51-56 €, 5-6
tipos y ningún pescado.

**¿Subir el presupuesto empeora la variedad?**

- **De 60 a 80 €:** no.
  - El tipo más repetido baja de 4 a 3.
  - El trío baja de 8 a 7.
  - Entra el lomo al horno.
- **De 80 a 100 €:** en parte sí.
  - El tipo más repetido sube de 3 a 4: cuatro platos de legumbre (dos de
    cuscús, garbanzos gratinados, lentejas al curry).
  - Mejoran otras dos medidas: de 11 a 14 fuentes de proteína y trío de 7 a 6.

**La causa, medida** sobre las 8 semillas de cada tope:

1. **El arranque ganador a 80 € no gana a 100 €.** A 80 € gana el que empieza
   por alubias negras con espinacas: 58,13 €, criterio de desperdicio 33,03,
   máximo 3 platos de un tipo. A 100 €, ese mismo arranque construye otra
   semana: 69,38 €, criterio 44,30.
2. **El motivo es la cuota por comida.** Pasa de 5,43 € a 6,79 €. Con más
   cuota, el coste deja de distinguir candidatos dentro del greedy, que toma
   otro camino desde el primer plato. Es la «dependencia del camino» ya
   documentada en `seleccionar.ts`.
3. **A 100 € gana el arranque de macarrones a la boloñesa:** criterio 33,69,
   cuatro de legumbre. Hay semanas con 7 tipos en los dos topes, pero desperdician
   más (37,9 a 44,3) y el criterio final **solo mira el desperdicio**, no la
   variedad.

Es decir: con 100 € existen semanas más variadas que la elegida. No se eligen
porque producción decide por desperdicio y porque el tope mueve el camino del
greedy. No he añadido umbrales ni activado nada para cambiarlo.

## 6 · Archivos

- `catalogo/construir-zona.ts`: el grupo `mismo-producto` validado entra sin
  aceptación culinaria; nuevo estado «mismo producto, otra referencia».
- `src/data/zonas/gran-canaria.json`: regenerado.
- `src/state/zona.test.ts`: la semana de referencia de 35007 pasa a 55,73 € y
  55 recetas.
- `catalogo/_aud-diversidad.ts`: modo `produccion`.
- Consultas a la API: 2 fichas (87300, 87310), con 450 ms entre una y otra.
