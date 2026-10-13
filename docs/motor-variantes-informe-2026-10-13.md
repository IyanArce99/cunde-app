# Presupuesto, despensa y pasada de holgura · comparación de variantes

> 13 de octubre de 2026. Cierra la revisión de `docs/motor-existencias-2026-10-13.md`.
> Las tablas completas y los menús están en `docs/motor-variantes-2026-10-13.md`,
> generado por `catalogo/_aud-variantes.ts`. Nada publicado ni desplegado.

## Decisión tomada (13 oct 2026, tras este informe)

**Se mantiene B y se apaga por defecto la pasada de holgura.** En
`src/motor/seleccionar.ts`, `PASADA_DE_HOLGURA = false`; la pasada se conserva
entera y se enciende con `conHolgura: true` solo para comparaciones internas.
No hay opción de usuario. Al regenerarse el banco de variantes con esta
configuración, la variante «B» pasa a ser la producción y «B-holgura» lo que
antes era «B».

**Contrapartidas, medidas:**
- La semana 1 del caso de arranque (2 personas, 65 €) baja de 62,02 € a
  54,32 € por caja, con 55,7 g de proteína por persona y día en vez de 58,8
  (suelo 55), 6 huecos con carne o pescado en vez de 7 y un trío de 4 en vez
  de 5 (menos repetida). La portada se ha regenerado con esta semana.
- La pantalla enseña más sobrante. Gastarlo es decisión del usuario en el
  selector de variedad, que pone el precio de cada nivel al lado.
- Se cocina algo más: en 2 personas · 65 €, 1184 minutos en 4 semanas frente
  a 1118 (+16 min por semana).
- Latencia: 107 ms por semana frente a 280 en este PC.

**Unidades de las métricas de este documento:**
- **Proteína**: gramos por persona y día, media de la semana. Suma, por
  ración, de `proteina_g_por_100` de cada ingrediente sobre su parte comestible
  (`rendimiento_comestible`), dividida por 7 días y por comensales. Tablas por
  ingrediente; no es una validación nutricional.
- **Trío**: número de tandas (sesiones de cocina) en las que aparecen las tres
  familias de ingrediente con 8 g o más de proteína por 100 g más repetidas de
  la semana, sumadas; cada familia cuenta como mucho una vez por tanda. Con 10
  tandas, un trío de 7 significa que tres fuentes cubren 7 de las 10 ollas.
  Menos es más repartido.
- **Perecedero**: euros a precio de catálogo del sobrante de envase que se da
  por perdido. Cada sobrante se pondera por `7 / días de conservación` del
  producto (tope 1): lo fresco de 4 días se pierde entero; lo congelado y la
  conserva, casi nada. Lo que no se da por perdido es «inventario».
- **Caja**: lo que pasa por el TPV esa semana. Es el único número que el
  usuario paga.
- **Compra − inventario final** (en las cadenas): compra acumulada menos el
  valor a precio de catálogo de lo que queda en casa al acabar. Sirve para no
  atribuir a ahorro lo que solo es vaciar la despensa; **no es un ahorro
  directo del usuario**, porque ese inventario puede caducar o no usarse.

**Nombres en las tablas regeneradas.** `docs/motor-variantes-2026-10-13.md` se
ha vuelto a generar con la decisión aplicada: allí «B» es la producción (sin
holgura) y «B-holgura» es lo que en este informe se llama «B». Las cadenas
reproducen exactamente las cifras de aquí (B-holgura 1.041,55 € de compra;
B 985,48 €); la modalidad de una semana cambia porque la despensa de partida
sale ahora de una semana 1 sin holgura.

El resto del documento es el informe tal y como se redactó antes de la
decisión.

---

## 1 · Diagnóstico: qué límite introduce B y qué no

**Semántica adoptada.** El presupuesto es el dinero máximo que el usuario
quiere pagar por caja. El valor de lo que ya tiene en casa no es desembolso.

**Lo que el motor hace con el presupuesto.** Dos cosas distintas:

1. **Límite duro de caja.** `construir()` prefiere siempre el candidato que
   cabe (`carritoPrueba.totalCarrito <= presupuesto`) y la pasada de holgura
   rechaza cualquier intento con `totalCarrito > presupuesto`. Esto se mide
   solo en euros de caja y **ninguna variante lo toca**: en las 33 semanas del
   banco y en las 21 de las cadenas, todas las semanas que `cuadra` pagan
   menos del tope.
2. **Objetivo de gasto.** `objetivoGasto = 0,95 × tope` se reparte en cuotas
   por hueco; pasarse de la cuota penaliza (`excesoCoste`) y, en la pasada de
   holgura, acercarse a ella premia (`aprovechamiento`). Esto es una decisión
   de diseño documentada en `BANDA_PRESUPUESTO`, no una consecuencia de la
   definición del presupuesto.

**Qué hace B.** Descuenta de la cuota lo que ya sale del armario
(`armarioActual`). Es decir: el *objetivo* pasa a medirse sobre caja + armario,
igual que ya lo medía la pasada de holgura con `gastoEfectivo`. Antes, cuota y
holgura usaban dos contabilidades distintas del mismo número.

**Conclusión del punto 1.**
- B **sí** introduce un tope blando nuevo: la comida planificada para la
  semana (caja más armario) apunta al 95 % del tope. Antes, ese 95 % era solo
  de caja y el armario iba encima.
- B **no** es un incumplimiento del presupuesto del usuario: el límite de caja
  sigue intacto y es el único duro. Es la corrección de una inconsistencia
  interna.
- B no necesita corregirse mientras exista el objetivo de gasto. Lo que la
  medición enseña (sección 3) es que el efecto de B sobre la construcción base
  es pequeño (40,87 → 39,64 € en el caso original) y que el dinero se mueve en
  la **pasada de holgura**, que es donde se decide si el presupuesto es límite
  o meta. Con la pasada apagada, B es casi inerte: la variante `B-sinHolgura`
  tiene el mismo menú base que B en los 6 hogares.
- Que dos menús distintos cuesten distinto con y sin despensa no es, en sí, un
  fallo. Lo que sí hay que mirar es qué compra la diferencia, y eso es lo que
  mide la sección 3.

### Qué mide «fresco», antes de usarlo

`nutricionDe().huecosConFresca` cuenta huecos cuya receta lleva carne, pescado
o marisco cuyo producto **no** es conserva (`proteinaAnimal`). El **congelado
cuenta como fresco** (lomo de bacalao ultracongelado, jamoncitos congelados,
calamar congelado). La lata cuenta como «conserva». Legumbre, huevo, lácteo y
tofu cuentan como «ninguna». Es una regla de producto (mínimo 2 huecos), no una
medida de calidad: un cambio de «merluza» a «lentejas con huevo» baja el
indicador aunque la proteína suba. En las tablas va acompañado de `animal`
(cualquier proteína animal, conserva incluida) y de `trío` (de cuántas tandas
vive el trío de fuentes de proteína más repetido; menos es más repartido).

---

## 2 · Variantes y criterios, definidos antes de mirar los resultados

Todas son banderas de calibración de `PeticionSemana`; sin ellas el motor es
el de producción (comprobado: el banco de 33 semanas sale idéntico a `b.json`).

| Variante | Qué cambia |
|---|---|
| `antes` | `cuotaSinArmario: true`. La cuota no descuenta el armario, como antes del 13 oct. |
| `B` | Producción actual. |
| `B-sinHolgura` | `sinHolgura: true`. Solo la construcción base con sus semillas. |
| `B-calidad-X` | `holguraPorCalidad`. La pasada de holgura entra siempre que quede dinero, no persigue ningún porcentaje y **solo acepta** un intento si: paga como mucho X % del tope más que la semana base; no baja la proteína; mantiene el mínimo de 2 huecos con carne o pescado; no quita sobras; no pierde platos distintos; no repite más la fuente principal; no sube el perecedero; y **gana algo visible**: un plato distinto más o una fuente de proteína menos repetida (`variedad-fuentes`), o menos repetición o al menos 0,50 € menos de perecedero (`fuentes-perecedero`). Una semana más barata e igual de buena también entra. |
| `B-calidad-10-tol` | Como `calidad-10`, pero el perecedero puede subir hasta 0,25 € por cada euro de gasto adicional. |

X se barre en 5 %, 10 % y 20 %; el criterio en dos formas; y la tolerancia al
perecedero en 0 y 0,25. Si la conclusión cambiara con uno solo de esos
valores, no valdría.

Limitación declarada: la variante de calidad reutiliza las mismas palancas que
generan candidatos en la pasada actual (`aprovechar`, `objetivoExtra`,
`fraccionReserva`, `fraccionSobras`, `variedadExtra`). Cambia qué se acepta,
no cómo se buscan los candidatos.

---

## 3 · Resultados

### 3.1 Una semana, exactamente la misma despensa

Semana 2 de seis hogares con la despensa, la memoria, el catálogo y las
preferencias que deja la semana 1 de producción. Medias de los seis.

| Variante | Caja | Armario usado | Perecedero | Comida nueva | Inventario saliente | Platos | Trío | Fresco | Proteína | Min. cocina | ms |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| antes | 51,77 | 9,11 | 4,52 | 31,87 | 27,53 | 9,0 | 6,3 | 5,0 | 57,4 | 255 | 161 |
| B | 50,44 | 9,66 | 3,53 | 31,61 | 27,24 | 9,0 | 6,0 | 4,8 | 57,5 | 260 | 270 |
| B-sinHolgura | 43,10 | 9,03 | 3,39 | 26,22 | 26,10 | 9,0 | 6,2 | 4,7 | 56,3 | 258 | 117 |
| B-calidad (las cinco) | 43,10 | 9,03 | 3,39 | 26,22 | 26,10 | 9,0 | 6,2 | 4,7 | 56,3 | 258 | 427-452 |

Las cinco variantes de calidad **no aceptaron ningún intento** en ninguno de
los seis hogares: con la despensa puesta, ningún candidato gana un plato o
reparte mejor las fuentes sin subir el perecedero o perder algo. Las 14 comidas
cubiertas en todos los casos, restricciones intactas, dos ejecuciones idénticas.

### 3.2 Cadenas: cada variante arrastra sus propios sobrantes

Seis hogares, 21 semanas en total. «Neto» es compra acumulada menos el valor
del inventario final, para no confundir ahorro con vaciar la despensa.

| Variante | Compra | Inventario final | Neto | Comida nueva | Perecedero | Fresco/sem | Trío | Proteína | Cuadran | ms/sem |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| antes | 1086,87 | 202,61 | 884,26 | 671,10 | 88,22 | 5,19 | 5,81 | 57,3 | 21/21 | 243 |
| B | 1041,55 | 175,47 | 866,08 | 653,94 | 81,14 | 4,81 | 5,71 | 57,4 | 21/21 | 280 |
| B-sinHolgura | 985,48 | 167,45 | 818,03 | 612,55 | 81,24 | 4,76 | 5,71 | 57,0 | 21/21 | 107 |
| B-calidad-5 | 987,94 | 169,51 | 818,43 | 616,99 | 79,60 | 5,05 | 5,62 | 57,1 | 21/21 | 488 |
| B-calidad-10 | 994,92 | 179,50 | 815,42 | 611,55 | 79,31 | 5,00 | 5,52 | 57,2 | 21/21 | 498 |
| B-calidad-20 | 995,90 | 179,91 | 815,99 | 612,83 | 80,43 | 5,00 | 5,57 | 57,2 | 21/21 | 503 |
| B-calidad-10-fp | 994,44 | 180,81 | 813,63 | 615,68 | 79,46 | 4,90 | 5,62 | 57,2 | 21/21 | 479 |
| B-calidad-10-tol | 998,45 | 178,77 | 819,68 | 616,80 | 80,96 | 5,24 | 5,52 | 57,3 | 21/21 | 488 |

Lo que se lee:

- **La pasada de holgura actual cuesta 48 € netos en 21 semanas** (B frente a
  B-sinHolgura, +5,9 %) y a cambio da: los mismos 9 platos, el mismo trío
  (5,71), el mismo perecedero (81,1 frente a 81,2), +0,05 huecos de fresco por
  semana y +0,4 g de proteína. El dinero va a ingredientes más caros y a
  inventario, no a variedad ni a menos basura.
- **Las variantes de calidad se mueven en una banda estrecha** sea cual sea el
  umbral: neto 813,63-819,68 €, trío 5,52-5,62, perecedero 79,3-81,0, fresco
  4,90-5,24. Compran algo de calidad explícita (menos repetición de fuentes,
  un 2 % menos de perecedero) por +1 % de compra. La conclusión no depende del
  umbral.
- **Latencia** (este PC): sin holgura 107 ms/semana, B 280, calidad 480-500.
  En Android se estima ×3-6, sin medir.
- Minutos de cocina: sin holgura cocina algo más (en 2 personas · 65 €: 1184
  min en 4 semanas frente a 1118 con B y 1055 antes). La pasada compra platos
  que requieren menos fogón además de ser más caros.

### 3.3 Los tres casos que había que mirar

**2 personas · 65 € · semana 2, misma despensa.** Menús completos y listas en
`motor-variantes-2026-10-13.md`, sección 3.

| | Caja | Armario | Comida nueva | Perecedero | Inventario sal. | Proteína | Fresco / animal | Trío |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| antes, base | 40,87 | 10,15 | 20,11 | 3,57 | 34,95 | 59,0 | 5 / 5 | 7 |
| antes, final | 62,45 | 13,29 | 32,67 | 3,06 | 37,64 | 59,9 | 6 / 6 | 6 |
| B, base (= sinHolgura = calidad) | 39,64 | 10,94 | 18,85 | 2,24 | 33,86 | 56,2 | 5 / 5 | 7 |
| B, final | 56,19 | 14,37 | 28,99 | 2,42 | 35,50 | 60,9 | 6 / 8 | 6 |

Qué compra la holgura en B: 16,55 € más por caja para 10,14 € más de comida
nueva en el plato; tres huecos más con pescado (calamares dos veces, bacalao,
huevos rellenos de caballa), +4,7 g de proteína, el trío baja de 7 a 6. Lo que
sigue igual: tres bolsas de calamar congelado (16,26 €) para 0,68 kg
necesarios, igual que antes. La semana base sin holgura trae gambas y merluza,
9 platos, 2,24 € de perecedero y 56,2 g, dentro del suelo.

**1 persona · 45 € · cadena de 4 semanas.** Aquí B sale **peor** que antes:

| | Compra | Inventario final | Neto | Fresco (4 sem) | Trío | Proteína |
|---|---:|---:|---:|---:|---:|---:|
| antes | 132,36 | 33,45 | 98,91 | 27 | 5,5 | 58,3 |
| B | 133,23 | 28,74 | 104,49 | 21 | 6,0 | 57,4 |
| B-sinHolgura (= calidad) | 134,00 | 33,78 | 100,22 | 25 | 5,0 | 57,6 |

La semana 2 de B paga 36,23 € frente a 33,64 € y se queda con 3 huecos de
carne o pescado (potaje de vigilia, jamoncitos y su sopa; la pasta con atún es
conserva) frente a 6 (merluza, gambas, longaniza, jamoncitos dos veces). La
pasada aceptó ese intento por un pelo: 2,57 € más de consumo por 4,60 € más de
gasto efectivo, el 56 % con el umbral en 55 %, y la regla de «mejor en todo»
admite perder un hueco de fresco. Sin la pasada, la misma semana cuesta
32,62 € con 4 huecos de carne o pescado y proteína 56,2 g. Es la pasada, no la
cuota, la que produce la semana floja.

**3 personas · 80 € · postre · cadena de 3 semanas.**

| | Compra | Inventario final | Neto | Fresco (3 sem) | Trío | Proteína |
|---|---:|---:|---:|---:|---:|---:|
| antes | 204,42 | 27,10 | 177,32 | 21 | 5,7 | 57,8 |
| B (= sinHolgura = calidad) | 197,20 | 26,53 | 170,67 | 17 | 5,3 | 58,8 |

Aquí la holgura no interviene en ninguna variante de B: la diferencia entera
es la cuota. B paga 6,65 € netos menos y sustituye pechuga, solomillo y
sardinas de la semana 2 por fusilli de lenteja, lentejas a la cúrcuma y
edamame; la proteína sube (58,8 frente a 57,8) y el trío mejora (5,3 frente a
5,7). «Fresco» baja de 21 a 17 huecos. Es menos carne por más legumbre con la
misma proteína de tabla: si eso es peor, es una decisión de producto, no una
medida que salga de los datos.

---

## 4 · Regresiones y ventajas de cada alternativa

| Alternativa | Ventajas medidas | Regresiones medidas |
|---|---|---|
| **antes** (cuota sin armario) | Más huecos con carne o pescado (5,2/sem). | 884 € netos, el peor; 88 € de perecedero; con la nevera llena gasta por encima del propio objetivo (75,74 € de comida sobre 65). |
| **B** (producción) | Contabilidad coherente; −2 % neto y −8 % de perecedero frente a antes; proteína igual. | En 1 persona · 45 € sale peor que antes (+5,6 € netos, 6 huecos de fresco menos en 4 semanas) por un intento de holgura aceptado al límite. Latencia +15 %. |
| **B-sinHolgura** | −5,5 % neto frente a B con los mismos platos, el mismo trío y el mismo perecedero; 2,6 veces más rápido; sin la semana floja de 1 persona. | −0,4 g de proteína media; en la semana 1 de 2 personas · 65 € gasta el 84 % del tope en vez del 95 % (54,32 frente a 62,02 €), con 1 hueco de fresco menos y 3 g menos, dentro del suelo; cocina ~30 min más por semana. La pantalla «Sobran X €» enseña más sobrante. |
| **B-calidad** (limitar la holgura) | Mismo neto que sin holgura; el trío baja a 5,5 y el perecedero un 2 %; robusto a los umbrales. | 4,5 veces más lento que sin holgura y 1,8 veces más que B; en semanas con despensa no acepta nunca, así que su efecto vive en la semana 1. |

Restricciones obligatorias: intactas en todas las variantes y semanas
(filtros, 14 comidas cubiertas, suelo de proteína cuando `cuadra`, tope de
caja). Determinismo: comprobado con doble ejecución en la modalidad de una
semana; las cadenas de B coinciden con `bench-motor/b.json`.

---

## 5 · Recomendación

1. **Mantener B.** Es la contabilidad coherente y no incumple el presupuesto
   del usuario. Su efecto por sí sola es pequeño y va en la dirección correcta
   (menos comida planificada cuando la nevera está llena).
2. **Quitar la pasada de holgura para la beta** (`sinHolgura`), no
   limitarla. Con el presupuesto definido como límite, la pasada gasta un
   5,5 % neto más sin comprar variedad ni menos desperdicio, produce la única
   regresión clara de B (1 persona · 45 €) y es la mitad de la latencia. La
   versión «limitada» por calidad consigue casi lo mismo que apagarla, más
   lenta. La promesa de pantalla «te sobran X €, sube la variedad» ya la cubre
   el selector de variedad, que enseña el precio de cada nivel.
3. Lo que hay que aceptar al apagarla: la semana 1 del caso de arranque pasa
   de 62,02 € a 54,32 € con 55,7 g de proteína (suelo 55) y 6 huecos con carne
   o pescado en vez de 7. Si eso parece poco plato para el primer contacto, la
   alternativa es `B-calidad-10` con el coste de latencia dicho.
4. No se recomienda ningún otro cambio en el motor. Con esto medido, lo que
   falta no sale de más banco: sale de usuarios. Cerrar esta fase.

Esto no está implementado como producción: apagar la pasada es cambiar la
llamada en `construirMejor()` (o pasar `sinHolgura` desde `peticionDe()`), y
conviene decidirlo con esta tabla delante, no por defecto.

---

## 6 · Pruebas ejecutadas y archivos

**Pruebas**
- `catalogo/_aud-bench-motor.ts guardar b-check` → 33 de 33 semanas idénticas
  a `b.json`: las banderas nuevas no cambian producción.
- `catalogo/_aud-variantes.ts`: 6 hogares × 8 variantes en una semana (doble
  ejecución, determinista) y 6 cadenas × 8 variantes (21 semanas cada una).
- `npx vitest run src/motor`: 64 tests en verde (3 ficheros; 46 en `motor.test.ts`).
- `tsc --noEmit` y `eslint` limpios en `seleccionar.ts` y `_aud-variantes.ts`.

**Limitaciones de los datos**
- «Proteína» es la suma de tablas por ingrediente sobre la parte comestible;
  no hay validación nutricional ni de adecuación de raciones. Las cantidades
  por ración son las de cada receta escaladas por comensales; «cobertura» mide
  huecos con plato, no si la ración sacia.
- «Comida nueva» y «consumo» son euros a precio de catálogo, no cantidad ni
  calidad.
- El inventario final se valora a precio de catálogo, sin descontar lo que
  caducará.
- Latencia en este PC. Cadenas dependientes del camino: solo el agregado es
  comparable entre variantes.

**Archivos**
- `src/motor/seleccionar.ts`: dos banderas de calibración nuevas en
  `PeticionSemana` (`cuotaSinArmario`, `holguraPorCalidad`) y su uso en
  `construir()` y `construirMejor()`. Sin bandera, comportamiento idéntico.
- `catalogo/_aud-variantes.ts`: nuevo, genera `docs/motor-variantes-2026-10-13.md`.
- `docs/motor-variantes-2026-10-13.md`: tablas y menús completos.
- `docs/motor-variantes-informe-2026-10-13.md`: este documento.
- Sin commit.
