# Fotos de plato

Cuadradas, cenitales, plato blanco centrado sobre el papel de la app. Todas
iguales.

> **Esto cambió el 10 de agosto de 2026.** Aquí ponía «nada de banco de imágenes
> ni generadas», con el argumento de que una foto falsa hace que la app parezca
> más generada, no menos. Se decidió generarlas igualmente. El argumento sigue
> en pie para una foto suelta *que aparente ser real* —encimera, trapo, sartén al
> fondo—, y por eso el estilo que se ha fijado es el contrario: fondo liso, sin
> atrezo, cenital. No aparenta ser la cocina de nadie. Es una ficha de catálogo,
> y como ficha de catálogo no engaña.

## El camino entero

```
1. node catalogo/prompts-fotos.js       escribe catalogo/prompts-fotos.md
2. pegar cada prompt en el generador
3. guardar en catalogo/fotos-brutas/<id>.png     ← el nombre ES el id
4. node catalogo/fotos.js               recorta, convierte, pesa
5. node catalogo/fotos.js --encender    pone el campo `foto`
6. npx tsx catalogo/generar.ts                   ← y los DOS de abajo, o pierdes los precios
7. node catalogo/postres.js --escribir
8. node catalogo/aplicar-precios.js catalogo/precios-<la más reciente>.json
```

El paso 4 y el 5 están separados a propósito: convertir es inofensivo, tocar el
recetario no.

**Los pasos 7 y 8 no son opcionales.** Aquí ponía «`npx tsx catalogo/generar.ts`.
Nada más», y es falso: `generar.ts` recompila `motor-datos.json` desde el volcado
del catálogo y **devuelve los precios a la fecha del volcado, en silencio**.
Comprobado el 11 ago encendiendo una sola foto: `generadoEn` retrocedió de
`2026-08-10` a `2026-07-28` sin un solo aviso. Es exactamente lo que avisa la
cabecera de `catalogo/aplicar-precios.js`, y aun así caí. Ese fichero va SIEMPRE
el último.

## Qué sale

- **1080 × 1080 WebP calidad 78.** Se pinta a 330 px en un móvil de 390, así que
  1080 cubre pantallas de hasta 3×.
- **Recorte centrado.** Entre lo que entre —vertical de móvil, 1024² de un
  generador, apaisado— sale cuadrado por el centro.
- **El nombre del fichero es el `id` de la receta.** Si no cuadra con ninguna,
  `fotos.js` lo dice y no adivina: renombrar a ojo acaba poniendo la foto del
  pollo en las lentejas.

## Por qué WebP y no JPG

Aquí ponía JPG calidad 80. Con 151 platos eso son unos 28 MB metidos en el APK.
WebP q78 da la misma foto en la mitad, y Android WebView lo lleva nativo desde
2014. `fotos.js` imprime el peso real al terminar — fíate de eso, no de esta
estimación.

Y no le pidas el formato al generador: sueltan PNG a resolución fija y no
obedecen a «hazlo de 200 KB». La única foto que hubo, `merluza_salsa_verde.png`,
pesaba **2,7 MB**. A ese peso 151 recetas son 408 MB y Google Play corta el AAB
en 200: la app no se sube. Convirtiendo aquí, el peso deja de depender de nadie.

## Cuántas hacen falta

**30.** Medido en `catalogo/_aud-cobertura-fotos.ts` sobre 42 semanas, contando
huecos servidos y no recetas distintas:

```
  5 fotos → 28%      25 fotos → 73%
 10 fotos → 45%      30 fotos → 80%
 15 fotos → 56%      50 fotos → 96%
 20 fotos → 65%      69 fotos → 100%
```

De la 70 en adelante son recetas que el motor **no ha servido nunca**: 82 de las
151. `prompts-fotos.md` ya sale en ese orden, así que si paras a la mitad has
hecho la mitad que se nota.

## Lo que no lleva foto

- **La tarjeta del día y la lista de la compra.** La tarjeta es una línea de
  ticket para barrer siete días de un vistazo; la compra se usa de pie, con una
  mano, empujando un carro.
- **Los huecos de ensamblaje** — 68 de 506, el 13%. Ahí la sobra se convierte en
  otro plato distinto, y la foto del plato original sería mentir.
- **Los postres.** No son recetas: son ingredientes con bandera. Un yogur no
  necesita foto.

## Si no hay foto no pasa nada

El campo es opcional. `FotoPlato` devuelve `null` y quien lo llama no pinta
nada: ni marco vacío ni cuadrado gris, porque un hueco reservado promete algo
que no existe. La ficha empieza directamente por el paso 1.

`_maqueta.svg` es un fixture para ver cómo se comporta el hueco cuando sí hay
imagen. Quítalo antes de subir nada.
