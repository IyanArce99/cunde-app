#!/usr/bin/env node --experimental-strip-types
/**
 * AUDITORÍA — ¿CUÁNTOS PLATOS DE UNA SEMANA REAL TIENEN FOTO?
 *
 * «20 de 151 recetas» no responde a lo que importa, porque las recetas no salen
 * por igual: las fotografiadas son justo las que más se sirven. Lo que se nota
 * es qué parte de LOS PLATOS QUE SE VEN llevan foto, semana a semana.
 *
 * Misma parrilla que `_aud-cobertura-fotos.ts` para que los números casen.
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
const CONTEXTOS = [
  { etiqueta: '2 personas · 51 €', N: 2, presupuesto: 51 },
  { etiqueta: '1 persona · 30 €', N: 1, presupuesto: 30 },
  { etiqueta: '4 personas · 90 €', N: 4, presupuesto: 90 },
  { etiqueta: '2 personas · 70 €', N: 2, presupuesto: 70 },
];

const conFoto = new Set(datos.recetas.filter((r) => r.foto).map((r) => r.id));
console.log(`recetas con foto: ${conFoto.size} de ${datos.recetas.length}\n`);

console.log('contexto              platos/semana   con foto   %');
let totalCon = 0;
let total = 0;
const peor: Array<{ etiqueta: string; pct: number }> = [];

for (const ctx of CONTEXTOS) {
  let c = 0;
  let t = 0;
  for (const variedad of VARIEDADES) {
    for (const proteina of NIVELES) {
      const s = generarSemana({
        datos, N: ctx.N, presupuesto: ctx.presupuesto, numHuecos: 14, variedad, proteina,
      });
      if (s.sinCobertura) continue;
      for (const h of s.huecos ?? []) {
        /* Un ensamblaje es OTRO plato: la foto del original no vale ahí. */
        if (!h.receta || h.tipo === 'libre' || h.tipo === 'ensamblaje') continue;
        t++;
        if (conFoto.has(h.receta.id)) c++;
      }
    }
  }
  const pct = t ? Math.round((c / t) * 100) : 0;
  peor.push({ etiqueta: ctx.etiqueta, pct });
  totalCon += c; total += t;
  const barra = '█'.repeat(Math.round(pct / 5));
  console.log(`${ctx.etiqueta.padEnd(21)} ${String(Math.round(t / 9)).padStart(9)} ${String(c).padStart(10)} ${String(pct).padStart(4)}%  ${barra}`);
}

console.log(`\nen conjunto: ${totalCon} de ${total} platos servidos llevan foto · ${Math.round((totalCon / total) * 100)}%`);

/* Y en la semana concreta que ve alguien nuevo, que es la que decide si la app
   parece acabada o a medias. */
const s = generarSemana({ datos, N: 2, presupuesto: 65, numHuecos: 14, variedad: 'normal', proteina: 'normal' });
const platos = (s.huecos ?? []).filter((h) => h.receta && h.tipo !== 'libre' && h.tipo !== 'ensamblaje');
const con = platos.filter((h) => conFoto.has(h.receta!.id));
console.log(`\nla semana por defecto (2 personas, 65 €): ${con.length} de ${platos.length} platos con foto`);
for (const h of platos) {
  console.log(`  ${conFoto.has(h.receta!.id) ? '■' : '·'} ${h.receta!.nombre}`);
}
