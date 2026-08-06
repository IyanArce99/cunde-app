#!/usr/bin/env node --experimental-strip-types
/** Barrido de TOPE_DESPERDICIO sobre ocho semanas seguidas con despensa. */
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
const media = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;

console.log('tope   carrito  se come  perecedero  tirado/comido  peor semana  proteína');
for (const tope of [0.14, 0.16, 0.18, 0.20, 0.22, 0.25, 1]) {
  let existencias: Existencias = {};
  const historial: string[][] = [];
  const carr: number[] = [], cons: number[] = [], per: number[] = [], fr: number[] = [], pro: number[] = [];
  for (let n = 1; n <= SEMANAS; n++) {
    const s = generarSemana({
      datos, N, numHuecos: 14, variedad: 'normal', presupuesto: PRESU, proteina: 'normal',
      semanaNumero: n, recetasRecientes: historial.slice(0, SEMANAS_DE_MEMORIA),
      existencias, topeDesperdicio: tope,
    });
    if (!s.huecos.length) break;
    carr.push(s.carrito.totalCarrito); cons.push(s.carrito.totalConsumo);
    per.push(s.carrito.totalPerecedero); pro.push(s.nutricion.proteinaPorPersonaDia);
    fr.push(s.carrito.totalConsumo > 0 ? s.carrito.totalPerecedero / s.carrito.totalConsumo : 0);
    historial.unshift([...new Set(s.tandas.map((t) => t.receta.id))]);
    existencias = existenciasTrasLaSemana(s.carrito, existencias);
  }
  console.log(
    `${(tope === 1 ? 'sin' : tope.toFixed(2)).padStart(4)}  ${media(carr).toFixed(2).padStart(7)} €`
    + ` ${media(cons).toFixed(2).padStart(7)} € ${media(per).toFixed(2).padStart(9)} €`
    + ` ${(media(fr) * 100).toFixed(1).padStart(12)}% ${(Math.max(...fr) * 100).toFixed(1).padStart(11)}%`
    + ` ${media(pro).toFixed(1).padStart(9)} g`,
  );
}
