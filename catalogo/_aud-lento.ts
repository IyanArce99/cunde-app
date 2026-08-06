#!/usr/bin/env node --experimental-strip-types
/** ¿Cuántas veces se construye una semana entera, y cuánto cuesta cada una? */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as M from '../src/motor/seleccionar.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const datos: DatosMotor = JSON.parse(fs.readFileSync(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'), 'utf8'));
const base = { datos, N: 2, numHuecos: 14, esfuerzo: 'libre' as const, exclusiones: [], proteina: 'normal' as const, semanaNumero: 1 };

const ms = (f: () => unknown) => { const t = process.hrtime.bigint(); f(); return Number(process.hrtime.bigint() - t) / 1e6; };

console.log('=== EL ÁTOMO: una construcción ===');
M.construir({ ...base, variedad: 'normal', presupuesto: 65 });      // calienta
const unSolo = [...Array(20)].map(() => ms(() => M.construir({ ...base, variedad: 'normal', presupuesto: 65 })));
console.log(`  construir() una vez: ${(unSolo.reduce((a,b)=>a+b)/unSolo.length).toFixed(1)} ms de media`);
console.log(`  recetarioAdaptado():  ${ms(() => M.recetarioAdaptado(datos, [])).toFixed(2)} ms`);

console.log('\n=== LO QUE PIDE CADA PANTALLA ===');
const casos: [string, () => unknown][] = [
  ['generarSemana (la semana)', () => M.generarSemana({ ...base, variedad: 'normal', presupuesto: 65 })],
  ['costesPorVariedad (Ajustes, eje 1)', () => M.costesPorVariedad({ ...base, presupuesto: 65 })],
  ['costesPorProteina (Ajustes, eje 2)', () => M.costesPorProteina({ ...base, variedad: 'normal', presupuesto: 65 })],
  ['costesPorVariedad SIN techo (el suelo de 2/3)', () => M.costesPorVariedad({ ...base, presupuesto: Infinity })],
];
for (const [nombre, f] of casos) {
  f();
  const t = [...Array(3)].map(() => ms(f));
  console.log(`  ${nombre.padEnd(46)} ${(t.reduce((a,b)=>a+b)/t.length).toFixed(0)} ms`);
}

console.log('\n=== ¿CUÁNTAS SEMILLAS SE LLEGAN A PROBAR? ===');
// Se cuenta indirectamente: el tiempo dividido por el coste de una construcción.
const atomo = unSolo.reduce((a,b)=>a+b)/unSolo.length;
for (const [nombre, f] of casos) {
  const t = ms(f);
  console.log(`  ${nombre.padEnd(46)} ~${Math.round(t/atomo)} construcciones`);
}
