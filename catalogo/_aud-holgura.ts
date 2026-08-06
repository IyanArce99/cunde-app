#!/usr/bin/env node --experimental-strip-types
/**
 * LA PASADA DE HOLGURA, ENCENDIDA CONTRA APAGADA, en el mismo caso.
 * La pregunta del proyecto: ¿el euro de más llega al plato o a la basura?
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as M from '../src/motor/seleccionar.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';
const aqui = path.dirname(fileURLToPath(import.meta.url));
const datos: DatosMotor = JSON.parse(fs.readFileSync(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'), 'utf8'));

const casos: [number, number][] = [[1,35],[1,45],[1,60],[2,50],[2,65],[2,80],[2,100],[4,90],[4,110],[4,140]];
console.log('  N  presu |  carrito         consumo         tirado      platos  prot');
console.log('           |  off -> on       off -> on       off -> on   off->on off->on   ¿el euro llega al plato?');
let bien = 0, mal = 0, sumaCarrito = 0, sumaConsumo = 0, sumaTirado = 0;
for (const [N, presupuesto] of casos) {
  const base = { datos, N, numHuecos: 14, esfuerzo: 'libre' as const, variedad: 'normal' as const, proteina: 'normal' as const, semanaNumero: 1, presupuesto };
  const off = M.generarSemana({ ...base, sinHolgura: true });
  const on = M.generarSemana({ ...base });
  const dC = on.carrito.totalCarrito - off.carrito.totalCarrito;
  const dCons = on.carrito.totalConsumo - off.carrito.totalConsumo;
  const dTira = on.carrito.totalPerecedero - off.carrito.totalPerecedero;
  const pOff = new Set(off.tandas.map(t=>t.receta.id)).size, pOn = new Set(on.tandas.map(t=>t.receta.id)).size;
  // La fracción del euro de más que acaba comido.
  const rendimiento = dC > 0.01 ? dCons / dC : null;
  if (dC > 0.01) { sumaCarrito += dC; sumaConsumo += dCons; sumaTirado += dTira; if (rendimiento! >= 0.5) bien++; else mal++; }
  console.log(`  ${N}  ${String(presupuesto).padStart(4)} € | `
    + `${off.carrito.totalCarrito.toFixed(2).padStart(6)}->${on.carrito.totalCarrito.toFixed(2).padStart(6)}  `
    + `${off.carrito.totalConsumo.toFixed(2).padStart(6)}->${on.carrito.totalConsumo.toFixed(2).padStart(6)}  `
    + `${off.carrito.totalPerecedero.toFixed(2).padStart(5)}->${on.carrito.totalPerecedero.toFixed(2).padStart(5)}  `
    + `${pOff}->${pOn}     ${off.nutricion.proteinaPorPersonaDia.toFixed(0)}->${on.nutricion.proteinaPorPersonaDia.toFixed(0)}     `
    + (rendimiento === null ? 'no se activó' : `${(rendimiento*100).toFixed(0)}% comido${rendimiento < 0.5 ? '  <-- MAL' : ''}`));
}
console.log(`\n  Donde se activó (${bien+mal} casos): ${bien} con el euro bien gastado, ${mal} mal.`);
if (sumaCarrito > 0) {
  console.log(`  En total gastó ${sumaCarrito.toFixed(2)} € de más:`);
  console.log(`    ${sumaConsumo.toFixed(2)} € llegaron al plato (${(sumaConsumo/sumaCarrito*100).toFixed(0)}%)`);
  console.log(`    ${sumaTirado.toFixed(2)} € más a la basura`);
}
