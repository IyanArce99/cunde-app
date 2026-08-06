#!/usr/bin/env node --experimental-strip-types
/** Números del motor de selección. node --experimental-strip-types informe.ts */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { consumoPorRacion } from '../src/motor/carrito.ts';
import { generarSemana, preciosPorVariedad, rehacerDesde } from '../src/motor/seleccionar.ts';
import type { Variedad } from '../src/motor/seleccionar.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const datos: DatosMotor = JSON.parse(
  fs.readFileSync(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'), 'utf8'),
);

const VARIEDADES: Variedad[] = ['poca', 'normal', 'mucha'];
const pct = (a: number, b: number) => `${((a / b) * 100).toFixed(1)}%`;

console.log('=== 1 y 3 · Carrito, perecedero y recetas distintas (14 huecos) ===\n');
for (const N of [2, 4]) {
  console.log(`N=${N}`);
  for (const variedad of VARIEDADES) {
    const s = generarSemana({ datos, N, numHuecos: 14, variedad });
    const cocinados = s.huecos.filter((h) => h.tipo === 'cocinado').length;
    const sobras = s.huecos.filter((h) => h.tipo === 'sobras').length;
    const ensamblaje = s.huecos.filter((h) => h.tipo === 'ensamblaje').length;
    console.log(
      `  ${variedad.padEnd(7)} carrito ${s.carrito.totalCarrito.toFixed(2).padStart(6)} € · ` +
      `perecedero ${s.carrito.totalPerecedero.toFixed(2).padStart(5)} € (${pct(s.carrito.totalPerecedero, s.carrito.totalCarrito).padStart(5)}) · ` +
      `inventario ${s.carrito.totalInventario.toFixed(2).padStart(5)} € · despensa ${s.carrito.totalDespensa.toFixed(2)} € · ` +
      `${s.recetasDistintas.length} recetas · ${s.tandas.length} tandas · ` +
      `${cocinados} cocinados / ${sobras} sobras / ${ensamblaje} ensamblaje`,
    );
  }
  console.log();
}

console.log('=== 4 · Menú completo de "normal" para N=2 ===\n');
const normal = generarSemana({ datos, N: 2, numHuecos: 14, variedad: 'normal' });
for (const h of normal.huecos) {
  const etiqueta = { cocinado: 'cocinas ', sobras: 'sobras  ', ensamblaje: 'montas  ', libre: 'libre   ' }[h.tipo];
  const coste = h.tipo === 'cocinado'
    ? consumoPorRacion(h.receta!, datos, 2)
    : h.tipo === 'ensamblaje'
      ? consumoPorRacion(h.receta!, datos, 2, 'acompanamiento')
      : 0;
  console.log(`  ${h.dia} ${h.ranura.padEnd(7)} ${etiqueta} ${(h.receta?.nombre ?? '—').padEnd(26)} ${coste.toFixed(2)} €/ración`);
}
console.log(`\n  Recetas distintas: ${normal.recetasDistintas.join(', ')}`);

console.log('\n=== Precio de cada nivel de variedad (lo que ve el usuario al elegir) ===\n');
for (const N of [2, 4]) {
  for (const numHuecos of [7, 14]) {
    const p = preciosPorVariedad({ datos, N, numHuecos });
    console.log(`  N=${N}, ${numHuecos} huecos: poca ${p.poca.toFixed(2)} € · normal ${p.normal.toFixed(2)} € · mucha ${p.mucha.toFixed(2)} €`);
  }
}

console.log('\n=== 3b · Tocar un hueco de sobras: se rehace de verdad ===\n');
const iSobras = normal.huecos.findIndex((h) => h.tipo === 'sobras');
if (iSobras >= 0) {
  const h = normal.huecos[iSobras];
  console.log(`  Toco ${h.dia} ${h.ranura} (${h.tipo}: ${h.receta?.nombre})`);
  for (const retoque of ['cambiar', 'barato', 'libre'] as const) {
    const nueva = rehacerDesde({ datos, N: 2, numHuecos: 14, variedad: 'normal' }, normal, iSobras, retoque);
    const cambiados = nueva.huecos.filter(
      (x, i) => x.receta?.id !== normal.huecos[i]?.receta?.id || x.tipo !== normal.huecos[i]?.tipo,
    ).length;
    console.log(
      `    ${retoque.padEnd(8)} -> ${nueva.huecos[iSobras].tipo.padEnd(10)} ${(nueva.huecos[iSobras].receta?.nombre ?? '—').padEnd(24)}` +
      ` carrito ${nueva.carrito.totalCarrito.toFixed(2)} € (${(nueva.carrito.totalCarrito - normal.carrito.totalCarrito >= 0 ? '+' : '')}${(nueva.carrito.totalCarrito - normal.carrito.totalCarrito).toFixed(2)} €) · ${cambiados} huecos cambian`,
    );
  }
}

console.log('\n=== 5 · Margen del recetario: cuántas opciones tiene el motor ===\n');
for (const variedad of VARIEDADES) {
  const s = generarSemana({ datos, N: 2, numHuecos: 14, variedad });
  const usadas = new Set(s.tandas.map((t) => t.receta.id));
  console.log(`  ${variedad.padEnd(7)} usa ${usadas.size} de ${datos.recetas.length} · sobran ${datos.recetas.length - usadas.size} sin usar`);
}
