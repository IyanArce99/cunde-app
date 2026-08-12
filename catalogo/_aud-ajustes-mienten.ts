#!/usr/bin/env node --experimental-strip-types
/**
 * AUDITORÍA — ¿MIENTE LA HOJA DE AJUSTES?
 *
 * Síntoma: abrir «Ajustar la semana» sin tocar nada enseña una cesta distinta
 * de la que hay detrás, con un «sube 2,37 €» que el usuario no ha provocado.
 *
 * Sospecha: las estimaciones de la hoja salen de `lib/derive.ts:peticion()`,
 * que NO pasa el número de semana, ni el historial, ni la despensa, ni las
 * preferencias de platos. `regenerar()` sí los pasa. Serían dos problemas
 * distintos con el mismo nombre.
 *
 * Esto lo comprueba: monta la semana como la monta la app y calcula la
 * estimación como la calcula la hoja, para la MISMA variedad, y los compara.
 *
 * No modifica nada.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generarSemana, costesPorVariedad } from '../src/motor/seleccionar.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const datos: DatosMotor = JSON.parse(
  fs.readFileSync(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'), 'utf8'),
);

const BASE = {
  datos,
  N: 2,
  numHuecos: 14,
  esfuerzo: 'libre' as const,
  exclusiones: [] as string[],
  presupuesto: 65,
  proteina: 'normal' as const,
  postre: false,
};

console.log('Perfil: 2 personas · 65 € · 14 comidas · normal · sin postre\n');

/* Igual que la hoja de ajustes: sin semana, sin memoria, sin despensa. */
const comoLaHoja = costesPorVariedad({ ...BASE, variedad: 'normal' });

console.log('CESTA SEGÚN LA HOJA DE AJUSTES        CESTA REAL DE ESA SEMANA');
console.log('(sin semana/memoria/despensa)         (como la genera la app)\n');

let discrepancias = 0;
for (const variedad of ['poca', 'normal', 'mucha'] as const) {
  const hoja = comoLaHoja[variedad];

  /* Y ahora como la app: misma variedad, pero con el número de semana que usa
     `regenerar` para decidir la silueta. Sin despensa ni historial porque en la
     primera semana están vacíos — o sea, EL CASO MÁS FAVORABLE al empate. */
  const real = generarSemana({ ...BASE, variedad, semanaNumero: 1 } as never);

  const c1 = hoja?.disponible && Number.isFinite(hoja.carrito) ? hoja.carrito : NaN;
  const c2 = real.sinCobertura ? NaN : real.carrito.totalCarrito;
  const dif = Math.abs(c1 - c2);
  if (dif > 0.005) discrepancias++;

  console.log(
    `  ${variedad.padEnd(7)} ${c1.toFixed(2).padStart(7)} €`
    + `                ${c2.toFixed(2).padStart(7)} €`
    + `   ${dif > 0.005 ? `← se llevan ${dif.toFixed(2)} €` : '(igual)'}`,
  );
}

console.log(`\n${discrepancias} de 3 no coinciden.`);

/**
 * Y la comprobación que de verdad importa: ¿la hoja ORDENA distinto que la
 * realidad? Si las cifras difieren pero el orden se mantiene, el usuario ve un
 * número raro. Si además cambia el orden, la hoja le recomienda lo que NO es.
 */
const ordenHoja = (['poca', 'normal', 'mucha'] as const)
  .filter((v) => comoLaHoja[v]?.disponible)
  .sort((a, b) => comoLaHoja[a].carrito - comoLaHoja[b].carrito);

const reales = (['poca', 'normal', 'mucha'] as const).map((v) => ({
  v, c: (generarSemana({ ...BASE, variedad: v, semanaNumero: 1 } as never)).carrito?.totalCarrito ?? Infinity,
}));
const ordenReal = reales.sort((a, b) => a.c - b.c).map((x) => x.v);

console.log(`\norden por precio según la hoja: ${ordenHoja.join(' < ')}`);
console.log(`orden por precio de verdad:     ${ordenReal.join(' < ')}`);
console.log(ordenHoja.join() === ordenReal.join()
  ? '\nel orden coincide: el usuario elige bien aunque las cifras bailen.'
  : '\nEL ORDEN NO COINCIDE: la hoja le está recomendando la que no es.');
