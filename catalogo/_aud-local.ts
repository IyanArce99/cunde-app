#!/usr/bin/env node --experimental-strip-types
/**
 * CUÁNTO SE COME UN CAMBIO LOCAL.
 *
 * Al tocar UN hueco con rehacerDesde, ¿cuántos huecos de la semana cambian de
 * verdad? rehacerDesde congela solo las tandas cuyos huecos caen TODOS antes
 * del hueco tocado y reconstruye el resto con una sola pasada greedy
 * (construir, no construirMejor). La hipótesis: tocar el lunes rehace la
 * semana entera y tocar el domingo casi nada.
 *
 * Uso: node --experimental-strip-types catalogo/_aud-local.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generarSemana, rehacerDesde } from '../src/motor/seleccionar.ts';
import type { PeticionSemana, Retoque, SemanaGenerada, Variedad } from '../src/motor/seleccionar.ts';
import type { DatosMotor, Hueco } from '../src/motor/tipos.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const datos: DatosMotor = JSON.parse(
  fs.readFileSync(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'), 'utf8'),
);

const N = 2;
const PRESUPUESTO = 51;
const NUM_HUECOS = 14;
const VARIEDADES: Variedad[] = ['poca', 'normal', 'mucha'];
const RETOQUES: Retoque[] = ['cambiar', 'libre'];

const clave = (h: Hueco) => `${h.dia}|${h.ranura}`;

/** Compara hueco a hueco por posición (dia+ranura). Cambia si receta o tipo difieren. */
function diferencias(base: SemanaGenerada, nueva: SemanaGenerada) {
  const mapa = new Map(nueva.huecos.map((h) => [clave(h), h]));
  const cambiados: number[] = [];
  base.huecos.forEach((hb, k) => {
    const hn = mapa.get(clave(hb));
    if (!hn) { cambiados.push(k); return; }
    if ((hb.receta?.id ?? null) !== (hn.receta?.id ?? null) || hb.tipo !== hn.tipo) cambiados.push(k);
  });
  return cambiados;
}

const mediana = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

interface Medicion {
  variedad: Variedad;
  retoque: Retoque;
  indice: number;
  cambiados: number;
  antes: number;      // huecos cambiados en posiciones < indice (efecto "hacia atrás" de deshacer tandas)
  despues: number;    // huecos cambiados en posiciones >= indice
  deltaCarrito: number;
  sinForma: boolean;  // rehacerDesde devolvió la semana intacta (no hubo forma)
}

const mediciones: Medicion[] = [];

console.log(`RETOQUE LOCAL — ${N} personas · ${PRESUPUESTO} € · ${NUM_HUECOS} huecos · proteína normal`);
console.log('Un hueco "cambia" si su recetaId o su tipo difieren de la base, comparando por dia+ranura.\n');

for (const variedad of VARIEDADES) {
  const peticion: PeticionSemana = {
    datos, N, numHuecos: NUM_HUECOS, variedad, proteina: 'normal', presupuesto: PRESUPUESTO,
  };
  const base = generarSemana(peticion);
  console.log(`--- variedad=${variedad} · base: ${base.carrito.totalCarrito.toFixed(2)} € · `
    + `${base.recetasDistintas.length} recetas · cuadra=${base.cuadra ? 'sí' : 'no'} ---`);
  console.log('i   hueco        tipo       | cambiar: n (antes/desp)  Δ€      | libre: n (antes/desp)  Δ€');

  for (let i = 0; i < NUM_HUECOS; i++) {
    const celdas: string[] = [];
    for (const retoque of RETOQUES) {
      const nueva = rehacerDesde(peticion, base, i, retoque);
      const sinForma = nueva === base;
      const cambiados = sinForma ? [] : diferencias(base, nueva);
      const antes = cambiados.filter((k) => k < i).length;
      const despues = cambiados.length - antes;
      const delta = sinForma ? 0 : nueva.carrito.totalCarrito - base.carrito.totalCarrito;
      mediciones.push({
        variedad, retoque, indice: i, cambiados: cambiados.length, antes, despues,
        deltaCarrito: delta, sinForma,
      });
      celdas.push(
        `${String(cambiados.length).padStart(2)} (${antes}/${String(despues).padEnd(2)})`
        + `  ${(delta >= 0 ? '+' : '') + delta.toFixed(2).padStart(6)} €${sinForma ? ' [intacta]' : ''}`,
      );
    }
    const h = base.huecos[i];
    console.log(
      `${String(i).padStart(2)}  ${h.dia.padEnd(3)} ${h.ranura.padEnd(7)} ${h.tipo.padEnd(10)} | `
      + `${celdas[0].padEnd(24)} | ${celdas[1]}`,
    );
  }
  console.log();
}

// --- Resumen por combinación y retoque --------------------------------------

console.log('\nRESUMEN (14 índices por celda)\n');
console.log('variedad  retoque  mediana  media  máx  veces>3  Δ€ mediana  Δ€ máx|abs|');
for (const variedad of VARIEDADES) {
  for (const retoque of RETOQUES) {
    const m = mediciones.filter((x) => x.variedad === variedad && x.retoque === retoque);
    const ns = m.map((x) => x.cambiados);
    const deltas = m.map((x) => x.deltaCarrito);
    const maxAbs = deltas.reduce((a, b) => Math.abs(b) > Math.abs(a) ? b : a, 0);
    console.log(
      `${variedad.padEnd(9)} ${retoque.padEnd(8)} ${mediana(ns).toFixed(1).padStart(6)}`
      + `  ${media(ns).toFixed(1).padStart(5)}  ${String(Math.max(...ns)).padStart(3)}`
      + `  ${String(ns.filter((n) => n > 3).length).padStart(7)}`
      + `  ${mediana(deltas).toFixed(2).padStart(9)} €  ${maxAbs.toFixed(2).padStart(8)} €`,
    );
  }
}

// --- Mecanismo: ¿los huecos tempranos provocan más cambios? -----------------

console.log('\nMECANISMO: cambios según lo temprano que caiga el hueco tocado');
console.log('(media de huecos cambiados sobre las 3 variedades y los 2 retoques)\n');
console.log('tramo             media  | y "hacia atrás" (posiciones ANTERIORES al hueco tocado que cambian)');
const tramos: [string, (i: number) => boolean][] = [
  ['LUN-MAR (0-3)', (i) => i <= 3],
  ['MIÉ-JUE (4-7)', (i) => i >= 4 && i <= 7],
  ['VIE-SÁB (8-11)', (i) => i >= 8 && i <= 11],
  ['DOM (12-13)', (i) => i >= 12],
];
for (const [nombre, filtro] of tramos) {
  const m = mediciones.filter((x) => filtro(x.indice));
  console.log(
    `${nombre.padEnd(16)} ${media(m.map((x) => x.cambiados)).toFixed(1).padStart(5)}`
    + `  | ${media(m.map((x) => x.antes)).toFixed(1).padStart(4)} antes · `
    + `${media(m.map((x) => x.despues)).toFixed(1)} después`,
  );
}

const global = mediciones.filter((x) => !x.sinForma);
console.log(`\nGLOBAL: ${mediciones.length} retoques · mediana ${mediana(mediciones.map((x) => x.cambiados)).toFixed(1)}`
  + ` · máx ${Math.max(...mediciones.map((x) => x.cambiados))}`
  + ` · veces que 1 toque cambia >3 huecos: ${mediciones.filter((x) => x.cambiados > 3).length}/${mediciones.length}`
  + ` · retoques sin forma (semana intacta): ${mediciones.length - global.length}`);
