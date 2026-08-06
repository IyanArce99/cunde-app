#!/usr/bin/env node --experimental-strip-types
/**
 * AUDITORÍA — USO REAL DEL RECETARIO
 *
 * ¿Cuántas de las 62 recetas usa DE VERDAD el motor, y qué perfil tienen las
 * que nunca salen? Se genera una parrilla determinista de 42 semanas
 * (4 contextos × 9 combinaciones variedad×proteína + 6 variantes con
 * exclusiones/esfuerzo) y se acumula la frecuencia POR SEMANA de cada receta.
 *
 * No modifica nada: solo llama a generarSemana y a las funciones de medida.
 *
 * Uso: node --experimental-strip-types catalogo/_aud-uso.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generarSemana } from '../src/motor/seleccionar.ts';
import type { NivelProteina, Variedad } from '../src/motor/seleccionar.ts';
import { consumoPorRacion, proteinaAnimal, proteinaPorRacion } from '../src/motor/carrito.ts';
import { rindeEfectivo } from '../src/motor/reparto.ts';
import type { DatosMotor, Receta } from '../src/motor/tipos.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const datos: DatosMotor = JSON.parse(
  fs.readFileSync(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'), 'utf8'),
);

const VARIEDADES: Variedad[] = ['poca', 'normal', 'mucha'];
const NIVELES: NivelProteina[] = ['basica', 'normal', 'alta'];

// --- La parrilla ------------------------------------------------------------

interface Caso {
  etiqueta: string;
  N: number;
  presupuesto: number;
  variedad: Variedad;
  proteina: NivelProteina;
  exclusiones?: string[];
  esfuerzo?: 'minimo' | 'normal' | 'libre';
}

const casos: Caso[] = [];
const contextos = [
  { N: 2, presupuesto: 51 },
  { N: 1, presupuesto: 30 },
  { N: 4, presupuesto: 90 },
  { N: 2, presupuesto: 70 },
];
for (const c of contextos) {
  for (const variedad of VARIEDADES) {
    for (const proteina of NIVELES) {
      casos.push({ etiqueta: `N${c.N}/${c.presupuesto}€/${variedad}/${proteina}`, ...c, variedad, proteina });
    }
  }
}
for (const exclusion of ['Vegetariano', 'Vegano', 'Gluten', 'Huevo', 'Lactosa']) {
  casos.push({
    etiqueta: `N2/51€/normal/normal/${exclusion}`,
    N: 2, presupuesto: 51, variedad: 'normal', proteina: 'normal', exclusiones: [exclusion],
  });
}
casos.push({
  etiqueta: 'N2/51€/normal/normal/esfuerzo=minimo',
  N: 2, presupuesto: 51, variedad: 'normal', proteina: 'normal', esfuerzo: 'minimo',
});

// --- Generar y acumular -----------------------------------------------------

const frecuencia = new Map<string, number>(); // recetaId → nº de SEMANAS en que aparece
let semanasOk = 0;
let semanasCuadran = 0;
let semanasSinCobertura = 0;
const detallePorCaso: {
  etiqueta: string; recetas: number; carrito: number; cuadra: boolean;
  protDia: number; cumpleSuelo: boolean; motivo: string;
}[] = [];

const t0 = Date.now();
for (const caso of casos) {
  const s = generarSemana({
    datos,
    N: caso.N,
    numHuecos: 14,
    variedad: caso.variedad,
    proteina: caso.proteina,
    presupuesto: caso.presupuesto,
    exclusiones: caso.exclusiones,
    esfuerzo: caso.esfuerzo,
  });
  if (s.sinCobertura) {
    semanasSinCobertura++;
    detallePorCaso.push({
      etiqueta: caso.etiqueta, recetas: 0, carrito: 0, cuadra: false,
      protDia: 0, cumpleSuelo: false, motivo: 'sin cobertura',
    });
    continue;
  }
  semanasOk++;
  if (s.cuadra) semanasCuadran++;
  const ids = new Set(s.tandas.map((t) => t.receta.id));
  for (const id of ids) frecuencia.set(id, (frecuencia.get(id) ?? 0) + 1);
  detallePorCaso.push({
    etiqueta: caso.etiqueta,
    recetas: ids.size,
    carrito: s.carrito.totalCarrito,
    cuadra: s.cuadra,
    protDia: s.nutricion.proteinaPorPersonaDia,
    cumpleSuelo: s.nutricion.cumpleSuelo,
    motivo: s.cuadra ? '' : (s.salida?.motivo ?? ''),
  });
}
const segundos = (Date.now() - t0) / 1000;

// --- Perfil de cada receta (medido con N=2, el caso de referencia) ----------

const N_REF = 2;

function basesDe(r: Receta): string[] {
  return [...new Set(
    r.ingredientes.map((i) => datos.ingredientes[i.canonico].base).filter(Boolean) as string[],
  )].sort((a, b) => a.localeCompare(b));
}

interface Perfil {
  receta: Receta;
  usos: number;
  euros: number;
  proteinaG: number;
  rinde: number;
  animal: 'ninguna' | 'conserva' | 'fresca';
  minutos: number;
  bases: string[];
}

const perfiles: Perfil[] = datos.recetas.map((r) => ({
  receta: r,
  usos: frecuencia.get(r.id) ?? 0,
  euros: consumoPorRacion(r, datos, N_REF),
  proteinaG: proteinaPorRacion(r, datos, N_REF),
  rinde: rindeEfectivo(r, 'principal', 14),
  animal: proteinaAnimal(r, datos),
  minutos: r.minutos,
  bases: basesDe(r),
}));

const usadas = perfiles.filter((p) => p.usos > 0);
const nuncaUsadas = perfiles.filter((p) => p.usos === 0);

// --- Informe ----------------------------------------------------------------

console.log(`PARRILLA: ${casos.length} semanas · ${semanasOk} generadas · ${semanasCuadran} cuadran · ${semanasSinCobertura} sin cobertura · ${segundos.toFixed(1)} s\n`);

console.log('DETALLE POR CASO (recetas distintas · carrito · prot/día · cuadra · por qué no)');
for (const d of detallePorCaso) {
  const porQue = d.motivo ? `  (${d.motivo})` : '';
  console.log(
    `  ${d.etiqueta.padEnd(42)} ${String(d.recetas).padStart(2)} recetas  ${d.carrito.toFixed(2).padStart(7)} €`
    + `  ${d.protDia.toFixed(0).padStart(3)} g  ${d.cuadra ? 'sí' : 'NO'}${porQue}`,
  );
}

console.log(`\nRECETAS USADAS ALGUNA VEZ: ${usadas.length} / ${datos.recetas.length}\n`);

console.log('TOP 10 MÁS USADAS (semanas de 42)');
console.log('  usos  receta                                    €/rac   prot g  rinde  animal    min');
const top = [...usadas].sort((a, b) => b.usos - a.usos || a.receta.id.localeCompare(b.receta.id)).slice(0, 10);
for (const p of top) {
  console.log(
    `  ${String(p.usos).padStart(4)}  ${p.receta.nombre.padEnd(40)}  ${p.euros.toFixed(2).padStart(5)}  ${p.proteinaG.toFixed(1).padStart(6)}  ${String(p.rinde).padStart(5)}  ${p.animal.padEnd(8)}  ${String(p.minutos).padStart(3)}`,
  );
}

console.log(`\nNUNCA USADAS: ${nuncaUsadas.length} recetas (perfil con N=2)`);
console.log('  receta                                    €/rac   prot g  rinde  animal    min  bases');
for (const p of [...nuncaUsadas].sort((a, b) => a.euros - b.euros)) {
  console.log(
    `  ${p.receta.nombre.padEnd(40)}  ${p.euros.toFixed(2).padStart(5)}  ${p.proteinaG.toFixed(1).padStart(6)}  ${String(p.rinde).padStart(5)}  ${p.animal.padEnd(8)}  ${String(p.minutos).padStart(3)}  ${p.bases.join('+') || '—'}`,
  );
}

// --- Comparación de perfiles: usadas vs nunca usadas ------------------------

function resumen(grupo: Perfil[]) {
  const media = (f: (p: Perfil) => number) => grupo.reduce((a, p) => a + f(p), 0) / (grupo.length || 1);
  const cuenta = (f: (p: Perfil) => boolean) => grupo.filter(f).length;
  return {
    n: grupo.length,
    euros: media((p) => p.euros),
    prot: media((p) => p.proteinaG),
    rinde: media((p) => p.rinde),
    min: media((p) => p.minutos),
    fresca: cuenta((p) => p.animal === 'fresca'),
    conserva: cuenta((p) => p.animal === 'conserva'),
    ninguna: cuenta((p) => p.animal === 'ninguna'),
    rinde1: cuenta((p) => p.rinde === 1),
  };
}

const u = resumen(usadas);
const nu = resumen(nuncaUsadas);
console.log('\nPERFIL MEDIO: USADAS vs NUNCA USADAS');
console.log('  grupo         n    €/rac  prot g  rinde  min   fresca  conserva  ninguna  rinde=1');
console.log(`  usadas      ${String(u.n).padStart(3)}  ${u.euros.toFixed(2).padStart(7)}  ${u.prot.toFixed(1).padStart(6)}  ${u.rinde.toFixed(2).padStart(5)}  ${u.min.toFixed(0).padStart(3)}  ${String(u.fresca).padStart(6)}  ${String(u.conserva).padStart(8)}  ${String(u.ninguna).padStart(7)}  ${String(u.rinde1).padStart(7)}`);
console.log(`  nunca       ${String(nu.n).padStart(3)}  ${nu.euros.toFixed(2).padStart(7)}  ${nu.prot.toFixed(1).padStart(6)}  ${nu.rinde.toFixed(2).padStart(5)}  ${nu.min.toFixed(0).padStart(3)}  ${String(nu.fresca).padStart(6)}  ${String(nu.conserva).padStart(8)}  ${String(nu.ninguna).padStart(7)}  ${String(nu.rinde1).padStart(7)}`);

// Distribución por tramo de precio, para ver dónde corta el motor.
console.log('\nUSO POR TRAMO DE €/RACIÓN (N=2)');
console.log('  tramo         total  usadas  nunca');
const tramos: [number, number][] = [[0, 0.75], [0.75, 1.25], [1.25, 1.75], [1.75, 2.25], [2.25, 3], [3, 99]];
for (const [a, b] of tramos) {
  const t = perfiles.filter((p) => p.euros >= a && p.euros < b);
  const tu = t.filter((p) => p.usos > 0).length;
  const rotulo = `${a.toFixed(2)}–${b === 99 ? '∞' : b.toFixed(2)}`;
  console.log(`  ${rotulo.padEnd(12)}  ${String(t.length).padStart(5)}  ${String(tu).padStart(6)}  ${String(t.length - tu).padStart(5)}`);
}
