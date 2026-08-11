#!/usr/bin/env node
/**
 * HOJA DE CONTACTO · LAS FOTOS COMO SE VEN, CON EL NOMBRE DE SU PLATO
 *
 * ═══ PARA QUÉ SIRVE, QUE NO ES LO QUE PARECE ═══
 *
 * No es para admirar las fotos. Es lo ÚNICO que caza que una foto esté en el
 * plato equivocado.
 *
 * El 11 de agosto, diez ficheros de una tanda venían cruzados entre sí:
 * `revuelto_garbanzos_queso.png` contenía macarrones a la boloñesa,
 * `alubias_negras_espinacas.png` contenía quinoa con calabacín. Ningún paso
 * posterior se queja —el nombre existe, la receta existe, la foto se convierte
 * y se publica— y en la app la ficha enseña otro plato sin dar error. Solo se
 * ve poniendo la imagen al lado del nombre de su receta.
 *
 * Con `generar-fotos.js` el cruce ya no puede pasar, porque el fichero lo
 * escribe el mismo id que generó el prompt. Esto sigue haciendo falta para lo
 * que entre a mano y para revisar que el estilo no se ha ido entre tandas.
 *
 * ═══ AL TAMAÑO REAL, NO A PANTALLA COMPLETA ═══
 *
 * Se monta con las WebP ya publicadas y con el ancho, el marco y el papel
 * reales sacados de FotoPlato.css. Importa: mirando las fotos grandes sobre
 * blanco parecen tener fondos distintos, y a 328 px dentro de un marco de 1 px
 * esa diferencia desaparece. Aquí se juzga lo que el usuario ve.
 *
 * Uso: node catalogo/contacto-fotos.js  →  catalogo/contacto-fotos.png
 */

import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.join(aqui, '..');
const DIR = path.join(raiz, 'public', 'recetas');

const LADO = 328;   // lo que mide en un móvil de 390
const BORDE = 1;    // .foto-plato { border: 1px solid var(--pauta) }
const PAPEL = { r: 0xEF, g: 0xED, b: 0xE6 };
const PAUTA = { r: 0xA9, g: 0xA4, b: 0x98 };
const HUECO = 20;
const ROTULO = 26;
const COLS = 3;

const datos = JSON.parse(fs.readFileSync(path.join(raiz, 'src', 'data', 'motor-datos.json'), 'utf8'));
const nombre = new Map(datos.recetas.map((r) => [r.id, r.nombre]));

const fotos = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((f) => f.endsWith('.webp')).sort() : [];
if (fotos.length === 0) { console.log('no hay fotos en public/recetas.'); process.exit(0); }

const filas = Math.ceil(fotos.length / COLS);
const celda = LADO + BORDE * 2;
const W = COLS * celda + (COLS + 1) * HUECO;
const H = filas * (celda + ROTULO) + (filas + 1) * HUECO;

const escapar = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const capas = [];
const huerfanas = [];
for (let i = 0; i < fotos.length; i++) {
  const id = fotos[i].replace(/\.webp$/, '');
  if (!nombre.has(id)) huerfanas.push(id);
  const x = HUECO + (i % COLS) * (celda + HUECO);
  const y = HUECO + Math.floor(i / COLS) * (celda + ROTULO + HUECO);
  capas.push(
    { input: { create: { width: celda, height: celda, channels: 3, background: PAUTA } }, left: x, top: y },
    {
      input: await sharp(path.join(DIR, fotos[i])).resize(LADO, LADO).png().toBuffer(),
      left: x + BORDE, top: y + BORDE,
    },
    {
      input: Buffer.from(
        `<svg width="${celda}" height="${ROTULO}">`
        + '<text x="0" y="17" font-family="sans-serif" font-size="15" fill="#1A1917">'
        + `${escapar(nombre.get(id) ?? `¿? ${id}`)}</text></svg>`,
      ),
      left: x, top: y + celda + 4,
    },
  );
}

const salida = path.join(aqui, 'contacto-fotos.png');
await sharp({ create: { width: W, height: H, channels: 3, background: PAPEL } })
  .composite(capas).png().toFile(salida);

console.log(`${fotos.length} fotos · ${path.relative(raiz, salida)} (${W}×${H})`);
if (huerfanas.length) console.log(`AVISO · sin receta que las use: ${huerfanas.join(', ')}`);
console.log('Míralo entero: cada imagen tiene que ser del plato que dice el rótulo.');
