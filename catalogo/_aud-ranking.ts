#!/usr/bin/env node --experimental-strip-types
/**
 * La frecuencia de uso es un detector de errores en los datos.
 *
 * El optimizador elige lo que le sale barato y proteico. Una receta con la
 * proteína inflada o el coste subestimado es, para él, una ganga — y la va a
 * elegir desproporcionadamente. Por eso la sopa de ajo con TRES huevos por
 * ración salía en 10 de 20 semanas. El ranking de uso es, literalmente, la
 * lista ordenada de "dónde mirar primero".
 *
 * Vuelca el tercio superior con todos los datos que hacen falta para
 * auditarlo a mano: cantidades por ración, de dónde sale cada gramo de
 * proteína y qué SKU y qué precio hay detrás de cada línea.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aUnidadCatalogo, consumoPorRacion, escalar, proteinaPorRacion, SIN_SKU } from '../src/motor/carrito.ts';
import { rindeEfectivo } from '../src/motor/reparto.ts';
import { generarSemana } from '../src/motor/seleccionar.ts';
import type { NivelProteina, Variedad } from '../src/motor/seleccionar.ts';
import type { DatosMotor, Receta } from '../src/motor/tipos.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const datos: DatosMotor = JSON.parse(
  fs.readFileSync(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'), 'utf8'),
);
const N = 2;
const VARIEDADES: Variedad[] = ['poca', 'normal', 'mucha'];
const NIVELES: NivelProteina[] = ['basica', 'normal', 'alta'];

// 40 semanas deterministas: 36 de la parrilla base + 4 con filtros.
const CASOS: { N: number; presupuesto: number; exclusiones?: string[] }[] = [
  { N: 2, presupuesto: 51 }, { N: 1, presupuesto: 30 }, { N: 4, presupuesto: 90 }, { N: 2, presupuesto: 70 },
];
const usos = new Map<string, number>();
let semanas = 0;
for (const caso of CASOS) {
  for (const variedad of VARIEDADES) {
    for (const proteina of NIVELES) {
      const s = generarSemana({ datos, N: caso.N, numHuecos: 14, variedad, proteina, presupuesto: caso.presupuesto });
      semanas++;
      for (const id of new Set(s.tandas.map((t) => t.receta.id))) usos.set(id, (usos.get(id) ?? 0) + 1);
    }
  }
}
for (const ex of [['Vegetariano'], ['Vegano'], ['Gluten'], ['Huevo']]) {
  const s = generarSemana({ datos, N: 2, numHuecos: 14, variedad: 'normal', proteina: 'normal', presupuesto: 51, exclusiones: ex });
  semanas++;
  for (const id of new Set(s.tandas.map((t) => t.receta.id))) usos.set(id, (usos.get(id) ?? 0) + 1);
}

const ranking = datos.recetas
  .map((r) => ({ r, n: usos.get(r.id) ?? 0 }))
  .sort((a, b) => b.n - a.n || a.r.id.localeCompare(b.r.id));

const tercio = Math.ceil(datos.recetas.length / 3);
console.log(`${semanas} semanas · ${ranking.filter((x) => x.n > 0).length}/${datos.recetas.length} recetas usadas`);
console.log(`\nTERCIO SUPERIOR (${tercio} recetas) — el que hay que auditar a mano\n`);

const detalle = (r: Receta) => {
  const lineas: string[] = [];
  let protTotal = 0;
  for (const ing of r.ingredientes) {
    const meta = datos.ingredientes[ing.canonico];
    const cant = escalar(ing.cantidad, ing.escalado, N) / N; // por ración
    const gramos = ing.unidad === 'ud' ? cant * (meta.gramos_por_unidad ?? 0) : cant;
    const comestible = gramos * (meta.rendimiento_comestible ?? 1);
    const prot = (comestible * meta.proteina_g_por_100) / 100;
    protTotal += prot;
    const sku = SIN_SKU.has(ing.canonico) ? null : datos.skus[ing.canonico];
    const coste = sku && !meta.es_despensa
      ? aUnidadCatalogo(escalar(ing.cantidad, ing.escalado, N), ing.unidad, sku) * sku.precio_kg_l_ud / N
      : 0;
    lineas.push(
      `      ${ing.canonico.padEnd(22)} ${(`${cant.toFixed(1)} ${ing.unidad}`).padStart(10)}/rac`
      + `  ${meta.rendimiento_comestible && meta.rendimiento_comestible < 1 ? `×${meta.rendimiento_comestible} com.` : '        '}`
      + `  ${prot.toFixed(1).padStart(5)} g  ${coste.toFixed(3).padStart(6)} €`
      + `${meta.es_despensa ? '  (despensa)' : ''}`,
    );
  }
  return { lineas, protTotal };
};

for (const { r, n } of ranking.slice(0, tercio)) {
  const { lineas, protTotal } = detalle(r);
  console.log(
    `${String(n).padStart(3)}×  ${r.nombre}  [${r.id}]`
    + `  ${consumoPorRacion(r, datos, N).toFixed(2)} €/rac · ${proteinaPorRacion(r, datos, N).toFixed(1)} g`
    + ` · ${r.minutos} min · rinde ${rindeEfectivo(r, 'principal', 14)} · nevera ${r.dias_nevera}d · ${r.proteina}`,
  );
  for (const l of lineas) console.log(l);
  console.log(`      ${'—'.repeat(20)} suma proteína ${protTotal.toFixed(1)} g/ración\n`);
}
