#!/usr/bin/env node
/**
 * Compara dos volcados del catálogo (dos ejecuciones de extraer.js en días
 * distintos) y dice qué cambió: precios, altas y bajas de producto.
 *
 * Uso:
 *   node comparar.js <catalogo_dia1.json> <catalogo_dia2.json>
 *
 * La clave para emparejar productos es (cadena, sku, almacen), la misma
 * que dice CLAUDE.md para el upsert. Si comparas volcados de dos almacenes
 * distintos, cada producto se tratará como si hubiera desaparecido de uno
 * y aparecido en el otro — es lo correcto: los precios son por almacén, no
 * son el mismo producto conceptual entre tiendas.
 */

import fs from 'fs';

const [, , rutaA, rutaB] = process.argv;

if (!rutaA || !rutaB) {
  console.error('Uso: node comparar.js <catalogo_dia1.json> <catalogo_dia2.json>');
  process.exit(1);
}

function cargar(ruta) {
  return JSON.parse(fs.readFileSync(ruta, 'utf8'));
}

function clave(p) {
  return `${p.cadena}::${p.sku}::${p.almacen}`;
}

function comparar(catalogoA, catalogoB) {
  const mapaA = new Map(catalogoA.map((p) => [clave(p), p]));
  const mapaB = new Map(catalogoB.map((p) => [clave(p), p]));

  const nuevos = [];
  const desaparecidos = [];
  const conPrecioCambiado = [];

  for (const [k, prodB] of mapaB) {
    const prodA = mapaA.get(k);
    if (!prodA) {
      nuevos.push(prodB);
      continue;
    }
    if (prodA.precio !== prodB.precio) {
      conPrecioCambiado.push({
        sku: prodB.sku,
        nombre: prodB.nombre,
        precioAntes: prodA.precio,
        precioDespues: prodB.precio,
        delta: prodA.precio !== null && prodB.precio !== null ? +(prodB.precio - prodA.precio).toFixed(2) : null,
      });
    }
  }
  for (const [k, prodA] of mapaA) {
    if (!mapaB.has(k)) desaparecidos.push(prodA);
  }

  return { nuevos, desaparecidos, conPrecioCambiado, totalA: catalogoA.length, totalB: catalogoB.length };
}

function main() {
  const catalogoA = cargar(rutaA);
  const catalogoB = cargar(rutaB);
  const r = comparar(catalogoA, catalogoB);

  const subidas = r.conPrecioCambiado.filter((p) => p.delta !== null && p.delta > 0);
  const bajadas = r.conPrecioCambiado.filter((p) => p.delta !== null && p.delta < 0);

  console.log(`\nComparando:\n  A = ${rutaA} (${r.totalA} productos)\n  B = ${rutaB} (${r.totalB} productos)\n`);
  console.log(`Productos nuevos en B:        ${r.nuevos.length}`);
  console.log(`Productos desaparecidos de A: ${r.desaparecidos.length}`);
  console.log(`Precios distintos:            ${r.conPrecioCambiado.length}  (${subidas.length} suben, ${bajadas.length} bajan)`);

  if (r.conPrecioCambiado.length) {
    const deltasValidos = r.conPrecioCambiado.map((p) => p.delta).filter((d) => d !== null);
    const media = deltasValidos.reduce((s, d) => s + d, 0) / deltasValidos.length;
    console.log(`Cambio medio de precio:       ${media >= 0 ? '+' : ''}${media.toFixed(3)} €`);
  }

  if (r.nuevos.length) {
    console.log(`\nEjemplos de nuevos (hasta 5):`);
    r.nuevos.slice(0, 5).forEach((p) => console.log(`  + ${p.sku} ${p.nombre} — ${p.precio} €`));
  }
  if (r.desaparecidos.length) {
    console.log(`\nEjemplos de desaparecidos (hasta 5):`);
    r.desaparecidos.slice(0, 5).forEach((p) => console.log(`  - ${p.sku} ${p.nombre} — ${p.precio} €`));
  }
  if (r.conPrecioCambiado.length) {
    console.log(`\nEjemplos de cambio de precio (hasta 8):`);
    r.conPrecioCambiado.slice(0, 8).forEach((p) =>
      console.log(`  ~ ${p.sku} ${p.nombre}: ${p.precioAntes} € -> ${p.precioDespues} € (${p.delta >= 0 ? '+' : ''}${p.delta})`)
    );
  }
  console.log('');
}

main();
