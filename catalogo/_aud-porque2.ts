#!/usr/bin/env node --experimental-strip-types
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as M from '../src/motor/seleccionar.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';
const aqui = path.dirname(fileURLToPath(import.meta.url));
const datos: DatosMotor = JSON.parse(fs.readFileSync(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'), 'utf8'));
const base = { datos, N: 2, numHuecos: 14, esfuerzo: 'libre' as const, variedad: 'normal' as const, proteina: 'normal' as const, semanaNumero: 1, presupuesto: 65 };

const parte = (s: any) => {
  const noDesp = s.carrito.lineas.filter((l: any) => !l.esDespensa);
  const esPostre = (l: any) => l.canonicos.some((c: string) => c.startsWith('postre_'));
  const sum = (a: any[]) => a.reduce((x, l) => x + l.carritoCoste, 0);
  return {
    total: s.carrito.totalCarrito,
    recetas: sum(noDesp.filter((l: any) => !esPostre(l))),
    postres: sum(noDesp.filter(esPostre)),
    tirado: s.carrito.totalPerecedero,
    prote: s.nutricion.proteinaPorPersonaDia,
  };
};

const sin = parte(M.generarSemana({ ...base }));
const con = parte(M.generarSemana({ ...base, postre: true }));
console.log('                  SIN postre    CON postre');
console.log(`  recetas        ${sin.recetas.toFixed(2).padStart(8)} €  ${con.recetas.toFixed(2).padStart(8)} €`);
console.log(`  postres        ${sin.postres.toFixed(2).padStart(8)} €  ${con.postres.toFixed(2).padStart(8)} €`);
console.log(`  TOTAL          ${sin.total.toFixed(2).padStart(8)} €  ${con.total.toFixed(2).padStart(8)} €`);
console.log(`  se tira        ${sin.tirado.toFixed(2).padStart(8)} €  ${con.tirado.toFixed(2).padStart(8)} €`);
console.log(`  proteína g/p/d ${sin.prote.toFixed(0).padStart(8)}    ${con.prote.toFixed(0).padStart(8)}`);

console.log('\n=== LA HIPÓTESIS: el motor deja de buscar en cuanto algo "cabe" ===');
console.log('  construirMejor prueba 8 semillas; solo escala a 24 y luego a 112');
console.log('  si con 8 NO consigue suelo+presupuesto.\n');
const ms = (f: () => any) => { const t = process.hrtime.bigint(); const r = f(); return { r, ms: Number(process.hrtime.bigint() - t) / 1e6 }; };
for (const [etiqueta, pet] of [['sin postre', { ...base }], ['con postre', { ...base, postre: true }]] as const) {
  const { r, ms: t } = ms(() => M.generarSemana(pet as never));
  console.log(`  ${etiqueta}: ${t.toFixed(0)} ms  (si tarda 3-4x más, es que ha escalado a todas las semillas)`);
}
