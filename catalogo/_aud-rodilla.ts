#!/usr/bin/env node --experimental-strip-types
/** ¿Cuántas semillas hacen falta para no dejar dinero sobre la mesa? */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as M from '../src/motor/seleccionar.ts';
import { consumoPorRacion } from '../src/motor/carrito.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';
const aqui = path.dirname(fileURLToPath(import.meta.url));
const datos: DatosMotor = JSON.parse(fs.readFileSync(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'), 'utf8'));

const casos = [
  { N: 2, presupuesto: 65 }, { N: 2, presupuesto: 50 },
  { N: 1, presupuesto: 45 }, { N: 4, presupuesto: 95 },
];
const CORTES = [8, 16, 24, 40, 112];
console.log('  caso            ' + CORTES.map(c => `${String(c).padStart(6)} sem`).join('') + '   ahorro 8->112');
for (const { N, presupuesto } of casos) {
  const base = { datos, N, numHuecos: 14, esfuerzo: 'libre' as const, variedad: 'normal' as const, proteina: 'normal' as const, semanaNumero: 1, presupuesto };
  // Mismo orden de semillas que usa construirMejor: por coste de consumo.
  const ordenadas = M.recetarioAdaptado(datos, [])
    .map((r) => ({ r, c: consumoPorRacion(r, datos, N) })).sort((a, b) => a.c - b.c).map((x) => x.r);
  const suelo = 55;
  const objetivos: number[] = [];
  let mejorObj = Infinity, mejorCoste = Infinity;
  const fila: string[] = [];
  let corte = 0;
  for (let i = 0; i < ordenadas.length; i++) {
    const c = M.construir(base, { forzarPrimera: ordenadas[i].id });
    if (c && M.nutricionDe(c.huecos, datos, N, suelo).cumpleSuelo && c.carrito.totalCarrito <= presupuesto) {
      const obj = c.carrito.totalCarrito + c.carrito.totalPerecedero;
      if (obj < mejorObj) { mejorObj = obj; mejorCoste = c.carrito.totalCarrito; }
    }
    if (i + 1 === CORTES[corte]) { fila.push(`${mejorCoste === Infinity ? '  —  ' : mejorCoste.toFixed(2)} €`.padStart(10)); objetivos.push(mejorCoste); corte++; }
  }
  while (fila.length < CORTES.length) { fila.push(`${mejorCoste.toFixed(2)} €`.padStart(10)); objetivos.push(mejorCoste); }
  console.log(`  N=${N} ${String(presupuesto).padStart(3)} €     ` + fila.join('') + `   ${(objetivos[0] - objetivos[objetivos.length-1]).toFixed(2)} €`);
}
