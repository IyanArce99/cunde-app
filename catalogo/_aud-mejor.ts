#!/usr/bin/env node --experimental-strip-types
/**
 * ¿Existe una semana SIN postre tan barata como la de 50 € que sale CON postre?
 * Si existe y el motor no la encuentra, el problema no es el postre.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as M from '../src/motor/seleccionar.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';
const aqui = path.dirname(fileURLToPath(import.meta.url));
const datos: DatosMotor = JSON.parse(fs.readFileSync(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'), 'utf8'));
const base = { datos, N: 2, numHuecos: 14, esfuerzo: 'libre' as const, variedad: 'normal' as const, proteina: 'normal' as const, semanaNumero: 1, presupuesto: 65 };

const recetario = M.recetarioAdaptado(datos, []);
console.log(`Probando las ${recetario.length} semillas a mano, SIN postre...\n`);

let mejor: { coste: number; tirado: number; obj: number; id: string } | null = null;
const suelo = 55; // el suelo de "normal", para comprobar que la semana alimenta
for (const r of recetario) {
  const c = M.construir(base, { forzarPrimera: r.id });
  if (!c) continue;
  const n = M.nutricionDe(c.huecos, datos, 2, suelo);
  if (!n.cumpleSuelo) continue;
  if (c.carrito.totalCarrito > 65) continue;
  const obj = c.carrito.totalCarrito + c.carrito.totalPerecedero;
  if (!mejor || obj < mejor.obj) {
    mejor = { coste: c.carrito.totalCarrito, tirado: c.carrito.totalPerecedero, obj, id: r.id };
  }
}

const laQueDa = M.generarSemana({ ...base });
const objDa = laQueDa.carrito.totalCarrito + laQueDa.carrito.totalPerecedero;

console.log('  LA QUE EL MOTOR ENTREGA hoy, sin postre:');
console.log(`    carrito ${laQueDa.carrito.totalCarrito.toFixed(2)} € · tira ${laQueDa.carrito.totalPerecedero.toFixed(2)} € · objetivo ${objDa.toFixed(2)}`);
if (mejor) {
  console.log('\n  LA MEJOR que existe probando las 112 semillas:');
  console.log(`    carrito ${mejor.coste.toFixed(2)} € · tira ${mejor.tirado.toFixed(2)} € · objetivo ${mejor.obj.toFixed(2)}  (arranque: ${mejor.id})`);
  console.log(`\n  DIFERENCIA: ${(laQueDa.carrito.totalCarrito - mejor.coste).toFixed(2)} € que el motor deja sobre la mesa.`);
} else {
  console.log('\n  no he encontrado ninguna mejor');
}
