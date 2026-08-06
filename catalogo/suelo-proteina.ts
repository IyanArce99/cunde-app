#!/usr/bin/env node --experimental-strip-types
/**
 * Calibra los tres niveles de proteína contra el recetario que hay. No genera
 * nada: barre el suelo contra el presupuesto y enseña dónde se rompe.
 *
 * Los números de GRAMOS_POR_NIVEL salen de aquí, no de una recomendación
 * nutricional: tienen que ser ALCANZABLES y su escala de precio tiene que ser
 * monótona, o el selector promete algo que el motor no puede montar.
 *
 * Hay que volver a correrlo cada vez que se amplía el recetario.
 *
 * Uso: node --experimental-strip-types catalogo/suelo-proteina.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generarSemana, GRAMOS_POR_NIVEL, RECETAS_POR_VARIEDAD, nutricionDe } from '../src/motor/seleccionar.ts';
import type { NivelProteina, Variedad } from '../src/motor/seleccionar.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const datos: DatosMotor = JSON.parse(
  fs.readFileSync(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'), 'utf8'),
);
const N = 2;
const PRESUPUESTO = 51;
const VARIEDADES: Variedad[] = ['poca', 'normal', 'mucha'];
const NIVELES: NivelProteina[] = ['basica', 'normal', 'alta'];

const semana = (variedad: Variedad, proteina: NivelProteina, presupuesto = PRESUPUESTO) =>
  generarSemana({ datos, N, numHuecos: 14, variedad, proteina, presupuesto });

// --- 1 · Barrido de gramos, para elegir los tres números --------------------

console.log(`BARRIDO DE SUELOS · ${PRESUPUESTO} € · ${N} personas · 14 huecos\n`);
console.log('suelo   poca              normal            mucha');
for (const gramos of [35, 40, 45, 50, 55, 60, 65, 70]) {
  const celdas = VARIEDADES.map((variedad) => {
    // Se inyecta el gramaje directamente para poder barrer sin tocar el enum.
    const original = GRAMOS_POR_NIVEL.normal;
    (GRAMOS_POR_NIVEL as Record<string, number>).normal = gramos;
    const s = semana(variedad, 'normal');
    (GRAMOS_POR_NIVEL as Record<string, number>).normal = original;
    const ok = s.cuadra ? '✓' : '✗';
    return `${s.nutricion.proteinaPorPersonaDia.toFixed(0)}g ${s.carrito.totalCarrito.toFixed(0)}€ ${ok}`.padEnd(18);
  });
  console.log(`${String(gramos).padStart(3)} g   ${celdas.join('')}`);
}

// --- 2 · Los tres niveles ya calibrados ------------------------------------

console.log(`\n\nLOS TRES NIVELES (${JSON.stringify(GRAMOS_POR_NIVEL)})\n`);
console.log('nivel    variedad  carrito  proteína  perecedero        recetas  suelo');
console.log('-'.repeat(76));
for (const proteina of NIVELES) {
  for (const variedad of VARIEDADES) {
    const s = semana(variedad, proteina);
    const c = s.carrito;
    const pct = c.totalCarrito ? (c.totalPerecedero / c.totalCarrito) * 100 : 0;
    console.log(
      `${proteina.padEnd(8)} ${variedad.padEnd(9)} ${c.totalCarrito.toFixed(2).padStart(6)} €`
      + `  ${s.nutricion.proteinaPorPersonaDia.toFixed(0).padStart(5)} g`
      + `  ${c.totalPerecedero.toFixed(2).padStart(5)} € (${pct.toFixed(1).padStart(4)}%)`
      + `  ${String(s.recetasDistintas.length).padStart(7)}  ${s.cuadra ? 'sí' : 'NO'}`,
    );
  }
  console.log();
}

// --- 3 · ¿Cuántas recetas distintas aguanta "mucha"? -----------------------
//
// El tope de 2 platos por base limita cuántas recetas distintas se pueden
// encadenar antes de caer en la cola barata del recetario. Se mide cuántas
// USA de verdad y con qué proteína, para poner un número honesto.

console.log(`\n¿CUÁNTAS RECETAS DISTINTAS AGUANTA DE VERDAD? (tope actual mucha=${RECETAS_POR_VARIEDAD.mucha})\n`);
console.log('tope  usadas  carrito  proteína  perecedero  cabe');
const original = RECETAS_POR_VARIEDAD.mucha;
for (const tope of [8, 9, 10, 11, 12, 13, 14]) {
  (RECETAS_POR_VARIEDAD as Record<string, number>).mucha = tope;
  const s = semana('mucha', 'normal');
  const c = s.carrito;
  const pct = c.totalCarrito ? (c.totalPerecedero / c.totalCarrito) * 100 : 0;
  console.log(
    `${String(tope).padStart(4)}  ${String(s.recetasDistintas.length).padStart(6)}`
    + `  ${c.totalCarrito.toFixed(2).padStart(6)} €  ${s.nutricion.proteinaPorPersonaDia.toFixed(0).padStart(6)} g`
    + `  ${pct.toFixed(1).padStart(9)}%  ${s.cuadra ? 'sí' : 'NO'}`,
  );
}
(RECETAS_POR_VARIEDAD as Record<string, number>).mucha = original;

// --- 4 · De dónde sale el perecedero ---------------------------------------

console.log('\n\nEL INTERCAMBIO: PROTEÍNA CONTRA DESPERDICIO\n');
console.log('nivel     poca                normal              mucha');
for (const proteina of NIVELES) {
  const celdas = VARIEDADES.map((variedad) => {
    const s = semana(variedad, proteina);
    const c = s.carrito;
    const pct = c.totalCarrito ? (c.totalPerecedero / c.totalCarrito) * 100 : 0;
    return `${s.nutricion.proteinaPorPersonaDia.toFixed(0)}g ${pct.toFixed(1)}% ${c.totalCarrito.toFixed(0)}€`.padEnd(20);
  });
  console.log(`${proteina.padEnd(9)} ${celdas.join('')}`);
}

// --- 5 · ¿Sale algo incomible? ---------------------------------------------
//
// Nueve semanas es mucho para leerlas enteras, pero hay dos cosas que sí hay
// que mirar una por una: que el fin de semana no coma calderilla y que no
// haya huecos sin llenar.

console.log('\n\nEL FIN DE SEMANA DE LAS NUEVE SEMANAS\n');
for (const proteina of NIVELES) {
  for (const variedad of VARIEDADES) {
    const s = semana(variedad, proteina);
    const finde = s.huecos.filter(
      (h) => (h.dia === 'SÁB' && h.ranura === 'cena') || (h.dia === 'DOM' && h.ranura === 'comida'),
    );
    const libres = s.huecos.filter((h) => h.tipo === 'libre').length;
    const texto = finde.map((h) => {
      const p = h.receta ? nutricionDe([h], datos, N, 0).proteinaPorPersonaDia * 7 : 0;
      return `${h.receta?.nombre ?? 'LIBRE'} (${p.toFixed(0)} g)`;
    }).join(' · ');
    console.log(`${proteina.padEnd(8)} ${variedad.padEnd(7)} ${libres ? `${libres} LIBRES · ` : ''}${texto}`);
  }
}
