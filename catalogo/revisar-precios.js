#!/usr/bin/env node
/**
 * Revisa el precio de LOS SKU QUE USA LA APP contra Mercadona y reporta lo que
 * ha cambiado. Esto es lo que va al cron diario, no `extraer.js`.
 *
 * Por qué no `extraer.js`: ese recorre el árbol entero de categorías —152
 * peticiones para 4.606 productos— y escribe un volcado de 4,6 MB. Sirve para
 * descubrir catálogo nuevo, que es una tarea de mes, no de día. Para saber si
 * el carrito de la app sigue costando lo que dice basta con preguntar por los
 * ~108 productos elegidos, uno a uno, contra `/api/products/{sku}/`.
 *
 * Reglas de ejecución (idénticas a extraer.js, y no negociables):
 *   - 300-500 ms entre peticiones. Nunca concurrente.
 *   - User-Agent identificable con contacto.
 *   - 403/429 o cualquier respuesta que huela a bloqueo: PARAR y reportar.
 *     Ni reintentos, ni rotación de cabeceras, ni proxies. Esa decisión es del
 *     negocio, no de un script en un cron.
 *
 * Uso:
 *   node revisar-precios.js [almacen]
 *   node revisar-precios.js mad3
 *
 * Salida: un informe por consola y un JSON en catalogo/precios-<fecha>.json
 * con lo que ha cambiado. NO toca motor-datos.json: decidir si se actualiza el
 * precio que ve el usuario es una acción con consecuencias y la revisa una
 * persona. El script informa; no publica.
 *
 * Códigos de salida, para que el cron pueda distinguir:
 *   0  todo revisado, con o sin cambios
 *   1  bloqueo detectado o error de red persistente
 *   2  hay productos que ya no existen (descatalogados)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BASE = 'https://tienda.mercadona.es/api';
const USER_AGENT =
  'CundeCatalogBot/0.1 (+contacto: iyiarce@gmail.com; revision diaria de precios de ~108 productos para una app de listas de la compra, uso interno)';
const ESPERA_MIN_MS = 300;
const ESPERA_MAX_MS = 500;
const ALMACEN = process.argv[2] || 'mad3';

/** Cuánto tiene que moverse un precio para que merezca mirarlo. */
const CAMBIO_RELEVANTE = 0.01;
/** Y a partir de cuánto es una alerta y no una nota. */
const CAMBIO_GRANDE = 0.10;

class BloqueoDetectado extends Error {}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const pausaEducada = () =>
  esperar(ESPERA_MIN_MS + Math.random() * (ESPERA_MAX_MS - ESPERA_MIN_MS));

async function pedirProducto(sku) {
  let res;
  try {
    res = await fetch(`${BASE}/products/${sku}/?lang=es&wh=${ALMACEN}`, {
      headers: { 'User-Agent': USER_AGENT },
    });
  } catch (err) {
    throw new Error(`red: ${err.message}`);
  }
  if (res.status === 403 || res.status === 429) {
    throw new BloqueoDetectado(`HTTP ${res.status} en el sku ${sku}`);
  }
  // 404 no es bloqueo: es un producto que ya no está. Se reporta aparte.
  if (res.status === 404) return null;
  const tipo = res.headers.get('content-type') || '';
  if (!res.ok || !tipo.includes('application/json')) {
    const cuerpo = await res.text();
    throw new BloqueoDetectado(
      `respuesta inesperada en el sku ${sku}: HTTP ${res.status}, content-type "${tipo}". ${cuerpo.slice(0, 160)}`
    );
  }
  return res.json();
}

/** El precio unitario tal y como lo guarda el motor. */
function precioDe(detalle) {
  const p = detalle?.price_instructions;
  if (!p) return null;
  const unitario = Number(p.unit_price);
  return Number.isFinite(unitario) ? unitario : null;
}

async function main() {
  const rutaDatos = path.join(__dirname, '..', 'src', 'data', 'motor-datos.json');
  const datos = JSON.parse(fs.readFileSync(rutaDatos, 'utf8'));
  const skus = Object.entries(datos.skus).map(([canonico, s]) => ({ canonico, ...s }));

  console.log(`Revisando ${skus.length} productos en el almacén ${ALMACEN}.`);
  console.log(`Referencia: motor-datos.json generado el ${datos.generadoEn}.`);
  console.log(`Ritmo: ${ESPERA_MIN_MS}-${ESPERA_MAX_MS} ms entre peticiones. Paro en el primer 403/429.\n`);

  const cambios = [];
  const desaparecidos = [];
  const fallos = [];
  let iguales = 0;

  for (const [i, s] of skus.entries()) {
    await pausaEducada();
    let detalle;
    try {
      detalle = await pedirProducto(s.sku);
    } catch (err) {
      if (err instanceof BloqueoDetectado) {
        console.error(`\nBLOQUEO. Paro aquí, en el producto ${i + 1} de ${skus.length}.`);
        console.error(`  ${err.message}`);
        console.error('\nNo reintento ni cambio cabeceras. Revisa si Mercadona ha cerrado el acceso');
        console.error('antes de volver a lanzarlo: si está bloqueando, insistir empeora la posición.');
        process.exit(1);
      }
      fallos.push(`${s.canonico} (${s.sku}): ${err.message}`);
      continue;
    }

    if (detalle === null) {
      desaparecidos.push(s);
      process.stdout.write('·');
      continue;
    }

    const ahora = precioDe(detalle);
    if (ahora === null) {
      fallos.push(`${s.canonico} (${s.sku}): sin precio en la respuesta`);
      continue;
    }
    const delta = ahora - s.precio;
    if (Math.abs(delta) < CAMBIO_RELEVANTE) {
      iguales++;
      process.stdout.write('.');
    } else {
      cambios.push({ ...s, precioNuevo: ahora, delta, nombreNuevo: detalle.display_name });
      process.stdout.write(delta > 0 ? '+' : '-');
    }
  }
  console.log('\n');

  cambios.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const subidas = cambios.filter((c) => c.delta > 0);
  const bajadas = cambios.filter((c) => c.delta < 0);

  console.log(`IGUALES: ${iguales} de ${skus.length}`);
  console.log(`CAMBIOS: ${cambios.length}  (${subidas.length} suben, ${bajadas.length} bajan)`);
  if (desaparecidos.length) console.log(`DESAPARECIDOS: ${desaparecidos.length}`);
  if (fallos.length) console.log(`SIN LEER: ${fallos.length}`);

  if (cambios.length) {
    console.log('\n  antes    ahora    dif      producto');
    for (const c of cambios) {
      const grande = Math.abs(c.delta / c.precio) >= CAMBIO_GRANDE ? '  <- más del 10%' : '';
      console.log(
        `  ${c.precio.toFixed(2).padStart(6)}  ${c.precioNuevo.toFixed(2).padStart(6)}  ` +
        `${(c.delta > 0 ? '+' : '') + c.delta.toFixed(2)}`.padStart(7) +
        `   ${c.nombre.slice(0, 42)}${grande}`
      );
    }
  }

  if (desaparecidos.length) {
    console.log('\nYA NO ESTÁN EN EL CATÁLOGO (el motor los sigue usando):');
    for (const d of desaparecidos) console.log(`  ${d.canonico.padEnd(24)} sku ${d.sku}  ${d.nombre.slice(0, 40)}`);
  }
  if (fallos.length) {
    console.log('\nNO SE PUDIERON LEER:');
    for (const f of fallos) console.log(`  ${f}`);
  }

  // El impacto en lo que ve el usuario, que es la única cifra que importa.
  if (cambios.length) {
    const suma = cambios.reduce((a, c) => a + c.delta, 0);
    console.log(`\nSuma de las diferencias: ${(suma > 0 ? '+' : '') + suma.toFixed(2)} €`);
    console.log('(no es lo que sube el carrito: depende de cuántos envases lleve cada semana)');
  }

  const fecha = new Date().toISOString().slice(0, 10);
  const salida = path.join(__dirname, `precios-${fecha}.json`);
  fs.writeFileSync(
    salida,
    JSON.stringify(
      {
        revisadoEn: new Date().toISOString(),
        almacen: ALMACEN,
        referencia: datos.generadoEn,
        total: skus.length,
        iguales,
        cambios,
        desaparecidos: desaparecidos.map((d) => ({ canonico: d.canonico, sku: d.sku, nombre: d.nombre })),
        fallos,
      },
      null,
      2
    ),
    'utf8'
  );
  console.log(`\nEscrito ${salida}`);
  console.log('No he tocado motor-datos.json: actualizar el precio que ve el usuario lo decide una persona.');

  process.exit(desaparecidos.length ? 2 : 0);
}

main().catch((err) => {
  console.error(`\nError no previsto: ${err.message}`);
  process.exit(1);
});
