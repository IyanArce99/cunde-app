#!/usr/bin/env node --experimental-strip-types
/**
 * Diagnóstico de cobertura del recetario. No genera nada: mide qué queda en
 * pie con cada restricción dietética y si el motor puede montar la semana.
 *
 * Uso: node --experimental-strip-types cobertura.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { consumoPorRacion } from '../src/motor/carrito.ts';
import { rindeEfectivo } from '../src/motor/reparto.ts';
import {
  generarSemana, recetaPermitida, RECETAS_POR_VARIEDAD, TANDAS_POR_RECETA_POR_VARIEDAD,
} from '../src/motor/seleccionar.ts';
import type { DatosMotor, Receta } from '../src/motor/tipos.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const datos: DatosMotor = JSON.parse(
  fs.readFileSync(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'), 'utf8'),
);

const N = 2;
const HUECOS = 14;

/**
 * Los filtros tal y como los ofrece AjustesSemana, más las combinaciones. El
 * esfuerzo también filtra (recorta por minutos) y se cuenta aquí: es el mismo
 * mecanismo y rompe igual.
 */
const FILTROS: { nombre: string; exclusiones: string[]; minutos?: number }[] = [
  { nombre: 'sin filtro', exclusiones: [] },
  { nombre: 'vegetariano', exclusiones: ['Vegetariano'] },
  { nombre: 'vegano', exclusiones: ['Vegano'] },
  { nombre: 'sin gluten', exclusiones: ['Gluten'] },
  { nombre: 'sin lactosa', exclusiones: ['Lactosa'] },
  { nombre: 'sin cerdo', exclusiones: ['Cerdo'] },
  { nombre: 'sin pescado ni marisco', exclusiones: ['Pescado', 'Marisco'] },
  { nombre: 'sin frutos secos', exclusiones: ['Frutos secos'] },
  { nombre: 'sin apio', exclusiones: ['Apio'] },
  { nombre: 'sin soja', exclusiones: ['Soja'] },
  { nombre: 'sin sulfitos', exclusiones: ['Sulfitos'] },
  { nombre: 'sin huevo (alergia)', exclusiones: ['Huevo'] },
  { nombre: 'sin cacahuete', exclusiones: ['Cacahuete'] },
  { nombre: 'sin sésamo', exclusiones: ['Sésamo'] },
  { nombre: 'sin mostaza', exclusiones: ['Mostaza'] },
  { nombre: 'sin huevo + sin gluten', exclusiones: ['Huevo', 'Gluten'] },
  { nombre: 'sin huevo + sin lactosa', exclusiones: ['Huevo', 'Lactosa'] },
  { nombre: 'vegetariano + sin huevo', exclusiones: ['Vegetariano', 'Huevo'] },
  { nombre: 'vegetariano + sin gluten', exclusiones: ['Vegetariano', 'Gluten'] },
  { nombre: 'vegetariano + sin lactosa', exclusiones: ['Vegetariano', 'Lactosa'] },
  { nombre: 'sin gluten + sin lactosa', exclusiones: ['Gluten', 'Lactosa'] },
  { nombre: 'esfuerzo: lo mínimo (20 min)', exclusiones: [], minutos: 20 },
  { nombre: 'esfuerzo: lo normal (40 min)', exclusiones: [], minutos: 40 },
  { nombre: 'vegetariano + lo mínimo', exclusiones: ['Vegetariano'], minutos: 20 },
];

const coste = (r: Receta) => consumoPorRacion(r, datos, N);
const rinde = (r: Receta) => rindeEfectivo(r, 'principal', HUECOS);

/**
 * Cobertura máxima teórica: cada receta puede cocinarse tantas veces como
 * permita el nivel de variedad, y cada tanda cubre `rinde` huecos. Con las K
 * mejores (las que más rinden) hay que llegar a 14.
 */
function coberturaMaxima(recetas: Receta[], tope: number, variedad: 'poca' | 'normal' | 'mucha'): number {
  return [...recetas]
    .sort((a, b) => rinde(b) - rinde(a))
    .slice(0, tope)
    .reduce((a, r) => a + rinde(r) * TANDAS_POR_RECETA_POR_VARIEDAD[variedad], 0);
}

function intentar(exclusiones: string[], variedad: 'poca' | 'normal' | 'mucha', minutos?: number) {
  try {
    const esfuerzo = minutos === 20 ? 'minimo' : minutos === 40 ? 'normal' : 'libre';
    const s = generarSemana({ datos, N, numHuecos: HUECOS, variedad, exclusiones, esfuerzo });
    if (s.huecos.length < HUECOS) return { ok: false, detalle: 'incompleta' };
    return { ok: true, detalle: `${s.recetasDistintas.length}r ${s.carrito.totalCarrito.toFixed(0)}€` };
  } catch {
    return { ok: false, detalle: 'imposible' };
  }
}

// --- Matriz de cobertura -----------------------------------------------------

console.log(`MATRIZ DE COBERTURA · 14 huecos · N=2 · ${datos.recetas.length} recetas\n`);
const cabecera = (['poca', 'normal', 'mucha'] as const)
  .map((v) => `${v}(${RECETAS_POR_VARIEDAD[v]})`.padEnd(13)).join('');
console.log(`filtro                       vivas  rinde2  cob.máx  ${cabecera}€/ración`);
console.log('-'.repeat(112));

for (const { nombre, exclusiones, minutos } of FILTROS) {
  const vivas = datos.recetas.filter((r) => recetaPermitida(r, exclusiones, minutos ?? Infinity, datos.ingredientes));
  const conRinde2 = vivas.filter((r) => rinde(r) >= 2).length;
  const medio = vivas.length ? vivas.reduce((a, r) => a + coste(r), 0) / vivas.length : 0;

  const celdas = (['poca', 'normal', 'mucha'] as const).map((v) => {
    const tope = Math.min(RECETAS_POR_VARIEDAD[v], vivas.length);
    const cob = coberturaMaxima(vivas, tope, v);
    if (cob < HUECOS) return `NO (cob ${cob})`.padEnd(12);
    const r = intentar(exclusiones, v, minutos);
    return (r.ok ? `sí · ${r.detalle}` : `NO (${r.detalle})`).padEnd(12);
  });

  console.log(
    `${nombre.padEnd(27)} ${String(vivas.length).padStart(4)}  ${String(conRinde2).padStart(6)}` +
    `  ${String(coberturaMaxima(vivas, vivas.length, 'poca')).padStart(7)}  ${celdas.join(' ')} ${medio.toFixed(2)} €`,
  );
}

// --- Reparto actual de las 10 -----------------------------------------------

function repartir(titulo: string, clave: (r: Receta) => string) {
  const grupos = new Map<string, Receta[]>();
  for (const r of datos.recetas) {
    const k = clave(r);
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k)!.push(r);
  }
  console.log(`\n${titulo}`);
  for (const [k, rs] of [...grupos].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${k.padEnd(16)} ${String(rs.length).padStart(2)}  ${rs.map((r) => r.nombre).join(', ')}`);
  }
}

console.log('\n\nREPARTO ACTUAL DE LAS 10');
repartir('Por proteína principal', (r) => r.proteina);
repartir('Por técnica', (r) => r.tecnica);
repartir('Por rinde (huecos que cubre una tanda)', (r) => `rinde ${rinde(r)}`);
repartir('Por tramo de coste por ración', (r) => {
  const c = coste(r);
  if (c < 1) return '< 1,00 €';
  if (c <= 1.5) return '1,00-1,50 €';
  return '> 1,50 €';
});

// --- Qué atributo bloquea a cada receta --------------------------------------

console.log('\n\nQUÉ EXCLUYE A CADA RECETA (para saber qué encargar)');
const ATRIBUTOS = ['Vegetariano', 'Vegano', 'Gluten', 'Lactosa', 'Pescado'];
console.log(`  ${'receta'.padEnd(26)} ${ATRIBUTOS.map((a) => a.slice(0, 6).padEnd(7)).join('')} rinde  €/ración`);
for (const r of datos.recetas) {
  const marcas = ATRIBUTOS.map((a) => (recetaPermitida(r, [a], Infinity, datos.ingredientes) ? '·      ' : 'FUERA  '));
  console.log(`  ${r.nombre.padEnd(26)} ${marcas.join('')} ${rinde(r)}      ${coste(r).toFixed(2)} €`);
}
