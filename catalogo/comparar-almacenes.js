#!/usr/bin/env node
/**
 * ¿CAMBIA EL PRECIO SEGÚN DÓNDE COMPRES?
 *
 * La pregunta decide si hace falta pedir el código postal en el onboarding o
 * no, así que se contesta con datos y no con lo que suele pasar.
 *
 * Dos fases, para no pedir más de lo necesario:
 *   1. Resolver unos cuantos códigos postales a almacén. Mercadona no cobra
 *      por CP: cada CP cae en un almacén y hay una docena en toda España
 *      (ver CLAUDE.md). Si varios CP caen en el mismo almacén, ya sabemos que
 *      preguntar el CP exacto no aporta nada por encima de preguntar la
 *      provincia.
 *   2. Pedir NUESTROS 108 productos en cada almacén distinto y comparar.
 *
 * Trato con el servidor, igual que en revisar-precios.js:
 *   - 300-500 ms entre peticiones, nunca concurrentes.
 *   - User-Agent identificable con contacto.
 *   - 403/429 o cualquier cosa que huela a bloqueo: PARAR y reportar. No se
 *     reintenta, no se rota nada, no se disimula.
 *
 * Uso:  node comparar-almacenes.js
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BASE = 'https://tienda.mercadona.es/api';
const USER_AGENT =
  'CundeCatalogBot/0.1 (+contacto: iyiarce@gmail.com; comparacion puntual de precios de ~108 productos entre almacenes para decidir si una app de listas de la compra necesita pedir el codigo postal, uso interno)';
const ESPERA_MIN_MS = 300;
const ESPERA_MAX_MS = 500;

/** Un CP por zona, más dos al azar. El de Madrid es el que ya usamos. */
const CODIGOS = [
  { cp: '33001', zona: 'Asturias · Oviedo' },
  { cp: '28001', zona: 'Madrid · centro' },
  { cp: '41001', zona: 'Andalucía · Sevilla' },
  { cp: '08001', zona: 'Cataluña · Barcelona' },
  { cp: '15001', zona: 'Galicia · A Coruña' },
  { cp: '07001', zona: 'Baleares · Palma' },
];

class BloqueoDetectado extends Error {}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const pausaEducada = () =>
  esperar(ESPERA_MIN_MS + Math.random() * (ESPERA_MAX_MS - ESPERA_MIN_MS));

function comprobarBloqueo(res, que) {
  if (res.status === 403 || res.status === 429) {
    throw new BloqueoDetectado(`HTTP ${res.status} ${que}`);
  }
}

async function almacenDe(cp) {
  const res = await fetch(`${BASE}/postal-codes/actions/change-pc/`, {
    method: 'PUT',
    headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ new_postal_code: cp }),
  });
  comprobarBloqueo(res, `resolviendo el CP ${cp}`);
  if (!res.ok) return { error: `HTTP ${res.status}` };
  return { wh: res.headers.get('x-customer-wh') };
}

async function precioDe(sku, wh) {
  const res = await fetch(`${BASE}/products/${sku}/?lang=es&wh=${wh}`, {
    headers: { 'User-Agent': USER_AGENT },
  });
  comprobarBloqueo(res, `pidiendo el producto ${sku} en ${wh}`);
  if (res.status === 404) return { fuera: true };
  if (!res.ok) return { error: `HTTP ${res.status}` };
  const j = await res.json();
  const pi = j.price_instructions ?? {};
  return {
    precio: pi.unit_price != null ? Number(pi.unit_price) : null,
    porUnidad: pi.bulk_price != null ? Number(pi.bulk_price) : null,
    nombre: j.display_name,
  };
}

const eur = (n) => (n == null ? '—' : n.toFixed(2));

async function main() {
  const datos = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'motor-datos.json'), 'utf8'));
  const skus = Object.values(datos.skus);

  console.log('=== FASE 1 · ¿a qué almacén cae cada código postal? ===\n');
  const almacenes = new Map();
  for (const { cp, zona } of CODIGOS) {
    const r = await almacenDe(cp);
    console.log(`  ${cp}  ${zona.padEnd(24)} -> ${r.wh ?? r.error ?? 'sin cabecera'}`);
    if (r.wh && !almacenes.has(r.wh)) almacenes.set(r.wh, `${zona} (${cp})`);
    await pausaEducada();
  }

  const lista = [...almacenes.keys()];
  console.log(`\n  ${CODIGOS.length} códigos postales -> ${lista.length} almacenes distintos: ${lista.join(', ')}`);
  if (lista.length < 2) {
    console.log('\n  Con un solo almacén no hay nada que comparar.');
    return;
  }

  console.log(`\n=== FASE 2 · nuestros ${skus.length} productos en cada almacén ===`);
  console.log(`  ${skus.length * lista.length} peticiones a ${ESPERA_MIN_MS}-${ESPERA_MAX_MS} ms. Paro en el primer 403/429.\n`);

  /** sku -> { wh -> precio } */
  const tabla = new Map();
  for (const wh of lista) {
    let hechos = 0;
    for (const s of skus) {
      const r = await precioDe(s.sku, wh);
      if (!tabla.has(s.sku)) tabla.set(s.sku, { nombre: s.nombre, base: s.precio, por: {} });
      tabla.get(s.sku).por[wh] = r.fuera ? 'no lo tiene' : (r.error ?? r.precio);
      hechos++;
      if (hechos % 25 === 0) console.log(`  ${wh}: ${hechos}/${skus.length}`);
      await pausaEducada();
    }
    console.log(`  ${wh}: ${hechos}/${skus.length} listo`);
  }

  console.log('\n=== RESULTADO ===\n');
  const distintos = [];
  const faltan = [];
  for (const [sku, fila] of tabla) {
    const valores = lista.map((wh) => fila.por[wh]);
    const numericos = valores.filter((v) => typeof v === 'number');
    if (valores.some((v) => v === 'no lo tiene')) faltan.push({ sku, ...fila });
    if (numericos.length > 1 && new Set(numericos.map((v) => v.toFixed(2))).size > 1) {
      distintos.push({ sku, ...fila, min: Math.min(...numericos), max: Math.max(...numericos) });
    }
  }

  console.log(`Productos con precio DISTINTO entre almacenes: ${distintos.length} de ${skus.length}`);
  console.log(`Productos que algún almacén NO tiene:          ${faltan.length} de ${skus.length}\n`);

  if (distintos.length) {
    distintos.sort((a, b) => (b.max - b.min) - (a.max - a.min));
    console.log(`${'producto'.padEnd(40)} ${lista.map((w) => w.padStart(7)).join('')}   dif`);
    for (const d of distintos.slice(0, 25)) {
      console.log(
        `${d.nombre.slice(0, 39).padEnd(40)} `
        + lista.map((wh) => eur(typeof d.por[wh] === 'number' ? d.por[wh] : null).padStart(6)).join(' ')
        + `   ${eur(d.max - d.min)}`,
      );
    }
  }

  if (faltan.length) {
    console.log('\nNo disponibles en algún almacén:');
    for (const f of faltan.slice(0, 20)) {
      console.log(`  ${f.nombre.slice(0, 44).padEnd(45)} ${lista.map((wh) => String(f.por[wh]).padStart(12)).join('')}`);
    }
  }

  // Lo que de verdad decide: cuánto cambia la semana entera.
  console.log('\n=== LO QUE CAMBIA UNA CESTA COMPLETA ===');
  for (const wh of lista) {
    let suma = 0, sinPrecio = 0;
    for (const [, fila] of tabla) {
      const v = fila.por[wh];
      if (typeof v === 'number') suma += v; else sinPrecio++;
    }
    console.log(`  ${wh.padEnd(6)} ${almacenes.get(wh).padEnd(28)} suma de los 108: ${eur(suma).padStart(8)} €  (sin precio: ${sinPrecio})`);
  }

  fs.writeFileSync(
    path.join(__dirname, `almacenes-${new Date().toISOString().slice(0, 10)}.json`),
    JSON.stringify({ almacenes: Object.fromEntries(almacenes), tabla: Object.fromEntries(tabla) }, null, 1),
  );
}

main().catch((e) => {
  if (e instanceof BloqueoDetectado) {
    console.error(`\nPARO: ${e.message}`);
    console.error('El servidor ha respondido algo que huele a bloqueo. No se reintenta.');
    process.exit(2);
  }
  console.error(e);
  process.exit(1);
});
