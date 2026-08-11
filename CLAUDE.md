# Cunde — contexto del proyecto

## Qué es

App móvil española que resuelve la compra semanal del súper con un presupuesto
cerrado. El usuario dice "somos 2, compro en Mercadona, tengo 65 € esta semana"
y recibe menú, lista de la compra con productos y precios reales, y el coste
total antes de salir de casa.

**No es una app de recetas. Es una app de dinero que se paga en comida.**

Ante cualquier duda de diseño o producto, resuélvela por ahí: si algo no acerca
al usuario a saber cuánto va a gastar y cómo gastar menos, sobra.

El competidor gratuito es ChatGPT. Lo único que él no puede hacer es dar
precios reales de SKUs concretos. Ese es todo nuestro espacio de diferenciación.

---

## Reglas que no se negocian

1. **La IA no calcula nada.** Ni precios, ni cantidades, ni el menú. Todo
   determinista, en código. La IA solo se usa fuera de tiempo de ejecución
   (redactar recetas offline, proponer mapeos que un humano revisa).
2. **Valor antes que registro. Registro antes que pago.** El usuario ve su
   menú completo con precio sin dar un email.
3. **La cifra en euros es siempre el elemento más grande de la pantalla.**
   Nunca una foto de comida.
4. **Dos pestañas: Semana y Compra.** Ninguna más. Nunca.
5. **El plan se va a romper el martes.** La app absorbe el fallo y reorganiza,
   no riñe al usuario.
6. **La pantalla Compra se usa de pie, con una mano, empujando un carro, con
   luz de fluorescente.** Ergonomía de app de correr.

---

## Stack

- Ionic React + Capacitor (Vite). Un código para app y para el generador web SEO.
- Estado: `useState` / Zustand. Nada de Redux.
- Backend: Supabase (Postgres + Edge Functions).
- Ingesta de precios: GitHub Actions con cron diario. NO Edge Functions:
  son trabajos largos con esperas y chocan con los límites de ejecución.
- Suscripciones: RevenueCat.
- Windows: solo Android. iOS requiere macOS.

---

## Sistema visual

Concepto: **el ticket de compra español**. Papel térmico, cifras
monoespaciadas, líneas de puntos entre concepto e importe, totales a la derecha.

```
--papel   #EFEDE6   fondo · papel térmico
--papel-2 #E5E2D8   etiquetas, franjas
--crema   #F6F4EE   tarjetas
--tinta   #1A1917   texto · NUNCA negro puro
--azulete #2B4C7E   acciones · azulejo de mercado
--oferta  #FFD400   ahorro · etiqueta de rebaja
--roja    #C8341F   te pasas del presupuesto
--pauta   #A9A498   secundario
--gris    #6E6A5E   texto secundario legible
```

Tipografía:
- **Datos, precios, cantidades** → IBM Plex Mono con `font-variant-numeric:
  tabular-nums`. Es la fuente protagonista.
- **Display** → Bricolage Grotesque. Solo titulares y la cifra grande.
- **Cuerpo** → Inter.
- Escala: 13 / 15 / 17 / 22 / 34 / 56. La 56 se reserva al total de la semana.

Autoaloja las fuentes en `src/assets/fonts/`. Nada de enlaces a Google Fonts:
en una app empaquetada sin cobertura no cargan nunca.

### Prohibido

- **Verde de cualquier tipo.** Es el color de Mercadona y el de toda app de salud.
- Emojis en la interfaz, exclamaciones, confeti, ilustraciones simpáticas.
- Fotos de comida grandes.
- Degradados, glassmorphism, sombras difusas (además van fatal en WebView Android).
- Rachas, insignias, niveles, gamificación.
- Cuentas atrás, escasez falsa, urgencia artificial.
- Suscripción semanal, prueba gratuita con cargo automático, plan caro
  preseleccionado, salida gratuita escondida en gris pequeño.

Contexto de por qué: hay una app compitiendo en España ahora mismo con
suscripción semanal de 9,99 € (519 €/año) y prueba trampa de 3 días. Va a quemar
la confianza del mercado. Nuestro posicionamiento es ser lo contrario. Cualquier
propuesta que erosione eso está descartada.

---

## Rendimiento (pantalla Compra)

1. Fila memoizada con `React.memo` + `useCallback`. Marcar un producto **no**
   puede repintar la lista entera.
2. La lista tiene 25-40 productos. **No necesita virtualización.**
   `ion-virtual-scroll` está obsoleto, no lo uses.
3. Anima solo `transform` y `opacity`. Nunca `height`, `top` ni `width`.
4. El contador animado va con `requestAnimationFrame` sobre un `ref`,
   escribiendo directo en el nodo. Con `useState` son 25 renders/segundo.
5. Respeta siempre `prefers-reduced-motion`.
6. La pantalla Compra funciona **sin conexión**. Los sótanos de los
   supermercados no tienen cobertura.

---

## Modelo de datos

```sql
ingrediente_canonico  id · nombre · unidad_base · es_despensa
producto              cadena · sku · nombre · ean · formato · contenido
                      unidad · categoria · orden_pasillo · ultima_vez_visto
precio                cadena · sku · almacen · precio · precio_unidad
                      capturado_en   ← en la PK: una fila por captura
mapeo                 ingrediente · cadena · sku · factor
receta                id · nombre · minutos · raciones_base · tags
                      proteina · tecnica · pasos[]
receta_ingrediente    receta · ingrediente · cantidad_por_racion · escalado
```

`capturado_en` en la clave primaria de `precio` es deliberado: es el historial,
y no se puede reconstruir después.

---

## Reglas del motor

**Escalar por comensales no es multiplicar.** Cada línea de ingrediente lleva
marca de escalado:
- `lineal` → proteína, verdura, legumbre, arroz, pasta. Multiplica por N.
- `sublineal` → especias, ajo, aceite de sofreír, sal. Usa `N^0.7`.
- `fijo` → hoja de laurel, chorro de vinagre, pastilla de caldo.

**Hay dos costes distintos y no se mezclan:**
- *Coste de consumo* → proporcional a lo que usa el plato. Es el "4,60 € ración".
- *Coste de carrito* → lo que pasa por caja. Es el total de la cabecera.
- **La diferencia entre ambos es el desperdicio. Minimizarla es la función
  objetivo del producto.**

**La despensa va aparte.** Aceite, sal, vinagre, pimentón: marcados
`es_despensa`, en una sección al final llamada "Por si te falta", con casilla
de "ya lo tengo", y **fuera del total principal**. Si van dentro, la semana 1
sale por 78 € y la 2 por 44 €, y el usuario cree que la app miente.

**Algoritmo:** filtrar por restricciones → elegir día a día por coste marginal
(que depende de lo que ya llevas en el carrito) → reparar si se pasa del
presupuesto. El encadenamiento de ingredientes emerge de la fórmula, no se
programa como regla aparte.

Si no cuadra, da la salida, nunca el muro: *"Con 30 € para 4 no me salen las
cuentas. Con 46 € sí"* + deslizador ya puesto en 46.

---

## Reglas de ingesta

- **Siempre `upsert` por `(cadena, sku, almacén)`. Nunca `delete` + `insert`.**
  Si el scrape falla a mitad te quedas sin catálogo.
- Los productos que desaparecen no se borran: se marca `ultima_vez_visto`.
  A los 14 días, descatalogado.
- Registrar cada ejecución: nº productos, precios cambiados, duración.
  Alerta si baja bruscamente.
- Un adaptador por cadena, misma firma. **El origen del precio debe ser
  intercambiable**: vamos a tener que cambiarlo al menos una vez.
- Ritmo educado: 300-500 ms entre peticiones. `User-Agent` identificable.
- Mercadona: los precios van por **almacén** (`mad1`, `vlc1`, `bcn1`…), no por
  código postal. **NO son una docena: medido el 10 ago 2026 salen 157 y ese
  número es un suelo** — con 6 códigos por provincia salían 106 y con 16 salen
  157, sin estabilizarse. Girona tiene 8, Las Palmas 9, Barcelona 8, **Madrid 3**.
  Ver `catalogo/_aud-mapa-almacenes.ts` y `mapa-almacenes.json`.

  Aquí decía «una docena» y sobre eso se decidió quitar el código postal del
  onboarding. La conclusión de fondo —no hace falta el CP exacto, hace falta la
  zona— sigue siendo válida, pero el número no, y con 157 la consecuencia
  cambia: mantener un catálogo por almacén es inviable.

  Lo que de verdad varía, medido: **los envasados llevan referencia nacional**
  (huevos 5,25 € y garbanzos 0,80 € idénticos en Madrid y Oviedo). **El
  mostrador fresco NO**: 13 de 108 referencias dan 404 en Oviedo, y dentro del
  propio Madrid 15 de 34 frescos cambian de precio entre `mad1`, `mad2` y
  `mad3` (el calamar, 1,92 €). O sea: un catálogo nacional para lo envasado y
  una capa regional solo para los ~34 de peso variable, resuelta bajo demanda.
- **La API nunca raspa. Solo lee de la base de datos.** Si están acoplados y
  Mercadona cambia algo, la app se cae para todos a la vez.

---

## Estado actual

Hecho:
- Maquetas de UI y especificación de UX completas.
- Componentes `Semana` y `Compra` con datos falsos que tienen la **forma real**
  del backend (`"Bandeja 700 g"`, no `"300 g de pollo"`).
- Hook `useContador` para la animación de cifras.
- Script `extraer.js` para el catálogo de Mercadona — **sin probar contra la
  API real**. Los nombres de campo salen de documentación de febrero 2026.

Siguiente:
1. Ejecutar `extraer.js` y corregir `normalizar()` con los campos reales.
2. Esquema en Supabase con los campos verificados.
3. 30 recetas normalizadas y mapeadas a SKUs.
4. Motor de menús.

---

## Qué NO construir

Escaneo de despensa por foto (nunca). Escaneo de tickets (mes 3).
Multi-supermercado y comparador. Comunidad o recetas de usuarios. Importador
de recetas de redes. Macros detallados. Modo cocina por voz. Nutricionistas o
B2B. Chat con IA como interfaz principal.

---

## Voz

Tuteo. Frases cortas. Verbos activos. Sin emojis, sin exclamaciones, sin
disculpas.

| En vez de | Escribe |
|---|---|
| "¡Ups! Te has excedido un poquito 😅" | "Te pasas 8,40 €." |
| "Generando tu plan personalizado…" | "Cuadrando 7 días con 65 €." |
| "¡Genial! Tu lista está lista 🎉" | "Lista lista. 24 productos, 61,20 €." |
| "No se han encontrado resultados" | "Con ese presupuesto no me salen las cuentas. Con 46 € sí." |

Una acción conserva su nombre en todo el recorrido. Si el botón dice "Guardar
la semana", el aviso dice "Semana guardada". Nunca "Enviado" ni "Completado".

---

## Métricas que importan

1. % que llega del primer toque a ver su menú con precio (>65%)
2. Nº de ajustes en la primera sesión (predice conversión a pago)
3. % que abre Compra estando en un supermercado
4. **Retorno en la semana 4 (>35%)** ← la que decide si esto es un negocio
5. Tarjetas compartidas por usuario activo

"Engagement" **no** significa tiempo en la app. La app ideal se usa 4 minutos
el domingo y 20 en el súper. Más tiempo es peor producto.

---

## Nota legal

El `robots.txt` de Mercadona bloquea `/api` para crawlers. Esto no hace el
scraping ilegal por sí solo, pero es una señal explícita de que no quieren
acceso automatizado, y debilita el argumento de "son datos públicos" frente al
derecho *sui generis* sobre bases de datos.

Consecuencias asumidas: consulta con abogado de PI antes de lanzar en público;
el escáner de tickets es el plan de continuidad, no un extra; el feed de
afiliado de Carrefour (Awin, con licencia y comisión del 5%) es la fuente
limpia cuando haga falta.