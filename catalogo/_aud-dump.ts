#!/usr/bin/env node --experimental-strip-types
/**
 * Vuelca 20 semanas legibles para que se puedan LEER como usuario, no medir.
 * Parrilla determinista de parámetros. Salida: un fichero de texto plano.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { consumoPorRacion, proteinaPorRacion } from '../src/motor/carrito.ts';
import { generarSemana } from '../src/motor/seleccionar.ts';
import type { NivelProteina, Variedad } from '../src/motor/seleccionar.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const datos: DatosMotor = JSON.parse(
  fs.readFileSync(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'), 'utf8'),
);

const SALIDA = process.argv[2]
  ?? path.join(aqui, '..', '..', 'semanas-20.txt');

interface Caso {
  n: number; presupuesto: number; variedad: Variedad; proteina: NivelProteina;
  numHuecos?: number; exclusiones?: string[]; esfuerzo?: 'minimo' | 'normal' | 'libre'; nota?: string;
}

const CASOS: Caso[] = [
  { n: 2, presupuesto: 51, variedad: 'normal', proteina: 'normal', nota: 'el caso canónico' },
  { n: 2, presupuesto: 51, variedad: 'poca', proteina: 'basica' },
  { n: 2, presupuesto: 51, variedad: 'poca', proteina: 'alta' },
  { n: 2, presupuesto: 51, variedad: 'mucha', proteina: 'normal' },
  { n: 2, presupuesto: 51, variedad: 'mucha', proteina: 'alta' },
  { n: 1, presupuesto: 30, variedad: 'poca', proteina: 'normal' },
  { n: 1, presupuesto: 25, variedad: 'poca', proteina: 'basica' },
  { n: 4, presupuesto: 90, variedad: 'normal', proteina: 'normal' },
  { n: 4, presupuesto: 70, variedad: 'poca', proteina: 'alta' },
  { n: 2, presupuesto: 40, variedad: 'poca', proteina: 'normal' },
  { n: 2, presupuesto: 70, variedad: 'normal', proteina: 'alta' },
  { n: 2, presupuesto: 51, variedad: 'normal', proteina: 'normal', exclusiones: ['Vegetariano'] },
  { n: 2, presupuesto: 51, variedad: 'normal', proteina: 'normal', exclusiones: ['Vegano'] },
  { n: 2, presupuesto: 51, variedad: 'normal', proteina: 'normal', exclusiones: ['Gluten'] },
  { n: 2, presupuesto: 51, variedad: 'normal', proteina: 'normal', exclusiones: ['Huevo'] },
  { n: 2, presupuesto: 51, variedad: 'normal', proteina: 'basica', exclusiones: ['Pescado', 'Marisco'] },
  { n: 2, presupuesto: 51, variedad: 'normal', proteina: 'normal', esfuerzo: 'minimo' },
  { n: 2, presupuesto: 51, variedad: 'mucha', proteina: 'basica' },
  { n: 3, presupuesto: 65, variedad: 'normal', proteina: 'normal' },
  { n: 2, presupuesto: 45, variedad: 'normal', proteina: 'normal', numHuecos: 7, nota: 'solo comidas' },
];

const ETIQ: Record<string, string> = {
  cocinado: 'COCINAS ', sobras: 'SOBRAS  ', ensamblaje: 'APROVECH', libre: 'LIBRE   ',
};

const lineas: string[] = [];
for (const [k, c] of CASOS.entries()) {
  const s = generarSemana({
    datos, N: c.n, numHuecos: c.numHuecos ?? 14, variedad: c.variedad,
    proteina: c.proteina, presupuesto: c.presupuesto,
    exclusiones: c.exclusiones, esfuerzo: c.esfuerzo,
  });

  lineas.push('='.repeat(78));
  lineas.push(
    `SEMANA ${k + 1} · ${c.n} persona${c.n > 1 ? 's' : ''} · ${c.presupuesto} €`
    + ` · variedad ${c.variedad} · proteína ${c.proteina}`
    + (c.exclusiones?.length ? ` · sin: ${c.exclusiones.join(', ')}` : '')
    + (c.esfuerzo === 'minimo' ? ' · máx 20 min' : '')
    + (c.nota ? ` · (${c.nota})` : ''),
  );
  lineas.push('='.repeat(78));

  if (!s.huecos.length) {
    lineas.push('  [SIN SEMANA: el motor no pudo montarla]');
    continue;
  }

  let diaAnterior = '';
  for (const h of s.huecos) {
    if (h.dia !== diaAnterior && diaAnterior) lineas.push('');
    diaAnterior = h.dia;
    if (!h.receta) {
      lineas.push(`  ${h.dia} ${h.ranura.padEnd(6)} ${ETIQ[h.tipo]}  —`);
      continue;
    }
    const precio = h.tipo === 'sobras' ? 0 : consumoPorRacion(h.receta, datos, c.n);
    const prot = proteinaPorRacion(h.receta, datos, c.n);
    const origen = h.origen ? `   [de la ${h.origen.ranura} del ${h.origen.dia}]` : '';
    lineas.push(
      `  ${h.dia} ${h.ranura.padEnd(6)} ${ETIQ[h.tipo]}  ${h.receta.nombre.padEnd(36)}`
      + `${precio.toFixed(2).padStart(5)} €/ración  ${prot.toFixed(0).padStart(3)} g prot`
      + `  ${h.tipo === 'cocinado' ? `${h.receta.minutos} min` : ''}${origen}`,
    );
  }

  const pct = s.carrito.totalCarrito ? (s.carrito.totalPerecedero / s.carrito.totalCarrito) * 100 : 0;
  lineas.push('');
  lineas.push(
    `  TOTAL ${s.carrito.totalCarrito.toFixed(2)} € de ${c.presupuesto} €`
    + ` ${s.cuadra ? '(cabe)' : '(NO CUADRA)'}`
    + ` · proteína ${s.nutricion.proteinaPorPersonaDia.toFixed(0)} g/persona/día`
    + ` · se estropea ${s.carrito.totalPerecedero.toFixed(2)} € (${pct.toFixed(1)}%)`
    + ` · ${s.recetasDistintas.length} recetas distintas`,
  );
  lineas.push('');
}

fs.writeFileSync(SALIDA, lineas.join('\n'), 'utf8');
console.log(`Escrito ${SALIDA} (${lineas.length} líneas, ${CASOS.length} semanas)`);
