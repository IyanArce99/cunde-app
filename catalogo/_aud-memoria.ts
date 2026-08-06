#!/usr/bin/env node --experimental-strip-types
/**
 * La memoria del motor, medida encadenando semanas como lo hace la app: la
 * semana N se genera con el historial de las N-1 anteriores.
 *
 * Uso: node --experimental-strip-types catalogo/_aud-memoria.ts [semanas]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { consumoDeEnsamblaje, consumoPorRacion, proteinaDeEnsamblaje, proteinaPorRacion } from '../src/motor/carrito.ts';
import { generarSemana, recetarioAdaptado, SEMANAS_DE_MEMORIA } from '../src/motor/seleccionar.ts';
import type { NivelProteina, PeticionSemana, Variedad } from '../src/motor/seleccionar.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const datos: DatosMotor = JSON.parse(
  fs.readFileSync(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'), 'utf8'),
);
const N = 2;
const SEMANAS = Number(process.argv[2] ?? 10);
const VARIEDADES: Variedad[] = ['poca', 'normal', 'mucha'];
const NIVELES: NivelProteina[] = ['basica', 'normal', 'alta'];

interface Corrida {
  semanas: {
    numero: number;
    recetas: string[];
    nombres: string[];
    carrito: number;
    perecedero: number;
    proteina: number;
    cuadra: boolean;
    huecos: ReturnType<typeof generarSemana>['huecos'];
  }[];
  solapes: number[];
}

/** Encadena `SEMANAS` semanas pasando el historial, como hace la app. */
function encadenar(base: Omit<PeticionSemana, 'semanaNumero'>, conMemoria: boolean, cuantas = SEMANAS): Corrida {
  const corrida: Corrida = { semanas: [], solapes: [] };
  let historial: string[][] = [];

  for (let n = 1; n <= cuantas; n++) {
    const s = generarSemana({
      ...base,
      semanaNumero: n,
      recetasRecientes: conMemoria ? historial : [],
    });
    const recetas = [...new Set(s.tandas.map((t) => t.receta.id))];
    corrida.semanas.push({
      numero: n,
      recetas,
      nombres: [...new Set(s.tandas.map((t) => t.receta.nombre))],
      carrito: s.carrito.totalCarrito,
      perecedero: s.carrito.totalPerecedero,
      proteina: s.nutricion.proteinaPorPersonaDia,
      cuadra: s.cuadra,
      huecos: s.huecos,
    });
    if (n > 1) {
      const anterior = new Set(corrida.semanas[n - 2].recetas);
      corrida.solapes.push(recetas.filter((r) => anterior.has(r)).length);
    }
    historial = [recetas, ...historial].slice(0, SEMANAS_DE_MEMORIA);
  }
  return corrida;
}

const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

// --- 1 · Solape antes y después, en las 9 celdas ---------------------------

console.log(`SOLAPE ENTRE SEMANAS CONSECUTIVAS · ${SEMANAS} semanas encadenadas · N=2 · 51 €\n`);
console.log('celda        sin memoria      con memoria     carrito €        perecedero €');
console.log('             solape  recetas  solape  recetas  sin → con       sin → con');
console.log('-'.repeat(88));

const filas: { celda: string; sin: Corrida; con: Corrida }[] = [];
for (const proteina of NIVELES) {
  for (const variedad of VARIEDADES) {
    const base = { datos, N, numHuecos: 14, variedad, proteina, presupuesto: 51 };
    const sin = encadenar(base, false);
    const con = encadenar(base, true);
    filas.push({ celda: `${variedad.slice(0, 2)}·${proteina.slice(0, 2)}`, sin, con });

    const recetasSin = media(sin.semanas.map((s) => s.recetas.length));
    const recetasCon = media(con.semanas.map((s) => s.recetas.length));
    const carritoSin = media(sin.semanas.map((s) => s.carrito));
    const carritoCon = media(con.semanas.map((s) => s.carrito));
    const perecSin = media(sin.semanas.map((s) => s.perecedero));
    const perecCon = media(con.semanas.map((s) => s.perecedero));

    console.log(
      `${`${variedad}·${proteina}`.padEnd(13)}`
      + `${media(sin.solapes).toFixed(1).padStart(5)}${recetasSin.toFixed(1).padStart(9)}`
      + `${media(con.solapes).toFixed(1).padStart(9)}${recetasCon.toFixed(1).padStart(9)}`
      + `   ${carritoSin.toFixed(2)} → ${carritoCon.toFixed(2)}`
      + `  (${(carritoCon - carritoSin >= 0 ? '+' : '')}${(carritoCon - carritoSin).toFixed(2)})`
      + `   ${perecSin.toFixed(2)} → ${perecCon.toFixed(2)}`
      + ` (${(perecCon - perecSin >= 0 ? '+' : '')}${(perecCon - perecSin).toFixed(2)})`,
    );
  }
}

const solapeSin = media(filas.flatMap((f) => f.sin.solapes));
const solapeCon = media(filas.flatMap((f) => f.con.solapes));
const carritoSinT = media(filas.flatMap((f) => f.sin.semanas.map((s) => s.carrito)));
const carritoConT = media(filas.flatMap((f) => f.con.semanas.map((s) => s.carrito)));
const perecSinT = media(filas.flatMap((f) => f.sin.semanas.map((s) => s.perecedero)));
const perecConT = media(filas.flatMap((f) => f.con.semanas.map((s) => s.perecedero)));
const rotasSin = filas.flatMap((f) => f.sin.semanas).filter((s) => !s.cuadra).length;
const rotasCon = filas.flatMap((f) => f.con.semanas).filter((s) => !s.cuadra).length;

console.log('-'.repeat(88));
console.log(
  `MEDIA        ${solapeSin.toFixed(1).padStart(5)}${' '.repeat(9)}${solapeCon.toFixed(1).padStart(9)}`
  + `${' '.repeat(9)}   ${carritoSinT.toFixed(2)} → ${carritoConT.toFixed(2)}`
  + `  (${(carritoConT - carritoSinT >= 0 ? '+' : '')}${(carritoConT - carritoSinT).toFixed(2)})`
  + `   ${perecSinT.toFixed(2)} → ${perecConT.toFixed(2)}`
  + ` (${(perecConT - perecSinT >= 0 ? '+' : '')}${(perecConT - perecSinT).toFixed(2)})`,
);
console.log(`\nSemanas que no cuadran: ${rotasSin}/${filas.length * SEMANAS} sin memoria · ${rotasCon}/${filas.length * SEMANAS} con memoria`);

// --- 2 · Recetario tocado a lo largo de las 10 semanas ---------------------

console.log('\n\nRECETAS DISTINTAS TOCADAS EN LAS 10 SEMANAS (de 72)\n');
console.log('celda            sin memoria  con memoria');
for (const f of filas) {
  const sinT = new Set(f.sin.semanas.flatMap((s) => s.recetas)).size;
  const conT = new Set(f.con.semanas.flatMap((s) => s.recetas)).size;
  console.log(`${f.celda.padEnd(16)} ${String(sinT).padStart(11)}  ${String(conT).padStart(11)}`);
}

// --- 3 · ¿En qué filtro se rompe antes? -----------------------------------

console.log('\n\nDÓNDE SE ROMPE: FILTROS ORDENADOS POR RECETAS VIVAS\n');
console.log('filtro                     vivas  solape  recetas/sem  carrito  no cuadran  toca');
console.log('-'.repeat(86));
const FILTROS: { nombre: string; exclusiones: string[]; esfuerzo?: 'minimo' }[] = [
  { nombre: 'sin filtro', exclusiones: [] },
  { nombre: 'sin gluten', exclusiones: ['Gluten'] },
  { nombre: 'sin huevo', exclusiones: ['Huevo'] },
  { nombre: 'vegetariano', exclusiones: ['Vegetariano'] },
  { nombre: 'vegano', exclusiones: ['Vegano'] },
  { nombre: 'vegetariano + sin gluten', exclusiones: ['Vegetariano', 'Gluten'] },
  { nombre: 'lo mínimo (20 min)', exclusiones: [], esfuerzo: 'minimo' },
  { nombre: 'vegetariano + lo mínimo', exclusiones: ['Vegetariano'], esfuerzo: 'minimo' },
];
for (const f of FILTROS) {
  const base = {
    datos, N, numHuecos: 14, variedad: 'normal' as Variedad, proteina: 'normal' as NivelProteina,
    presupuesto: 51, exclusiones: f.exclusiones, esfuerzo: f.esfuerzo,
  };
  const vivas = recetarioAdaptado(datos, f.exclusiones, f.esfuerzo === 'minimo' ? 20 : Infinity).length;
  const con = encadenar(base, true);
  const toca = new Set(con.semanas.flatMap((s) => s.recetas)).size;
  console.log(
    `${f.nombre.padEnd(26)} ${String(vivas).padStart(5)}`
    + `  ${media(con.solapes).toFixed(1).padStart(6)}`
    + `  ${media(con.semanas.map((s) => s.recetas.length)).toFixed(1).padStart(11)}`
    + `  ${media(con.semanas.map((s) => s.carrito)).toFixed(2).padStart(7)}`
    + `  ${String(con.semanas.filter((s) => !s.cuadra).length).padStart(10)}`
    + `  ${String(toca).padStart(4)}`,
  );
}

// --- 4 · Las diez semanas del caso canónico, enteras -----------------------

const ETIQ: Record<string, string> = {
  cocinado: 'COCINAS ', sobras: 'RECALIENT', ensamblaje: 'APROVECHA', libre: 'LIBRE   ',
};
const canonico = encadenar(
  { datos, N, numHuecos: 14, variedad: 'normal', proteina: 'normal', presupuesto: 51 }, true,
);
console.log('\n\nLAS DIEZ SEMANAS · 2 personas · 51 € · variedad normal · proteína normal\n');
for (const s of canonico.semanas) {
  console.log('='.repeat(78));
  console.log(
    `SEMANA ${s.numero}  ${s.carrito.toFixed(2)} € ${s.cuadra ? '(cabe)' : '(NO CUADRA)'}`
    + ` · ${s.proteina.toFixed(0)} g/persona/día`
    + ` · se estropea ${s.perecedero.toFixed(2)} € (${((s.perecedero / s.carrito) * 100).toFixed(1)}%)`
    + ` · ${s.recetas.length} recetas`
    + (s.numero > 1 ? ` · repite ${canonico.solapes[s.numero - 2]} de la anterior` : ''),
  );
  console.log('='.repeat(78));
  let dia = '';
  for (const h of s.huecos) {
    if (h.dia !== dia && dia) console.log('');
    dia = h.dia;
    if (!h.receta) { console.log(`  ${h.dia} ${h.ranura.padEnd(6)} LIBRE`); continue; }
    const nombre = h.ensamblaje ? h.ensamblaje.nombre : h.receta.nombre;
    let precio = 0;
    let prot = proteinaPorRacion(h.receta, datos, N);
    if (h.tipo === 'cocinado') precio = consumoPorRacion(h.receta, datos, N);
    else if (h.ensamblaje) {
      precio = consumoDeEnsamblaje(h.ensamblaje, datos, N);
      prot += proteinaDeEnsamblaje(h.ensamblaje, datos, N);
    } else if (h.tipo === 'ensamblaje') precio = consumoPorRacion(h.receta, datos, N, 'acompanamiento');
    console.log(
      `  ${h.dia} ${h.ranura.padEnd(6)} ${ETIQ[h.tipo]}  ${nombre.padEnd(38)}`
      + `${precio.toFixed(2).padStart(5)} €  ${prot.toFixed(0).padStart(3)} g`,
    );
  }
  console.log('');
}
