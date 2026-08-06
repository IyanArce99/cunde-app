#!/usr/bin/env node --experimental-strip-types
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as M from '../src/motor/seleccionar.ts';
import { cartaDePostres } from '../src/motor/postres.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';
const aqui = path.dirname(fileURLToPath(import.meta.url));
const datos: DatosMotor = JSON.parse(fs.readFileSync(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'), 'utf8'));
const base = { datos, numHuecos: 14, esfuerzo: 'libre' as const, variedad: 'normal' as const, proteina: 'normal' as const, semanaNumero: 1 };

console.log('=== 1 · LA CARTA SEGÚN LAS RESTRICCIONES ===');
for (const ex of [[], ['Lactosa'], ['Vegetariano'], ['Vegano'], ['Vegano','Soja'], ['Lactosa','Huevo'], ['Cerdo']]) {
  const c = cartaDePostres(datos, ex);
  console.log(`  ${(ex.join('+')||'sin filtros').padEnd(18)} -> ${c.map(x=>x.ing.nombre).join(', ') || 'NINGUNO'}`);
}

console.log('\n=== 2 · ¿CUÁNTO SUBE LA CESTA? ===');
console.log('  pers  presup   sin postre   con postre   sube    ¿cabe?');
for (const N of [1, 2, 4]) {
  for (const presupuesto of [50, 65, 90]) {
    const sin = M.generarSemana({ ...base, N, presupuesto });
    const con = M.generarSemana({ ...base, N, presupuesto, postre: true });
    const sube = con.carrito.totalCarrito - sin.carrito.totalCarrito;
    console.log(`  ${String(N).padStart(4)}  ${String(presupuesto).padStart(5)} €`
      + `  ${sin.carrito.totalCarrito.toFixed(2).padStart(9)} €`
      + `  ${con.carrito.totalCarrito.toFixed(2).padStart(9)} €`
      + `  ${sube.toFixed(2).padStart(6)}`
      + `  ${con.carrito.totalCarrito <= presupuesto ? 'sí' : 'NO — SE PASA'}`);
  }
}

console.log('\n=== 3 · ¿QUÉ POSTRES Y CUÁNTOS? (2 personas, 65 €) ===');
const s = M.generarSemana({ ...base, N: 2, presupuesto: 65, postre: true });
for (const p of s.postres) {
  console.log(`  ${p.ingrediente.nombre.padEnd(22)} ${String(p.raciones).padStart(2)} raciones · ${p.porRacion} ${p.sku.unidad} c/u · SKU ${p.sku.sku}`);
}
const lineas = s.carrito.lineas.filter(l => l.canonicos.some(c => c.startsWith('postre_')));
console.log(`\n  líneas de postre en la lista de la compra: ${lineas.length}`);
for (const l of lineas) console.log(`    ${l.nombre.slice(0,38).padEnd(38)} ${l.compras}\u00d7 ${l.carritoCoste.toFixed(2)} € · sobra ${l.sobranteCantidad}`);
console.log(`  total postre en el carrito: ${lineas.reduce((a,l)=>a+l.carritoCoste,0).toFixed(2)} €`);

console.log('\n=== 4 · ¿SIGUE CUADRANDO LA SEMANA CON POSTRE? ===');
for (const ex of [[], ['Vegano'], ['Lactosa','Gluten']]) {
  const c = M.generarSemana({ ...base, N: 2, presupuesto: 65, postre: true, exclusiones: ex });
  const libres = c.huecos.filter(h => h.tipo === 'libre').length;
  console.log(`  ${(ex.join('+')||'sin filtros').padEnd(16)} carrito ${c.carrito.totalCarrito.toFixed(2)} € · ${libres} huecos vacíos · cuadra=${c.cuadra} · ${c.postres.length} postres`);
}
