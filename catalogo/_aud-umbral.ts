#!/usr/bin/env node --experimental-strip-types
/** Barrido del umbral de rendimiento de la pasada de holgura. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as M from '../src/motor/seleccionar.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';
const aqui = path.dirname(fileURLToPath(import.meta.url));
const datos: DatosMotor = JSON.parse(fs.readFileSync(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'), 'utf8'));
const casos: [number, number][] = [[1,60],[1,75],[2,65],[2,80],[2,100],[4,110],[4,140],[3,95],[2,50],[4,90]];

console.log('  umbral | veces | gasta+   plato   armario  basura | basura total semana');
for (const umbral of [0, 0.4, 0.55, 0.7, 0.85, 1.1]) {
  let g=0,c=0,i=0,b=0,n=0,basuraTotal=0;
  for (const [N, presupuesto] of casos) {
    const base = { datos, N, numHuecos: 14, esfuerzo: 'libre' as const, variedad: 'normal' as const, proteina: 'normal' as const, semanaNumero: 1, presupuesto, rendimientoHolgura: umbral } as never;
    const off = M.generarSemana({ ...(base as object), sinHolgura: true } as never);
    const on = M.generarSemana({ ...(base as object), conHolgura: true } as never); // la pasada está apagada en producción desde el 13 oct 2026
    const dG = on.carrito.totalCarrito - off.carrito.totalCarrito;
    basuraTotal += on.carrito.totalPerecedero;
    if (dG <= 0.01) continue;
    n++; g+=dG; c+=on.carrito.totalConsumo-off.carrito.totalConsumo;
    i+=on.carrito.totalInventario-off.carrito.totalInventario;
    b+=on.carrito.totalPerecedero-off.carrito.totalPerecedero;
  }
  const p = (x:number) => g>0 ? `${(x/g*100).toFixed(0)}%`.padStart(6) : '     —';
  console.log(`  ${umbral.toFixed(2)}   |  ${String(n).padStart(2)}   | ${g.toFixed(0).padStart(5)} € ${p(c)}  ${p(i)}  ${p(b)} | ${basuraTotal.toFixed(2).padStart(6)} €`);
}
