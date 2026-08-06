#!/usr/bin/env node --experimental-strip-types
/**
 * CURVA DE ESCALADO DEL RECETARIO — ¿es el cuello de botella o está saturado?
 *
 * Corta el recetario en prefijos deterministas (orden de crecimiento real:
 * 10 del piloto y luego los lotes por orden de fichero) y genera las 9
 * combinaciones variedad × proteína en cada corte. Si las métricas del corte
 * de 50 y el de 62 son iguales, añadir recetas ya no mueve la aguja.
 *
 * Uso: node --experimental-strip-types catalogo/_aud-escala.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generarSemana } from '../src/motor/seleccionar.ts';
import type { NivelProteina, Variedad, SemanaGenerada } from '../src/motor/seleccionar.ts';
import { consumoPorRacion, proteinaAnimal, proteinaPorRacion } from '../src/motor/carrito.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const datos: DatosMotor = JSON.parse(
  fs.readFileSync(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'), 'utf8'),
);

const N = 2;
const PRESUPUESTO = 51;
const NUM_HUECOS = 14;
const CORTES = [20, 30, 40, 50, 62];
const VARIEDADES: Variedad[] = ['poca', 'normal', 'mucha'];
const NIVELES: NivelProteina[] = ['basica', 'normal', 'alta'];

console.log(`CURVA DE ESCALADO · N=${N} · ${NUM_HUECOS} huecos · ${PRESUPUESTO} € · recetario total: ${datos.recetas.length}\n`);

// --- 1+2 · Las 45 semanas -------------------------------------------------

interface Celda {
  carrito: number;
  proteina: number;
  perecederoPct: number;
  cuadra: boolean;
  sinSemana: boolean;
  recetasUsadas: number;
}

const celdas = new Map<string, Celda>(); // clave: `${K}|${proteina}|${variedad}`
const t0 = Date.now();

for (const K of CORTES) {
  const datosK: DatosMotor = { ...datos, recetas: datos.recetas.slice(0, K) };
  for (const proteina of NIVELES) {
    for (const variedad of VARIEDADES) {
      const s: SemanaGenerada = generarSemana({
        datos: datosK, N, numHuecos: NUM_HUECOS, variedad, proteina, presupuesto: PRESUPUESTO,
      });
      const sinSemana = s.huecos.length === 0; // SEMANA_VACIA → sinCobertura
      const c = s.carrito;
      celdas.set(`${K}|${proteina}|${variedad}`, {
        carrito: c.totalCarrito,
        proteina: s.nutricion.proteinaPorPersonaDia,
        perecederoPct: c.totalCarrito ? (c.totalPerecedero / c.totalCarrito) * 100 : 0,
        cuadra: s.cuadra,
        sinSemana,
        recetasUsadas: s.recetasDistintas.length,
      });
    }
  }
}

console.log(`(45 llamadas a generarSemana en ${((Date.now() - t0) / 1000).toFixed(1)} s)\n`);

// Una tabla por nivel de proteína: filas = K, columnas = variedad.
// Celda: carrito € | proteína g | perecedero % | ✓ cuadra / ✗ no cuadra / — sin semana

for (const proteina of NIVELES) {
  console.log(`\nPROTEÍNA ${proteina.toUpperCase()}  (celda: carrito € · prot g/p/d · perec % · cuadra)`);
  console.log('  K   ' + VARIEDADES.map((v) => v.padEnd(26)).join(''));
  console.log('-'.repeat(84));
  for (const K of CORTES) {
    const cols = VARIEDADES.map((variedad) => {
      const c = celdas.get(`${K}|${proteina}|${variedad}`)!;
      if (c.sinSemana) return 'SIN SEMANA'.padEnd(26);
      const marca = c.cuadra ? 'si' : 'NO';
      return `${c.carrito.toFixed(2).padStart(6)}€ ${c.proteina.toFixed(0).padStart(3)}g ${c.perecederoPct.toFixed(1).padStart(4)}% ${marca}`.padEnd(26);
    });
    console.log(`${String(K).padStart(3)}   ${cols.join('')}`);
  }
}

// --- 3 · Deltas 50→62 y saturación ----------------------------------------

console.log('\n\nDELTAS ENTRE CORTES CONSECUTIVOS (media de las 9 celdas con semana en ambos cortes)');
console.log('salto     Δcarrito€  Δprot g  Δperec pp  cuadran(antes→después)  sin semana(antes→después)');
console.log('-'.repeat(92));
for (let i = 1; i < CORTES.length; i++) {
  const a = CORTES[i - 1];
  const b = CORTES[i];
  let dC = 0; let dP = 0; let dW = 0; let n = 0;
  let cuadraA = 0; let cuadraB = 0; let sinA = 0; let sinB = 0;
  for (const proteina of NIVELES) {
    for (const variedad of VARIEDADES) {
      const ca = celdas.get(`${a}|${proteina}|${variedad}`)!;
      const cb = celdas.get(`${b}|${proteina}|${variedad}`)!;
      if (ca.cuadra) cuadraA++;
      if (cb.cuadra) cuadraB++;
      if (ca.sinSemana) sinA++;
      if (cb.sinSemana) sinB++;
      if (ca.sinSemana || cb.sinSemana) continue;
      dC += cb.carrito - ca.carrito;
      dP += cb.proteina - ca.proteina;
      dW += cb.perecederoPct - ca.perecederoPct;
      n++;
    }
  }
  console.log(
    `${a}→${b}`.padEnd(9)
    + `  ${(dC / n).toFixed(2).padStart(8)}`
    + `  ${(dP / n).toFixed(1).padStart(7)}`
    + `  ${(dW / n).toFixed(1).padStart(9)}`
    + `  ${String(cuadraA).padStart(2)}/9 → ${cuadraB}/9`.padEnd(24)
    + `  ${sinA}/9 → ${sinB}/9`,
  );
}

// Detalle celda a celda del salto 50→62, que es la pregunta central.
console.log('\nSALTO 50→62 CELDA A CELDA');
console.log('nivel    variedad  carrito 50→62      prot 50→62    perec 50→62     cuadra');
console.log('-'.repeat(80));
for (const proteina of NIVELES) {
  for (const variedad of VARIEDADES) {
    const c50 = celdas.get(`50|${proteina}|${variedad}`)!;
    const c62 = celdas.get(`62|${proteina}|${variedad}`)!;
    const f = (c: Celda, fn: (x: Celda) => string) => (c.sinSemana ? '—' : fn(c));
    console.log(
      `${proteina.padEnd(8)} ${variedad.padEnd(9)}`
      + ` ${f(c50, (c) => c.carrito.toFixed(2)).padStart(6)}→${f(c62, (c) => c.carrito.toFixed(2)).padEnd(6)}`
      + `   ${f(c50, (c) => c.proteina.toFixed(0)).padStart(4)}→${f(c62, (c) => c.proteina.toFixed(0)).padEnd(4)}g`
      + `   ${f(c50, (c) => c.perecederoPct.toFixed(1)).padStart(5)}→${f(c62, (c) => c.perecederoPct.toFixed(1)).padEnd(5)}%`
      + `   ${c50.cuadra ? 'si' : 'NO'}→${c62.cuadra ? 'si' : 'NO'}`,
    );
  }
}

// --- 4 · Composición de cada corte ----------------------------------------
//
// La curva la explica lo que entra en cada lote: cuántas recetas de proteína
// animal FRESCA hay, y cuántas caen en la banda "caballo de batalla"
// (1,00–1,60 €/ración con ≥25 g de proteína) que es la que permite cumplir
// suelo sin reventar presupuesto.

console.log('\n\nCOMPOSICIÓN DE CADA CORTE (consumo y proteína por ración a N=2)');
console.log('  K   frescas          banda 1,00–1,60 €/racion y ≥25 g');
console.log('-'.repeat(60));
const compo = new Map<number, { frescas: number; banda: number }>();
for (const K of CORTES) {
  const sub = datos.recetas.slice(0, K);
  let frescas = 0;
  let banda = 0;
  for (const r of sub) {
    if (proteinaAnimal(r, datos) === 'fresca') frescas++;
    const coste = consumoPorRacion(r, datos, N);
    const prot = proteinaPorRacion(r, datos, N);
    if (coste >= 1.0 && coste <= 1.6 && prot >= 25) banda++;
  }
  compo.set(K, { frescas, banda });
  console.log(
    `${String(K).padStart(3)}   ${String(frescas).padStart(2)} (${((frescas / K) * 100).toFixed(0).padStart(3)}%)`
    + `        ${String(banda).padStart(2)} (${((banda / K) * 100).toFixed(0).padStart(3)}%)`,
  );
}

// Qué aporta cada tramo nuevo (las recetas que entran entre corte y corte).
console.log('\nQUÉ TRAE CADA TRAMO NUEVO DE RECETAS');
console.log('tramo    nuevas  frescas  banda');
console.log('-'.repeat(36));
for (let i = 0; i < CORTES.length; i++) {
  const desde = i === 0 ? 0 : CORTES[i - 1];
  const hasta = CORTES[i];
  const tramo = datos.recetas.slice(desde, hasta);
  let frescas = 0;
  let banda = 0;
  for (const r of tramo) {
    if (proteinaAnimal(r, datos) === 'fresca') frescas++;
    const coste = consumoPorRacion(r, datos, N);
    const prot = proteinaPorRacion(r, datos, N);
    if (coste >= 1.0 && coste <= 1.6 && prot >= 25) banda++;
  }
  console.log(
    `${`${desde}–${hasta}`.padEnd(8)} ${String(tramo.length).padStart(5)}`
    + `  ${String(frescas).padStart(6)}  ${String(banda).padStart(5)}`,
  );
}

console.log(`\nTotal: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
