#!/usr/bin/env node --experimental-strip-types
/**
 * ¿QUÉ FRACCIÓN DE LO QUE SE COME ACABA EN LA BASURA?
 *
 * MAXIMO_TIRADO_POR_EURO acota el INCREMENTO de perecedero por cada euro de
 * comida ganado, pero no el total. La búsqueda por coordenadas da dos vueltas
 * sobre cuatro palancas, así que cada paso pasa la prueba por separado y la
 * deriva se acumula sin techo.
 *
 * Y la despensa lo empeora: su comida cuenta en totalConsumo pero cuesta 0 €
 * en el carrito, así que el "he ganado comida" que autoriza más desperdicio
 * se infla gratis.
 *
 * Esto mide la fracción real perecedero/consumo semana a semana, con y sin
 * despensa, para saber qué techo tiene sentido antes de ponerlo.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generarSemana, SEMANAS_DE_MEMORIA } from '../src/motor/seleccionar.ts';
import { existenciasTrasLaSemana } from '../src/motor/carrito.ts';
import type { Existencias } from '../src/motor/carrito.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const datos: DatosMotor = JSON.parse(fs.readFileSync(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'), 'utf8'));
const N = 2, PRESU = 65, SEMANAS = 8;
const f2 = (n: number) => n.toFixed(2).padStart(6);

function correr(conDespensa: boolean) {
  let existencias: Existencias = {};
  const historial: string[][] = [];
  const filas: { n: number; carrito: number; consumo: number; perecedero: number; frac: number }[] = [];
  for (let n = 1; n <= SEMANAS; n++) {
    const s = generarSemana({
      datos, N, numHuecos: 14, variedad: 'normal', presupuesto: PRESU, proteina: 'normal',
      semanaNumero: n, recetasRecientes: historial.slice(0, SEMANAS_DE_MEMORIA),
      existencias: conDespensa ? existencias : undefined,
    });
    if (!s.huecos.length) break;
    const c = s.carrito;
    filas.push({
      n, carrito: c.totalCarrito, consumo: c.totalConsumo, perecedero: c.totalPerecedero,
      frac: c.totalConsumo > 0 ? c.totalPerecedero / c.totalConsumo : 0,
    });
    historial.unshift([...new Set(s.tandas.map((t) => t.receta.id))]);
    if (conDespensa) existencias = existenciasTrasLaSemana(c, existencias);
  }
  return filas;
}

for (const [etiqueta, con] of [['SIN DESPENSA', false], ['CON DESPENSA', true]] as const) {
  console.log(`\n=== ${etiqueta} ===`);
  console.log('  n   carrito  consumo  perecedero   tirado/comido');
  const filas = correr(con);
  for (const f of filas) {
    console.log(`  ${f.n}  ${f2(f.carrito)} € ${f2(f.consumo)} € ${f2(f.perecedero)} €      ${(f.frac * 100).toFixed(1)}%`);
  }
  const media = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
  console.log(`  media de la fracción: ${(media(filas.map((f) => f.frac)) * 100).toFixed(1)}%`);
  console.log(`  peor semana:          ${(Math.max(...filas.map((f) => f.frac)) * 100).toFixed(1)}%`);
}
