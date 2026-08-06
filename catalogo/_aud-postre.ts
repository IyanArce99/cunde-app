#!/usr/bin/env node --experimental-strip-types
/**
 * El postre no es una receta: son unidades. ¿Cuánto cuesta la semana y qué le
 * quita al menú si entra DENTRO del presupuesto, que es como tiene que entrar?
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generarSemana } from '../src/motor/seleccionar.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const datos: DatosMotor = JSON.parse(fs.readFileSync(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'), 'utf8'));
const bruto = JSON.parse(fs.readFileSync(path.join(aqui, 'catalogo_mercadona_mad3_2026-07-28.json'), 'utf8'));
const arr = Array.isArray(bruto) ? bruto : Object.values(bruto);
const de = (sku: string) => arr.find((p: { sku: string }) => p.sku === sku);

/** Un postre español de diario: pieza de fruta o yogur. Nada más. */
const PIEZAS = ['3819', '3028', '3824', '3119', '3235'].map(de); // plátano, manzana, banana, pera, naranja
const YOGUR = de('22313'); // pack de 6

const N = 2, DIAS = 7;
const postres = N * DIAS;

console.log(`=== POSTRE PARA ${N} PERSONAS, ${DIAS} DÍAS = ${postres} raciones ===\n`);
console.log('pieza                        €/ud');
for (const p of PIEZAS) console.log(`  ${p.nombre.padEnd(26)} ${p.precio.toFixed(2)}`);
console.log(`  ${(YOGUR.nombre + ' (pack 6)').padEnd(26)} ${(YOGUR.precio / YOGUR.unidades_pack).toFixed(2)}  · el pack entero ${YOGUR.precio.toFixed(2)} €\n`);

/** Sin sobrante por construcción: la fruta se vende por pieza. */
const mezclas = [
  { nombre: 'lo más barato', yogures: 6, fruta: ['3824', '3824', '3824', '3824', '3824', '3819', '3819', '3819'] },
  { nombre: 'variado', yogures: 6, fruta: ['3819', '3819', '3028', '3028', '3119', '3119', '3235', '3824'] },
  { nombre: 'solo fruta', yogures: 0, fruta: ['3819', '3819', '3028', '3028', '3119', '3119', '3235', '3235', '3824', '3824', '3819', '3028', '3119', '3235'] },
];
console.log('mezcla            postres   coste    €/postre   sobrante');
for (const m of mezclas) {
  const packs = Math.ceil(m.yogures / YOGUR.unidades_pack);
  const coste = packs * YOGUR.precio + m.fruta.reduce((s, id) => s + de(id).precio, 0);
  const total = m.yogures + m.fruta.length;
  const sobra = packs * YOGUR.unidades_pack - m.yogures;
  console.log(`${m.nombre.padEnd(17)} ${String(total).padStart(2)}      ${coste.toFixed(2).padStart(5)} €   ${(coste / total).toFixed(2)}       ${sobra} yogur${sobra === 1 ? '' : 'es'}`);
}

// ¿Y qué le quita al menú? El presupuesto es cerrado: el postre no va encima.
const coste = YOGUR.precio + mezclas[1].fruta.reduce((s, id) => s + de(id).precio, 0);
console.log(`\n=== SI ENTRA DENTRO DE LOS 65 € (mezcla variada, ${coste.toFixed(2)} €) ===\n`);
const sinPostre = generarSemana({ datos, N, numHuecos: 14, variedad: 'normal', presupuesto: 65, semanaNumero: 1 });
const conPostre = generarSemana({ datos, N, numHuecos: 14, variedad: 'normal', presupuesto: 65 - coste, semanaNumero: 1 });
const linea = (t: string, s: typeof sinPostre) => console.log(
  `${t.padEnd(14)} ${s.carrito.totalCarrito.toFixed(2).padStart(6)} €   ${String(s.recetasDistintas.length).padStart(2)} platos   ` +
  `${s.nutricion.proteinaPorPersonaDia.toFixed(0)} g proteína   ${s.carrito.totalPerecedero.toFixed(2)} € fresco`,
);
linea('sin postre', sinPostre);
linea('con postre', conPostre);
console.log(`${''.padEnd(14)} ${(conPostre.carrito.totalCarrito + coste).toFixed(2).padStart(6)} €   ← lo que pasa por caja con el postre dentro`);

const antes = new Set(sinPostre.recetasDistintas), ahora = new Set(conPostre.recetasDistintas);
const fuera = [...antes].filter((r) => !ahora.has(r));
const dentro = [...ahora].filter((r) => !antes.has(r));
console.log(`\nplatos que salen: ${fuera.length ? fuera.join(', ') : 'ninguno'}`);
console.log(`platos que entran: ${dentro.length ? dentro.join(', ') : 'ninguno'}`);
