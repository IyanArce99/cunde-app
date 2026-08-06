#!/usr/bin/env node --experimental-strip-types
/**
 * Los dos datos que van a salir en vivo bajo cada pregunta.
 * 1) ¿Cuánto cuesta calcular el suelo por comensales? (va en la pantalla 2/3)
 * 2) ¿Dónde está el acantilado real del recetario? Fuerza bruta sobre pares y
 *    tríos, no solo las combinaciones "razonables".
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { recetarioAdaptado, costesPorVariedad, generarSemana } from '../src/motor/seleccionar.ts';
import { ALERGIAS, DIETAS } from '../src/lib/restricciones.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const datos: DatosMotor = JSON.parse(fs.readFileSync(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'), 'utf8'));

console.log('=== 1 · SUELO POR COMENSALES (lo que iría bajo "¿cuántos sois?") ===');
console.log('N   suelo   ms');
for (const N of [1, 2, 3, 4, 5]) {
  const t = process.hrtime.bigint();
  const c = costesPorVariedad({ datos, N, numHuecos: 14, esfuerzo: 'libre', exclusiones: [], presupuesto: Infinity, variedad: 'poca', proteina: 'normal' });
  const ms = Number(process.hrtime.bigint() - t) / 1e6;
  console.log(`${N}   ${String(Math.ceil(c.poca.carrito)).padStart(3)} €   ${ms.toFixed(0)}`);
}

console.log('\n=== 2 · EL ACANTILADO (fuerza bruta) ===');
const todos = [...ALERGIAS, ...DIETAS];
const combos: string[][] = [];
for (let i = 0; i < todos.length; i++) {
  combos.push([todos[i]]);
  for (let j = i + 1; j < todos.length; j++) {
    combos.push([todos[i], todos[j]]);
    for (let k = j + 1; k < todos.length; k++) combos.push([todos[i], todos[j], todos[k]]);
  }
}
let peor = { ex: [] as string[], vivas: 999 };
const flojas: { ex: string[]; vivas: number }[] = [];
for (const ex of combos) {
  const vivas = recetarioAdaptado(datos, ex).length;
  if (vivas < peor.vivas) peor = { ex, vivas };
  if (vivas < 25) flojas.push({ ex, vivas });
}
console.log(`combinaciones probadas (1, 2 y 3 filtros): ${combos.length}`);
console.log(`la peor: ${peor.ex.join(' + ')} -> ${peor.vivas} recetas vivas`);
console.log(`combinaciones por debajo de 25 recetas: ${flojas.length}`);
flojas.sort((a, b) => a.vivas - b.vivas);
for (const f of flojas.slice(0, 12)) console.log(`  ${String(f.vivas).padStart(3)}  ${f.ex.join(' + ')}`);

console.log('\n=== 3 · ¿A PARTIR DE CUÁNTAS RECETAS SE ROMPE LA SEMANA? ===');
for (const f of flojas.slice(0, 6)) {
  const s = generarSemana({ datos, N: 2, numHuecos: 14, variedad: 'normal', presupuesto: 65, proteina: 'normal', exclusiones: f.ex, semanaNumero: 1 });
  const libres = s.huecos.filter((h) => h.tipo === 'libre').length;
  const distintos = new Set(s.tandas.map((t) => t.receta.id)).size;
  console.log(`  ${String(f.vivas).padStart(3)} vivas · ${f.ex.join(' + ').padEnd(34)} -> ${libres} huecos vacíos, ${distintos} platos distintos, ${s.carrito.toFixed(2)} €`);
}
