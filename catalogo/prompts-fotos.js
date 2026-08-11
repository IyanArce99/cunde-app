#!/usr/bin/env node
/**
 * PROMPTS PARA LAS FOTOS DE PLATO
 *
 * Escribe `catalogo/prompts-fotos.md`: un prompt por receta, ordenados por
 * cuánto sale el plato de verdad, con un bloque de estilo IDÉNTICO en todos.
 *
 * ═══ POR QUÉ SE GENERAN Y NO SE ESCRIBEN A MANO ═══
 *
 * Porque el encargo es que salgan todas iguales, y 141 prompts escritos a mano
 * no salen iguales: a la tercera cambias una palabra del fondo sin darte cuenta
 * y esa foto ya no encaja con las demás. Aquí el bloque de estilo es una
 * constante y lo único que cambia es la frase del plato, que sale de los
 * ingredientes de la receta. La consistencia deja de depender de la disciplina.
 *
 * ═══ EL ORDEN NO ES ALFABÉTICO ═══
 *
 * Es por huecos servidos, medido en `_aud-cobertura-fotos.ts`. Las 30 primeras
 * cubren el 80% de los platos que el usuario ve; de la 70 en adelante son
 * recetas que el motor no ha servido nunca. Si te cansas a la mitad, la mitad
 * que has hecho es la que se nota.
 *
 * Uso: node catalogo/prompts-fotos.js
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
/* El prompt vive en un único sitio, compartido con `generar-fotos.js`. Estaba
   duplicado, y así es como acaban dos tandas con fondos distintos. */
import { promptDe } from './prompt-foto.js';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.join(aqui, '..');
const datos = JSON.parse(fs.readFileSync(path.join(raiz, 'src', 'data', 'motor-datos.json'), 'utf8'));

/* El estilo, los ingredientes visibles y cómo se sirve cada técnica viven en
   `prompt-foto.js`, compartidos con `generar-fotos.js`. Estaban aquí duplicados
   y es la forma segura de acabar con dos tandas que no casan entre sí. */

/* El orden sale de la auditoría de cobertura. Si no se ha ejecutado, se cae al
   orden del recetario y se avisa: un orden inventado sería peor que ninguno. */
const RANKING = path.join(aqui, 'orden-fotos.json');
let orden = [];
if (fs.existsSync(RANKING)) orden = JSON.parse(fs.readFileSync(RANKING, 'utf8'));
else console.warn('AVISO: no hay orden-fotos.json; salen en el orden del recetario.');

/**
 * ═══ LO QUE YA ESTÁ HECHO NO SALE ═══
 *
 * El fichero listaba las 151 siempre, hechas o no, y había que ir cribando a
 * mano cuáles faltaban. Ahora solo salen las pendientes: lo que hay en el
 * fichero ES el trabajo que queda, y se vacía solo según se van haciendo.
 *
 * La verdad es `public/recetas/*.webp`, no el campo `foto` del recetario: si
 * una foto está convertida pero todavía sin encender, tampoco hay que volver a
 * generarla.
 */
const DESTINO_FOTOS = path.join(raiz, 'public', 'recetas');
const yaHechas = new Set(
  fs.existsSync(DESTINO_FOTOS)
    ? fs.readdirSync(DESTINO_FOTOS).filter((f) => f.endsWith('.webp')).map((f) => f.replace(/\.webp$/, ''))
    : [],
);

/* Las 151 son platos. Los postres son ingredientes, no recetas. */
const todos = [...datos.recetas];
const rango = new Map(orden.map((id, i) => [id, i]));
const platos = todos.filter((r) => !yaHechas.has(r.id));
platos.sort((a, b) => (rango.get(a.id) ?? 9999) - (rango.get(b.id) ?? 9999));

/* Cuánto compra la siguiente tanda, para decidir dónde parar. */
const totalHuecos = orden.length;
const pendientesServidas = platos.filter((r) => rango.has(r.id)).length;

const lineas = [
  '# Fotos de plato · lo que falta',
  '',
  `**${yaHechas.size} hechas · ${platos.length} pendientes** de ${todos.length} platos.`,
  '',
  'Generado por `node catalogo/prompts-fotos.js`. **No lo edites a mano**: se',
  'reescribe entero, y las que ya tienen foto desaparecen solas de la lista. Si',
  'hay que cambiar el estilo, se cambia la constante `ESTILO` del script y se',
  'regenera: así cambia en todas a la vez.',
  '',
  '## Cómo se usa',
  '',
  '1. Pega el prompt de una receta en el generador. Uno por uno, o por tandas.',
  '2. Guarda la imagen en `catalogo/fotos-brutas/` **con el id como nombre**',
  '   (`jamoncitos_ajillo_champinones.png`). El formato da igual: PNG grande está bien.',
  '3. **Comprueba el nombre antes de seguir.** En la tanda del 11 ago diez ficheros',
  '   venían cruzados entre sí, y eso en la app no da error: enseña el plato',
  '   equivocado y nadie se entera.',
  '4. `node catalogo/fotos.js` — recorta a 1080×1080, convierte a WebP y dice lo que pesa.',
  '5. `node catalogo/fotos.js --encender`, y después `generar.ts`, `postres.js --escribir`',
  '   y `aplicar-precios.js` **en ese orden** (si no, se revierten los precios).',
  '',
  '## El orden',
  '',
  'Por huecos servidos, con **la semana de arranque de la app (2 personas, 65 €)',
  'contando triple**: es la única que ve todo usuario nuevo. Sin ese peso, el orden',
  'priorizaba semanas que nadie empieza — la primera versión de esta lista mandaba',
  'al puesto #41 platos que salen en la primera pantalla.',
  '',
  `Quedan **${pendientesServidas}** que el motor sirve alguna vez; el resto no ha`,
  'aparecido nunca en la parrilla y van al final.',
  '',
  '---',
  '',
];

platos.forEach((r, i) => {
  const puesto = rango.has(r.id) ? `#${rango.get(r.id) + 1} de ${totalHuecos}` : 'nunca servida';
  lineas.push(`### ${i + 1}. ${r.nombre}  \`${r.id}\`  ·  ${puesto}`);
  lineas.push('');
  lineas.push('```');
  lineas.push(promptDe(r, datos));
  lineas.push('```');
  lineas.push('');
});

const destino = path.join(aqui, 'prompts-fotos.md');
fs.writeFileSync(destino, `${lineas.join('\n')}\n`, 'utf8');
console.log(`${path.relative(raiz, destino)}`);
console.log(`  ya hechas:  ${yaHechas.size}`);
console.log(`  pendientes: ${platos.length}  (${pendientesServidas} que el motor sirve, ${platos.length - pendientesServidas} que no)`);
if (platos.length) console.log(`  la siguiente: ${platos[0].nombre}`);
