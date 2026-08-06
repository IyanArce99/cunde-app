#!/usr/bin/env node --experimental-strip-types
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { proteinaAnimal, proteinaPorRacion, consumoPorRacion } from '../src/motor/carrito.ts';
import { generarSemana } from '../src/motor/seleccionar.ts';
import type { Variedad } from '../src/motor/seleccionar.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const datos: DatosMotor = JSON.parse(fs.readFileSync(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'), 'utf8'));
const N = 2;
const PRESUPUESTO = 51;
const ETIQ = { cocinado: '        ', sobras: 'SOBRAS  ', ensamblaje: 'APROVECH', libre: 'LIBRE   ' };

// 1 · Techo de proteína
const lista = datos.recetas
  .map((r) => ({ r, p: proteinaPorRacion(r, datos, N), c: consumoPorRacion(r, datos, N), a: proteinaAnimal(r, datos) }))
  .sort((x, y) => y.p - x.p);
const usos = new Map<string, number>();
let suma = 0; let puestos = 0;
for (const x of lista) {
  if (puestos >= 14) break;
  const bases = new Set(x.r.ingredientes.map((i) => datos.ingredientes[i.canonico].base).filter(Boolean) as string[]);
  if ([...bases].some((b) => (usos.get(b) ?? 0) >= 2)) continue;
  for (const b of bases) usos.set(b, (usos.get(b) ?? 0) + 1);
  const h = Math.min(2, 14 - puestos);
  suma += x.p * N * h; puestos += h;
}
// Ojo al comparar con el 72 de la ronda anterior: aquel se midió sobre el peso
// de compra, contando hueso y espina como si fueran carne. No es comparable.
console.log(`1 · TECHO DE PROTEÍNA: ${(suma / (7 * N)).toFixed(0)} g/persona/día`);
console.log(`    recetas: ${datos.recetas.length} · con proteína animal fresca: ${lista.filter((x) => x.a === 'fresca').length}`);
console.log(`    en 1,00-1,60 €/ración con ≥25 g: ${lista.filter((x) => x.p >= 25 && x.c >= 1 && x.c <= 1.6).length}`);

// 2-5 · Las tres semanas
for (const variedad of ['poca', 'normal', 'mucha'] as Variedad[]) {
  const s = generarSemana({ datos, N, numHuecos: 14, variedad, presupuesto: PRESUPUESTO });
  const c = s.carrito;
  console.log(`\n═════ ${variedad.toUpperCase()} ═════`);
  for (const h of s.huecos) {
    if (!h.receta) { console.log(`  ${h.dia} ${h.ranura.padEnd(7)} LIBRE`); continue; }
    const p = proteinaPorRacion(h.receta, datos, N);
    const coste = h.tipo === 'sobras' ? 0 : consumoPorRacion(h.receta, datos, N);
    const marca = { ninguna: '  ', conserva: '·L', fresca: '★ ' }[proteinaAnimal(h.receta, datos)];
    console.log(`  ${h.dia} ${h.ranura.padEnd(7)} ${ETIQ[h.tipo]} ${marca} ${h.receta.nombre.padEnd(34)}${coste.toFixed(2)} €  ${p.toFixed(0).padStart(3)} g`);
  }
  console.log(
    `\n  Carrito ${c.totalCarrito.toFixed(2)} € de ${PRESUPUESTO} € = ${((c.totalCarrito / PRESUPUESTO) * 100).toFixed(0)}%`
    + ` ${s.cuadra ? '(cabe)' : '(SE PASA)'} · ${s.recetasDistintas.length} recetas · ${s.tandas.length} tandas`,
  );
  console.log(`  Proteína ${s.nutricion.proteinaPorPersonaDia.toFixed(0)} g/persona/día ${s.nutricion.cumpleSuelo ? '✓' : '✗'} (suelo 60)`);
  console.log(`  Animal ${s.nutricion.huecosConAnimal}/14 · fresca ${s.nutricion.huecosConFresca}`);
  console.log(`  Perecedero ${c.totalPerecedero.toFixed(2)} € (${((c.totalPerecedero / c.totalCarrito) * 100).toFixed(1)}%) · inventario ${c.totalInventario.toFixed(2)} € · despensa ${c.totalDespensa.toFixed(2)} €`);
}
