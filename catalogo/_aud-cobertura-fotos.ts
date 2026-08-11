#!/usr/bin/env node --experimental-strip-types
/**
 * AUDITORÍA — ¿CUÁNTAS FOTOS HAY QUE ENCARGAR?
 *
 * `_aud-uso.ts` dice que solo 72 de 151 recetas salen alguna vez. Pero eso no
 * responde a la pregunta que importa, que no es «cuántas recetas se usan» sino
 * **qué parte de los platos que el usuario ve por pantalla tendría foto** si
 * fotografías las N más frecuentes.
 *
 * Así que aquí se cuentan HUECOS SERVIDOS, no recetas distintas: si los
 * jamoncitos salen en 28 semanas y ocupan 2 huecos cada vez, son 56 platos
 * vistos. Esa es la unidad en la que se nota la foto.
 *
 * La parrilla es la misma que en `_aud-uso.ts` para que los números se puedan
 * comparar entre las dos auditorías.
 *
 * No modifica nada.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generarSemana } from '../src/motor/seleccionar.ts';
import type { NivelProteina, Variedad } from '../src/motor/seleccionar.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const datos: DatosMotor = JSON.parse(
  fs.readFileSync(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'), 'utf8'),
);

const VARIEDADES: Variedad[] = ['poca', 'normal', 'mucha'];
const NIVELES: NivelProteina[] = ['basica', 'normal', 'alta'];
/**
 * ═══ EL ARRANQUE VA PRIMERO Y CUENTA TRIPLE ═══
 *
 * La parrilla original —51, 30, 90 y 70 €— no incluía el perfil con el que
 * arranca la app: 2 personas y 65 €, que es lo que hay en AppStateContext y por
 * tanto la única semana que TODO usuario nuevo ve.
 *
 * Con 20 fotos hechas y el 63% de cobertura global, esa semana tenía 5 platos
 * de 12: servía recetas del puesto #41, #42 y #46, y una que no aparecía en
 * toda la parrilla. O sea, el orden de encargo estaba optimizando semanas que
 * nadie empieza.
 *
 * El peso 3 no es un ajuste fino: es reconocer que la primera semana decide si
 * la app parece acabada, y que las demás se ven cuando el usuario ya se ha
 * quedado. No hace falta más precisión que esa.
 */
const CONTEXTOS = [
  { N: 2, presupuesto: 65, peso: 3 },  // ← el arranque de la app
  { N: 2, presupuesto: 51, peso: 1 },
  { N: 1, presupuesto: 30, peso: 1 },
  { N: 4, presupuesto: 90, peso: 1 },
  { N: 2, presupuesto: 70, peso: 1 },
];
const EXCLUSIONES: Array<{ etiqueta: string; ex: string[] }> = [
  { etiqueta: 'Vegetariano', ex: ['carne', 'pescado'] },
  { etiqueta: 'Vegano', ex: ['carne', 'pescado', 'lacteo', 'huevo'] },
  { etiqueta: 'Gluten', ex: ['gluten'] },
  { etiqueta: 'Huevo', ex: ['huevo'] },
  { etiqueta: 'Lactosa', ex: ['lacteo'] },
];

const nombre = new Map(datos.recetas.map((r) => [r.id, r.nombre]));
const esPostre = (id: string) =>
  id.startsWith('postre_') || (datos.recetas.find((r) => r.id === id)?.tags ?? []).includes('postre');

/** huecos servidos por receta, sumando toda la parrilla */
const huecos = new Map<string, number>();
let servidos = 0;
/* Un hueco de sobras enseña EL MISMO plato, así que aprovecha la misma foto y
   suma. Uno de ensamblaje no: la sobra se convierte en otra cosa, y ahí la foto
   del plato original sería mentir. Se cuentan aparte. */
let ensamblajes = 0;

function contar(peticion: Parameters<typeof generarSemana>[0], peso = 1) {
  const s = generarSemana(peticion);
  if (s.sinCobertura) return;
  for (const h of s.huecos ?? []) {
    if (!h.receta || h.tipo === 'libre') continue;
    if (h.tipo === 'ensamblaje') { ensamblajes++; continue; }
    if (esPostre(h.receta.id)) continue;
    huecos.set(h.receta.id, (huecos.get(h.receta.id) ?? 0) + peso);
    servidos += peso;
  }
}

for (const { N, presupuesto, peso } of CONTEXTOS) {
  for (const variedad of VARIEDADES) {
    for (const proteina of NIVELES) {
      contar({ datos, N, presupuesto, numHuecos: 14, variedad, proteina }, peso);
    }
  }
}
for (const { ex } of EXCLUSIONES) {
  contar({
    datos, N: 2, presupuesto: 51, numHuecos: 14,
    variedad: 'normal', proteina: 'normal', exclusiones: ex,
  });
}

// --- Cobertura acumulada ----------------------------------------------------

const orden = [...huecos.entries()].sort((a, b) => b[1] - a[1]);
const platos = datos.recetas.filter((r) => !esPostre(r.id)).length;

console.log(`platos fotografiables: ${platos}`);
console.log(`huecos servidos en la parrilla: ${servidos}`);
console.log(`recetas que salen alguna vez: ${orden.length}`);
console.log(`huecos de ensamblaje (la sobra se vuelve otro plato): ${ensamblajes}\n`);

console.log('FOTOS  CUBRE   qué parte de los platos que el usuario ve tendría foto');
let acc = 0;
const hitos = [5, 10, 15, 20, 25, 30, 40, 50, 60, 72];
for (let i = 0; i < orden.length; i++) {
  acc += orden[i][1];
  if (hitos.includes(i + 1)) {
    const pct = ((acc / servidos) * 100).toFixed(0);
    const barra = '█'.repeat(Math.round(Number(pct) / 4));
    console.log(`  ${String(i + 1).padStart(3)}   ${pct.padStart(3)}%   ${barra}`);
  }
}

/* El orden se deja en disco porque lo consume `prompts-fotos.js`. Sin esto,
   los prompts saldrían en el orden del recetario, que no significa nada. */
fs.writeFileSync(
  path.join(aqui, 'orden-fotos.json'),
  `${JSON.stringify(orden.map(([id]) => id), null, 0)}\n`,
  'utf8',
);

console.log('\nPOR ORDEN DE ENCARGO (las 25 primeras)');
for (let i = 0; i < Math.min(25, orden.length); i++) {
  const [id, n] = orden[i];
  console.log(`  ${String(i + 1).padStart(2)}. ${id.padEnd(34)} ${String(n).padStart(3)} huecos  ${nombre.get(id)}`);
}
