#!/usr/bin/env node --experimental-strip-types
/**
 * ¿A dónde va el euro que gasta la pasada de holgura? Tres destinos posibles:
 *   · al plato    (consumo)      -> es lo que se quiere
 *   · al armario  (inventario)   -> vale, se usa la semana que viene
 *   · a la basura (perecedero)   -> es pérdida
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as M from '../src/motor/seleccionar.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';
const aqui = path.dirname(fileURLToPath(import.meta.url));
const datos: DatosMotor = JSON.parse(fs.readFileSync(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'), 'utf8'));

const casos: [number, number][] = [[1,60],[1,75],[2,65],[2,80],[2,100],[4,110],[4,140],[3,95]];
console.log('  caso     | gasta de más |  al plato    al armario   a la basura');
let g=0, c=0, i=0, b=0;
for (const [N, presupuesto] of casos) {
  const base = { datos, N, numHuecos: 14, esfuerzo: 'libre' as const, variedad: 'normal' as const, proteina: 'normal' as const, semanaNumero: 1, presupuesto };
  const off = M.generarSemana({ ...base, sinHolgura: true });
  const on = M.generarSemana({ ...base });
  const dG = on.carrito.totalCarrito - off.carrito.totalCarrito;
  if (dG <= 0.01) { console.log(`  N=${N} ${String(presupuesto).padStart(3)} € | no se activó`); continue; }
  const dC = on.carrito.totalConsumo - off.carrito.totalConsumo;
  const dI = on.carrito.totalInventario - off.carrito.totalInventario;
  const dB = on.carrito.totalPerecedero - off.carrito.totalPerecedero;
  g+=dG; c+=dC; i+=dI; b+=dB;
  const pct = (x: number) => `${(x/dG*100).toFixed(0)}%`.padStart(5);
  console.log(`  N=${N} ${String(presupuesto).padStart(3)} € | ${dG.toFixed(2).padStart(9)} €  | `
    + `${dC.toFixed(2).padStart(6)} ${pct(dC)}  ${dI.toFixed(2).padStart(6)} ${pct(dI)}  ${dB.toFixed(2).padStart(6)} ${pct(dB)}`);
}
console.log(`\n  TOTAL: gasta ${g.toFixed(2)} € de más`);
console.log(`    al plato    ${c.toFixed(2).padStart(7)} €  ${(c/g*100).toFixed(0)}%`);
console.log(`    al armario  ${i.toFixed(2).padStart(7)} €  ${(i/g*100).toFixed(0)}%`);
console.log(`    a la basura ${b.toFixed(2).padStart(7)} €  ${(b/g*100).toFixed(0)}%`);
console.log(`    sin explicar ${(g-c-i-b).toFixed(2).padStart(6)} €`);
console.log(`\n  Recuperado (plato + armario): ${((c+i)/g*100).toFixed(0)}%`);
