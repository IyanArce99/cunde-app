# Fotos de plato

Cuadradas, del móvil, cocinando de verdad. Nada de banco de imágenes ni
generadas: es lo único que ningún competidor tiene —los suyos son de estudio y
se nota— y una foto falsa hace que la app parezca MÁS generada, no menos.

## Qué entregar

- **Proporción:** cuadrada. Se recorta con `object-fit: cover`, así que puedes
  disparar en vertical y no pasa nada: perdona el encuadre.
- **Tamaño:** 1080 × 1080 px. Se pinta a 330 px de ancho en un móvil de 390,
  así que 1080 cubre pantallas de hasta 3× sin verse blanda.
- **Formato:** `.jpg` con calidad 80. Un JPG de 1080² a calidad 80 pesa unos
  150-250 KB; a calidad 95 pesa el triple y no se distingue en un móvil.
- **Nombre del fichero:** el `id` de la receta, tal cual, más `.jpg`.
  Ejemplo: `merluza_salsa_verde.jpg`.

## Cómo se enciende

En el JSON de la receta (`docs/recetas/*.json`), añade el campo:

```json
"foto": "merluza_salsa_verde.jpg"
```

Y `npx tsx catalogo/generar.ts`. Nada más: el campo es opcional, aparece en la
hoja del día y en la ficha de la receta, y **si no está no se pinta nada**. No
hay marco vacío ni cuadrado gris, porque un hueco reservado promete algo que
no existe.

No va en la tarjeta del día ni en la lista de la compra. La tarjeta es una
línea de ticket para barrer siete días de un vistazo; la compra se usa de pie,
con una mano, empujando un carro.

## Las 15 primeras, por orden

Por frecuencia de uso real sobre 189 semanas generadas. **Estas 15 cubren el
50% de todas las comidas que la app sirve**, así que con esas hechas la mitad
de los huecos tiene foto.

 1. Merluza en salsa verde        8,1%
 2. Jamoncitos al ajillo          5,6%
 3. Revuelto de gambas            5,3%
 4. Quinoa con alubias y maíz     3,7%
 5. Solomillo a la mostaza        3,0%
 6. Macarrones con pollo          2,9%
 7. Garbanzos con soja            2,6%
 8. Picadillo de cerdo            2,6%
 9. Pollo al limón                2,5%
10. Macarrones con queso          2,4%
11. Merluza al horno              2,3%
12. Chili de alubias y soja       2,2%
13. Sardinas al horno            2,2%
14. Patatas con calamares         2,1%
15. Lentejas al curry             2,1%

## Para mirar la maqueta sin tener fotos

`_maqueta.svg` es un fixture: un cuadrado con las aspas y el tamaño, que no
aparenta ser una foto. Sirve para ver cómo se comporta el hueco cuando hay
imagen. Para encenderlo un rato en cualquier receta:

```
"foto": "_maqueta.svg"
```

y `npx tsx catalogo/generar.ts`. Quítalo antes de subir nada: un placeholder
olvidado en producción es peor que un hueco vacío.
