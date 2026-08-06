#!/usr/bin/env node --experimental-strip-types
/** ¿Cierra el lote vegetal el agujero de proteína? Diez semanas encadenadas. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { proteinaPorRacion } from '../src/motor/carrito.ts';
import { generarSemana, recetarioAdaptado, SEMANAS_DE_MEMORIA } from '../src/motor/seleccionar.ts';
import type { NivelProteina, Variedad } from '../src/motor/seleccionar.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const datos: DatosMotor = JSON.parse(
  fs.readFileSync(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'), 'utf8'),
);
const N = 2;

const FILTROS: { nombre: string; exclusiones: string[]; esfuerzo?: 'minimo' }[] = [
  { nombre: 'sin filtro', exclusiones: [] },
  { nombre: 'vegetariano', exclusiones: ['Vegetariano'] },
  { nombre: 'vegano', exclusiones: ['Vegano'] },
  { nombre: 'vegetariano + sin gluten', exclusiones: ['Vegetariano', 'Gluten'] },
  { nombre: 'vegetariano + sin lactosa', exclusiones: ['Vegetariano', 'Lactosa'] },
  { nombre: 'vegano + sin gluten', exclusiones: ['Vegano', 'Gluten'] },
  { nombre: 'vegetariano + sin huevo', exclusiones: ['Vegetariano', 'Huevo'] },
  { nombre: 'vegetariano + lo mínimo', exclusiones: ['Vegetariano'], esfuerzo: 'minimo' },
];

console.log(`RECETARIO: ${datos.recetas.length} recetas\n`);
console.log('proteína disponible por filtro (a N=2)');
console.log('filtro                       vivas  >=25 g  >=28 g');
for (const f of FILTROS) {
  const vivas = recetarioAdaptado(datos, f.exclusiones, f.esfuerzo === 'minimo' ? 20 : Infinity);
  const p = vivas.map((r) => proteinaPorRacion(r, datos, N));
  console.log(
    `${f.nombre.padEnd(28)} ${String(vivas.length).padStart(5)}`
    + ` ${String(p.filter((x) => x >= 25).length).padStart(7)}`
    + ` ${String(p.filter((x) => x >= 28).length).padStart(7)}`,
  );
}

console.log('\n\nDIEZ SEMANAS ENCADENADAS · N=2 · 51 € · variedad normal · proteína normal (suelo 55 g)\n');
console.log('filtro                       cuadran  proteína media  carrito medio  solape  perecedero');
console.log('-'.repeat(92));
for (const f of FILTROS) {
  let historial: string[][] = [];
  const prot: number[] = [];
  const carr: number[] = [];
  const perec: number[] = [];
  const solapes: number[] = [];
  let cuadran = 0;
  let previa: string[] = [];

  for (let n = 1; n <= 10; n++) {
    const s = generarSemana({
      datos, N, numHuecos: 14, variedad: 'normal', proteina: 'normal', presupuesto: 51,
      exclusiones: f.exclusiones, esfuerzo: f.esfuerzo, semanaNumero: n, recetasRecientes: historial,
    });
    const recetas = [...new Set(s.tandas.map((t) => t.receta.id))];
    prot.push(s.nutricion.proteinaPorPersonaDia);
    carr.push(s.carrito.totalCarrito);
    perec.push(s.carrito.totalPerecedero);
    if (s.cuadra) cuadran++;
    if (n > 1) solapes.push(recetas.filter((r) => previa.includes(r)).length);
    previa = recetas;
    historial = [recetas, ...historial].slice(0, SEMANAS_DE_MEMORIA);
  }
  const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  console.log(
    `${f.nombre.padEnd(28)} ${String(cuadran).padStart(5)}/10`
    + ` ${media(prot).toFixed(0).padStart(13)} g`
    + ` ${media(carr).toFixed(2).padStart(14)} €`
    + ` ${media(solapes).toFixed(1).padStart(7)}`
    + ` ${media(perec).toFixed(2).padStart(10)} €`,
  );
}
