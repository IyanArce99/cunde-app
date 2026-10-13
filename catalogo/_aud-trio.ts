#!/usr/bin/env node --experimental-strip-types
/**
 * ¿De dónde sale que el trío de fuentes más repetido cubra 7 platos y no 6?
 *
 * Sonda del 13 oct 2026. `fuentes.test.ts` se puso rojo al aplicar a la vez la
 * revisión de precios, el cambio de caldo de verduras y la retirada de las seis
 * recetas de quinoa. Esto separa las tres causas: genera las mismas cinco
 * semanas del test con cada catálogo y enseña qué fuentes salen.
 *
 * Uso: node --experimental-strip-types catalogo/_aud-trio.ts <antes.json> [...más.json]
 * No modifica nada.
 */
import fs from 'node:fs';
import { generarSemana } from '../src/motor/seleccionar.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';

const PROTEINA_QUE_DEFINE = 8;

function medir(datos: DatosMotor, semanaNumero: number) {
  const s = generarSemana({
    datos, N: 2, numHuecos: 14, presupuesto: 90,
    variedad: 'mucha', proteina: 'normal', esfuerzo: 'libre',
    exclusiones: [], semanaNumero,
  } as any);
  const cuenta = new Map<string, number>();
  for (const t of s.tandas) {
    const vistas = new Set<string>();
    for (const ing of t.receta.ingredientes) {
      const meta = datos.ingredientes[ing.canonico];
      if (!meta || meta.es_despensa) continue;
      if ((meta.proteina_g_por_100 ?? 0) < PROTEINA_QUE_DEFINE) continue;
      vistas.add(ing.canonico.split('_')[0]);
    }
    for (const v of vistas) cuenta.set(v, (cuenta.get(v) ?? 0) + 1);
  }
  const orden = [...cuenta.entries()].sort((a, b) => b[1] - a[1]);
  return {
    top3: orden.slice(0, 3).reduce((a, [, n]) => a + n, 0),
    fuentes: orden.map(([k, n]) => `${k}:${n}`).join(' '),
    tandas: s.tandas.map((t) => t.receta.id),
    total: s.carrito.totalCarrito,
  };
}

for (const ruta of process.argv.slice(2)) {
  const datos = JSON.parse(fs.readFileSync(ruta, 'utf8')) as DatosMotor;
  console.log(`\n=== ${ruta}  (${datos.recetas.length} recetas)`);
  for (const n of [1, 2, 3, 4, 5]) {
    const m = medir(datos, n);
    console.log(`  semana ${n}: trío ${m.top3} · ${m.total.toFixed(2)} € · ${m.fuentes}`);
    console.log(`     ${m.tandas.join(', ')}`);
  }
}
