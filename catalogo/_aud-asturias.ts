/**
 * ═══ ¿PUEDE CUNDE LANZARSE EN ASTURIAS TAL Y COMO ESTÁ? ═══
 *
 * La app lleva el catálogo del almacén `mad3` (Madrid). Y CLAUDE.md ya avisa de
 * lo que de verdad cambia entre almacenes: el precio apenas —1,04 € sobre 145 en
 * la misma cesta— pero la REFERENCIA sí. El mismo producto lleva SKU distinto
 * según la zona, y hay SKU que en un almacén no existen.
 *
 * Eso, en la pantalla que se usa de pie delante del lineal, significa mandar a
 * alguien a buscar un producto que su tienda no tiene. Así que antes de hablar
 * de Asturias hay que saber cuántos de los 117 SKU de la app existen en Oviedo
 * y cuánto se mueve el precio.
 *
 * Se responde con `almacenes-2026-07-30.json`, que ya está en disco: cero
 * peticiones a Mercadona.
 *
 *   node --experimental-strip-types catalogo/_aud-asturias.ts
 */
import fs from 'node:fs';

const ALMACEN = '4480'; // Asturias · Oviedo (33001)
const REFERENCIA = 'mad3'; // el que lleva la app

interface Fila { nombre: string; base: number; por: Record<string, number | string> }
const datos = JSON.parse(fs.readFileSync('catalogo/almacenes-2026-07-30.json', 'utf8')) as {
  almacenes: Record<string, string>;
  tabla: Record<string, Fila>;
};

/* Los SKU que la app usa de verdad hoy, para no medir sobre productos que ya no
   están en el catálogo del motor. */
const motor = JSON.parse(fs.readFileSync('src/data/motor-datos.json', 'utf8')) as {
  skus: Record<string, { sku: string; nombre: string; precio: number }>;
};
const enLaApp = new Map(Object.entries(motor.skus).map(([c, s]) => [s.sku, { canonico: c, ...s }]));

console.log(`\nAlmacén: ${datos.almacenes[ALMACEN]}`);
console.log(`Comparado con: ${datos.almacenes[REFERENCIA]}\n`);

const faltan: string[] = [];
const suben: { nombre: string; de: number; a: number }[] = [];
const bajan: { nombre: string; de: number; a: number }[] = [];
let iguales = 0;
let medidos = 0;
let sinDato = 0;

for (const [sku, fila] of Object.entries(datos.tabla)) {
  const usado = enLaApp.get(sku);
  if (!usado) continue; // producto que la app ya no lleva
  const alli = fila.por[ALMACEN];
  const aqui = fila.por[REFERENCIA];
  if (alli === undefined || aqui === undefined) { sinDato++; continue; }
  if (typeof alli === 'string') { faltan.push(`${fila.nombre} (${sku})`); continue; }
  if (typeof aqui !== 'number') { sinDato++; continue; }
  medidos++;
  const delta = alli - aqui;
  if (Math.abs(delta) < 0.005) iguales++;
  else if (delta > 0) suben.push({ nombre: fila.nombre, de: aqui, a: alli });
  else bajan.push({ nombre: fila.nombre, de: aqui, a: alli });
}

const total = medidos + faltan.length;
console.log(`SKU de la app con dato en las dos zonas: ${total}${sinDato ? ` (${sinDato} sin dato)` : ''}`);
console.log(`  NO EXISTEN en Oviedo: ${faltan.length}   (${(faltan.length / total * 100).toFixed(1)}%)`);
console.log(`  mismo precio:         ${iguales}`);
console.log(`  más caros allí:       ${suben.length}`);
console.log(`  más baratos allí:     ${bajan.length}`);

if (faltan.length) {
  console.log('\nLos que faltan — cada uno es alguien buscando un producto que su tienda no tiene:');
  for (const f of faltan) console.log(`  ✗ ${f}`);
}

const dif = [...suben, ...bajan].sort((a, b) => Math.abs(b.a - b.de) - Math.abs(a.a - a.de));
if (dif.length) {
  console.log('\nLas diferencias de precio más grandes:');
  for (const d of dif.slice(0, 10)) {
    const signo = d.a > d.de ? '+' : '';
    console.log(`  ${d.de.toFixed(2)} -> ${d.a.toFixed(2)}  (${signo}${(d.a - d.de).toFixed(2)})  ${d.nombre}`);
  }
  const suma = dif.reduce((a, d) => a + (d.a - d.de), 0);
  console.log(`\nSuma de las diferencias sobre los ${medidos} medidos: ${suma >= 0 ? '+' : ''}${suma.toFixed(2)} €`);
  console.log('(no es lo que sube la cesta: depende de cuántos envases lleve cada semana)');
}
