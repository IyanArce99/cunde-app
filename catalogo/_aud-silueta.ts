#!/usr/bin/env node --experimental-strip-types
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as M from '../src/motor/seleccionar.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';
const aqui = path.dirname(fileURLToPath(import.meta.url));
const datos: DatosMotor = JSON.parse(fs.readFileSync(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'), 'utf8'));
const BASE = { datos, N: 2, numHuecos: 14, presupuesto: 51, variedad: 'poca' as const, proteina: 'normal' as const };

console.log('  umbral   semana  silueta          carrito  cocinados');
for (const umbral of [0, 0.55]) {
  for (const n of [5, 6, 7, 8]) {
    const s = M.generarSemana({ ...BASE, semanaNumero: n, rendimientoHolgura: umbral } as never);
    const forma = s.huecos.map(h => h.tipo === 'cocinado' ? 'C' : 's').join('');
    console.log(`  ${umbral.toFixed(2)}       ${n}     ${forma}  ${s.carrito.totalCarrito.toFixed(2).padStart(6)} €   ${forma.split('C').length - 1}`);
  }
  console.log('');
}
