#!/usr/bin/env node --experimental-strip-types
/**
 * ¿Qué restricción ata más? Enciende la telemetría de rechazos del motor y
 * genera las 9 combinaciones (variedad × proteína) del caso de referencia
 * (N=2, 51 €, 14 huecos). No cambia ninguna decisión: solo cuenta.
 *
 * OJO: los contadores acumulan todo lo que pasa por el motor mientras están
 * activos, y generarSemana llama a construirMejor varias veces por dentro
 * (hasta 8 semillas, más las salidas si no cuadra). Los números son por
 * GENERACIÓN COMPLETA, no por pasada del greedy.
 *
 * Uso: node --experimental-strip-types catalogo/_aud-restricciones.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { activarTelemetria, desactivarTelemetria, generarSemana } from '../src/motor/seleccionar.ts';
import type { NivelProteina, Variedad } from '../src/motor/seleccionar.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const datos: DatosMotor = JSON.parse(
  fs.readFileSync(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'), 'utf8'),
);

const N = 2;
const PRESUPUESTO = 51;
const NUM_HUECOS = 14;
const VARIEDADES: Variedad[] = ['poca', 'normal', 'mucha'];
const NIVELES: NivelProteina[] = ['basica', 'normal', 'alta'];

/** Claves que NO son rechazos de candidato, sino eventos del flujo. */
const EVENTOS = new Set([
  'candidato_evaluado',
  'relajada:candidato_evaluado',
  'eleccion_fuera_presupuesto',
  'pasada_relajada_necesaria',
]);

interface Celda {
  variedad: Variedad;
  proteina: NivelProteina;
  contadores: Record<string, number>;
  cuadra: boolean;
  carrito: number;
  proteinaDia: number;
  recetas: number;
}

const celdas: Celda[] = [];
const t0 = Date.now();

for (const variedad of VARIEDADES) {
  for (const proteina of NIVELES) {
    const t = activarTelemetria(); // objeto NUEVO: resetea los contadores
    const s = generarSemana({ datos, N, numHuecos: NUM_HUECOS, variedad, proteina, presupuesto: PRESUPUESTO });
    const contadores = { ...t }; // copia antes de la siguiente celda
    desactivarTelemetria();
    celdas.push({
      variedad,
      proteina,
      contadores,
      cuadra: s.cuadra,
      carrito: s.carrito.totalCarrito,
      proteinaDia: s.nutricion.proteinaPorPersonaDia,
      recetas: s.recetasDistintas.length,
    });
  }
}

// --- Preparación de la tabla ------------------------------------------------

// Se fuerzan las claves conocidas aunque salgan a cero: un motivo que NUNCA
// dispara es un hallazgo, no una fila que ocultar.
const CLAVES_CONOCIDAS = [
  'tope_tandas', 'tope_variedad', 'obligado_estrenar', 'obligado_fresco',
  'tope_por_base', 'finde_sin_fresco', 'sin_sitio_tanda', 'suelo_inalcanzable',
];
const todasLasClaves = [...new Set([...CLAVES_CONOCIDAS, ...celdas.flatMap((c) => Object.keys(c.contadores))])];
const clavesRechazo = todasLasClaves.filter((k) => !EVENTOS.has(k));
// Orden estable: primero estrictas, después relajadas, por total descendente.
const totalDe = (k: string) => celdas.reduce((a, c) => a + (c.contadores[k] ?? 0), 0);
clavesRechazo.sort((a, b) => {
  const ra = a.startsWith('relajada:') ? 1 : 0;
  const rb = b.startsWith('relajada:') ? 1 : 0;
  if (ra !== rb) return ra - rb;
  return totalDe(b) - totalDe(a);
});

const etiqueta = (c: Celda) => `${c.variedad.slice(0, 2)}·${c.proteina.slice(0, 2)}`;
const rechazosDe = (c: Celda) => clavesRechazo.reduce((a, k) => a + (c.contadores[k] ?? 0), 0);

const ANCHO_MOTIVO = 30;
const ANCHO_CELDA = 8;

function fila(nombre: string, valores: (string | number)[]): string {
  return nombre.padEnd(ANCHO_MOTIVO) + valores.map((v) => String(v).padStart(ANCHO_CELDA)).join('');
}

// --- 1 · Rechazos absolutos por motivo y combinación ------------------------

console.log(`RECHAZOS POR MOTIVO · N=${N} · ${PRESUPUESTO} € · ${NUM_HUECOS} huecos`);
console.log('(columna = variedad·proteína; po/no/mu × ba/no/al; números por GENERACIÓN completa)\n');
console.log(fila('motivo', [...celdas.map(etiqueta), 'TOTAL']));
console.log('-'.repeat(ANCHO_MOTIVO + ANCHO_CELDA * (celdas.length + 1)));
for (const k of clavesRechazo) {
  console.log(fila(k, [...celdas.map((c) => c.contadores[k] ?? 0), totalDe(k)]));
}
console.log('-'.repeat(ANCHO_MOTIVO + ANCHO_CELDA * (celdas.length + 1)));
console.log(fila('TOTAL rechazos', [...celdas.map(rechazosDe), celdas.reduce((a, c) => a + rechazosDe(c), 0)]));

// --- 2 · Normalizado: % de los descartes de cada celda ----------------------

console.log('\n\n% DE LOS DESCARTES DE CADA COMBINACIÓN\n');
console.log(fila('motivo', celdas.map(etiqueta)));
console.log('-'.repeat(ANCHO_MOTIVO + ANCHO_CELDA * celdas.length));
for (const k of clavesRechazo) {
  console.log(fila(k, celdas.map((c) => {
    const total = rechazosDe(c);
    return total ? ((100 * (c.contadores[k] ?? 0)) / total).toFixed(1) : '0.0';
  })));
}

// --- 3 · Eventos del flujo (no son rechazos) --------------------------------

console.log('\n\nEVENTOS DEL FLUJO\n');
console.log(fila('evento', [...celdas.map(etiqueta), 'TOTAL']));
console.log('-'.repeat(ANCHO_MOTIVO + ANCHO_CELDA * (celdas.length + 1)));
for (const k of EVENTOS) {
  console.log(fila(k, [...celdas.map((c) => c.contadores[k] ?? 0), totalDe(k)]));
}

// --- 4 · Qué salió de cada generación, para leer los números con contexto ---

console.log('\n\nLA SEMANA QUE SALIÓ EN CADA CELDA\n');
console.log(fila('dato', celdas.map(etiqueta)));
console.log('-'.repeat(ANCHO_MOTIVO + ANCHO_CELDA * celdas.length));
console.log(fila('carrito €', celdas.map((c) => c.carrito.toFixed(2))));
console.log(fila('proteína g/persona·día', celdas.map((c) => c.proteinaDia.toFixed(0))));
console.log(fila('recetas distintas', celdas.map((c) => c.recetas)));
console.log(fila('cuadra', celdas.map((c) => (c.cuadra ? 'sí' : 'NO'))));

// --- 5 · El asesino principal por nivel de variedad -------------------------

console.log('\n\nRESTRICCIÓN QUE MÁS MATA POR NIVEL DE VARIEDAD (agregando proteínas)\n');
for (const variedad of VARIEDADES) {
  const delNivel = celdas.filter((c) => c.variedad === variedad);
  const suma: Record<string, number> = {};
  for (const c of delNivel) for (const k of clavesRechazo) suma[k] = (suma[k] ?? 0) + (c.contadores[k] ?? 0);
  const total = Object.values(suma).reduce((a, b) => a + b, 0);
  const orden = Object.entries(suma).sort((a, b) => b[1] - a[1]).slice(0, 3);
  console.log(`${variedad.padEnd(7)} total=${String(total).padStart(6)}  ` + orden
    .map(([k, v]) => `${k}=${v} (${((100 * v) / total).toFixed(1)}%)`)
    .join('  ·  '));
}

console.log(`\n[${((Date.now() - t0) / 1000).toFixed(1)} s total]`);
