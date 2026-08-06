#!/usr/bin/env node --experimental-strip-types
/** ¿Por qué baja la cesta al añadir postre? Descomponer el número. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as M from '../src/motor/seleccionar.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';
const aqui = path.dirname(fileURLToPath(import.meta.url));
const datos: DatosMotor = JSON.parse(fs.readFileSync(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'), 'utf8'));
const base = { datos, N: 2, numHuecos: 14, esfuerzo: 'libre' as const, variedad: 'normal' as const, proteina: 'normal' as const, semanaNumero: 1, presupuesto: 65 };

const parte = (s: any) => {
  const post = s.carrito.lineas.filter((l: any) => l.canonicos.some((c: string) => c.startsWith('postre_')));
  const rec = s.carrito.lineas.filter((l: any) => !l.canonicos.some((c: string) => c.startsWith('postre_')));
  const sum = (a: any[], k: string) => a.reduce((x, l) => x + l[k], 0);
  return {
    total: s.carrito.totalCarrito,
    recetas: sum(rec, 'carritoCoste'),
    postres: sum(post, 'carritoCoste'),
    tirado: s.carrito.totalPerecedero,
    platos: new Set(s.tandas.map((t: any) => t.receta.id)).size,
    nombres: [...new Set(s.tandas.map((t: any) => t.receta.nombre))].sort(),
  };
};

const sin = parte(M.generarSemana({ ...base }));
const con = parte(M.generarSemana({ ...base, postre: true }));

console.log('                     SIN postre    CON postre');
console.log(`  total carrito     ${sin.total.toFixed(2).padStart(8)} €  ${con.total.toFixed(2).padStart(8)} €`);
console.log(`   · recetas        ${sin.recetas.toFixed(2).padStart(8)} €  ${con.recetas.toFixed(2).padStart(8)} €`);
console.log(`   · postres        ${sin.postres.toFixed(2).padStart(8)} €  ${con.postres.toFixed(2).padStart(8)} €`);
console.log(`  se tira           ${sin.tirado.toFixed(2).padStart(8)} €  ${con.tirado.toFixed(2).padStart(8)} €`);
console.log(`  platos distintos  ${String(sin.platos).padStart(8)}    ${String(con.platos).padStart(8)}`);
console.log(`\n  objetivo "normal" = minimizar (carrito + tirado):`);
console.log(`    sin postre: ${(sin.total + sin.tirado).toFixed(2)}`);
console.log(`    con postre: ${(con.total + con.tirado).toFixed(2)}`);

console.log('\n  platos SIN postre:', sin.nombres.join(', '));
console.log('\n  platos CON postre:', con.nombres.join(', '));

console.log('\n=== ¿Y SI EL PRESUPUESTO NO APRIETA? (120 €) ===');
const sinH = parte(M.generarSemana({ ...base, presupuesto: 120 }));
const conH = parte(M.generarSemana({ ...base, presupuesto: 120, postre: true }));
console.log(`  sin postre ${sinH.total.toFixed(2)} € (recetas ${sinH.recetas.toFixed(2)})`);
console.log(`  con postre ${conH.total.toFixed(2)} € (recetas ${conH.recetas.toFixed(2)} + postres ${conH.postres.toFixed(2)})`);
console.log(`  -> con el techo alto, el postre ${conH.total > sinH.total ? 'SUBE' : 'baja'} la cesta ${Math.abs(conH.total - sinH.total).toFixed(2)} €`);
