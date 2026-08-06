#!/usr/bin/env node
/**
 * Extrae el catálogo de Mercadona para un almacén, recorriendo el árbol de
 * categorías. No hay listado plano de productos (GET /api/products/ da
 * 404): hay que bajar nivel a nivel.
 *
 * Forma real del árbol (verificada contra la API, no contra documentación):
 *   GET /api/categories/?wh=<almacen>        -> ~26 departamentos, cada uno
 *                                               con una lista de "familias"
 *                                               (id + nombre, sin productos)
 *   GET /api/categories/<id_familia>/?wh=... -> la familia, con sus
 *                                               "subfamilias" y ahí sí,
 *                                               los productos de cada una
 *
 * O sea: 1 petición para el árbol + 1 petición por familia (~151). No hace
 * falta bajar un nivel más: los productos ya vienen embebidos en la
 * respuesta de la familia.
 *
 * Uso:
 *   node extraer.js [almacen] [codigo_postal]
 *   node extraer.js mad3 28005
 *
 * Reglas de ejecución (no negociables — ver CLAUDE.md y el encargo):
 *   - 300-500 ms de espera entre peticiones. Nunca concurrente.
 *   - User-Agent identificable con contacto.
 *   - Si el servidor responde 403/429 o algo que huela a bloqueo: PARAR y
 *     reportarlo. Nunca rotar cabeceras, nunca proxies, nunca evasión.
 *     Esa decisión es del negocio, no de este script.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BASE = 'https://tienda.mercadona.es/api';
const USER_AGENT =
  'CundeCatalogBot/0.1 (+contacto: iyiarce@gmail.com; extraccion puntual de catalogo para app de listas de la compra, uso interno, no publicado)';
const ESPERA_MIN_MS = 300;
const ESPERA_MAX_MS = 500;
const MUESTRA_EAN = 25; // productos al azar de los que se pide la ficha individual, solo para medir cobertura de EAN/marca

const ALMACEN = process.argv[2] || 'mad3';
const CODIGO_POSTAL = process.argv[3] || '28005';
const DIR_SALIDA = __dirname;
const AHORA = new Date();
const FECHA = AHORA.toISOString().slice(0, 10);
const AHORA_ISO = AHORA.toISOString();

class BloqueoDetectado extends Error {}

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pausaEducada() {
  return esperar(ESPERA_MIN_MS + Math.random() * (ESPERA_MAX_MS - ESPERA_MIN_MS));
}

/**
 * Envoltorio de fetch: detecta señales de bloqueo y no intenta evadirlas.
 * Un solo reintento (con pausa larga) para cortes de red normales; cero
 * reintentos para 403/429, ahí paramos de verdad.
 */
async function peticionJson(url, intentoDeReintento = false) {
  let res;
  try {
    res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  } catch (err) {
    if (intentoDeReintento) throw err;
    console.log(`\n  (fallo de red, un reintento tras 2s: ${err.message})`);
    await esperar(2000);
    return peticionJson(url, true);
  }

  if (res.status === 403 || res.status === 429) {
    throw new BloqueoDetectado(`HTTP ${res.status} en ${url}`);
  }
  const tipo = res.headers.get('content-type') || '';
  if (!res.ok || !tipo.includes('application/json')) {
    // Un 500 puntual o una página de challenge disfrazada de 200 caen aquí.
    // No es necesariamente un bloqueo activo, pero tampoco es una respuesta
    // normal: lo tratamos con la misma cautela y paramos a reportar.
    const cuerpo = await res.text();
    throw new BloqueoDetectado(
      `Respuesta inesperada en ${url}: HTTP ${res.status}, content-type "${tipo}". Primeros 200 caracteres: ${cuerpo.slice(0, 200)}`
    );
  }
  return res.json();
}

async function resolverAlmacen() {
  const res = await fetch(`${BASE}/postal-codes/actions/change-pc/`, {
    method: 'PUT',
    headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ new_postal_code: CODIGO_POSTAL }),
  });
  if (res.status === 403 || res.status === 429) {
    throw new BloqueoDetectado(`HTTP ${res.status} resolviendo el código postal`);
  }
  const whResuelto = res.headers.get('x-customer-wh');
  if (whResuelto && whResuelto !== ALMACEN) {
    console.log(`Aviso: el CP ${CODIGO_POSTAL} resuelve a "${whResuelto}", no a "${ALMACEN}". Uso "${whResuelto}".`);
    return whResuelto;
  }
  return ALMACEN;
}

async function obtenerFamilias(almacen) {
  const arbol = await peticionJson(`${BASE}/categories/?lang=es&wh=${almacen}`);
  const familias = [];
  for (const departamento of arbol.results) {
    for (const familia of departamento.categories) {
      familias.push({ id: familia.id, departamento: departamento.name });
    }
  }
  return familias;
}

/**
 * El esquema de salida es una decisión propia, no uno dado de antemano.
 * Nombres en español porque así está el resto del modelo de datos en
 * CLAUDE.md. Todo lo numérico se guarda como número, nunca como texto a
 * parsear luego — la API ya lo da así.
 */
function normalizarProducto(p, ctx, almacen) {
  const pi = p.price_instructions || {};
  const numeroOn = (v) => (v === null || v === undefined || v === '' ? null : Number(String(v).trim()));
  return {
    cadena: 'mercadona',
    almacen,
    sku: p.id,
    nombre: p.display_name,
    packaging: p.packaging || null,
    departamento: ctx.departamento,
    familia: ctx.familia,
    subfamilia: ctx.subfamilia,
    precio: numeroOn(pi.unit_price),
    precio_anterior: numeroOn(pi.previous_unit_price),
    bajada_precio: !!pi.price_decreased,
    precio_referencia: numeroOn(pi.reference_price),
    formato_referencia: pi.reference_format || null,
    contenido: numeroOn(pi.unit_size),
    unidad_contenido: pi.size_format || null,
    peso_variable: !!pi.approx_size, // fruta/verdura/carnicería: el peso es una media, no el real de la pieza
    es_pack: !!pi.is_pack,
    tamano_pack: numeroOn(pi.pack_size),
    unidades_pack: numeroOn(pi.total_units),
    nombre_unidad_pack: pi.unit_name || null,
    peso_escurrido: numeroOn(pi.drained_weight),
    iva: numeroOn(pi.tax_percentage),
    requiere_verificacion_edad: !!(p.badges && p.badges.requires_age_check),
    es_agua: !!(p.badges && p.badges.is_water),
    slug: p.slug,
    url: p.share_url,
    imagen: p.thumbnail,
    // Deliberadamente ausentes aquí: ean y brand. No vienen en el listado
    // por categoría, solo en la ficha individual de cada producto (ver
    // el bloque de muestreo al final y el diagnóstico que acompaña esto).
    capturado_en: AHORA_ISO,
  };
}

function guardarJson(nombreFichero, datos) {
  const ruta = path.join(DIR_SALIDA, nombreFichero);
  fs.writeFileSync(ruta, JSON.stringify(datos, null, 2), 'utf8');
  return ruta;
}

async function muestrearEan(catalogo, almacen) {
  const candidatos = catalogo.filter((p) => p.precio !== null);
  const muestra = [];
  const usados = new Set();
  while (muestra.length < Math.min(MUESTRA_EAN, candidatos.length)) {
    const idx = Math.floor(Math.random() * candidatos.length);
    if (usados.has(idx)) continue;
    usados.add(idx);
    muestra.push(candidatos[idx]);
  }

  let conEan = 0;
  let conMarca = 0;
  const errores = [];
  for (const producto of muestra) {
    await pausaEducada();
    try {
      const detalle = await peticionJson(`${BASE}/products/${producto.sku}/?wh=${almacen}`);
      if (detalle.ean) conEan++;
      if (detalle.brand) conMarca++;
    } catch (err) {
      if (err instanceof BloqueoDetectado) throw err;
      errores.push(`${producto.sku}: ${err.message}`);
    }
  }
  return { tamanoMuestra: muestra.length, conEan, conMarca, errores };
}

async function main() {
  console.log(`Almacén objetivo: ${ALMACEN} (CP ${CODIGO_POSTAL})`);
  const almacen = await resolverAlmacen();
  await pausaEducada();

  console.log('Descargando árbol de categorías...');
  const familias = await obtenerFamilias(almacen);
  console.log(`${familias.length} familias a recorrer (1 petición cada una).\n`);

  const catalogo = [];
  const conteoPorDepartamento = {};
  let crudaGuardada = null;
  const inicio = Date.now();

  for (let i = 0; i < familias.length; i++) {
    const { id, departamento } = familias[i];
    process.stdout.write(`[${i + 1}/${familias.length}] familia ${id} (${departamento})... `);

    let detalle;
    try {
      detalle = await peticionJson(`${BASE}/categories/${id}/?lang=es&wh=${almacen}`);
    } catch (err) {
      if (err instanceof BloqueoDetectado) {
        console.log('\n\n*** BLOQUEO DETECTADO — PARANDO, SIN REINTENTAR, SIN EVADIR ***');
        console.log(err.message);
        const ruta = guardarJson(
          `catalogo_mercadona_${almacen}_${FECHA}_PARCIAL.json`,
          catalogo
        );
        console.log(`Guardado lo recogido hasta ahora (${catalogo.length} productos, ${i}/${familias.length} familias) en:\n  ${ruta}`);
        process.exitCode = 1;
        return;
      }
      throw err;
    }

    if (!crudaGuardada) {
      crudaGuardada = guardarJson(`categoria_cruda_${FECHA}.json`, detalle);
    }

    let productosEnFamilia = 0;
    for (const subfamilia of detalle.categories || []) {
      for (const p of subfamilia.products || []) {
        catalogo.push(
          normalizarProducto(p, { departamento, familia: detalle.name, subfamilia: subfamilia.name }, almacen)
        );
        productosEnFamilia++;
      }
    }
    conteoPorDepartamento[departamento] = (conteoPorDepartamento[departamento] || 0) + productosEnFamilia;
    console.log(`${productosEnFamilia} productos`);

    if (i < familias.length - 1) await pausaEducada();
  }

  const duracionSeg = (Date.now() - inicio) / 1000;

  console.log('\nMidiendo cobertura de EAN/marca con una muestra (esto no forma parte del catálogo, es solo diagnóstico)...');
  const muestraEan = await muestrearEan(catalogo, almacen);

  console.log('\nDescargando bajadas de precio del día...');
  await pausaEducada();
  const bajadas = await peticionJson(`${BASE}/home/price-drops/?lang=es&wh=${almacen}`);

  const rutaCatalogo = guardarJson(`catalogo_mercadona_${almacen}_${FECHA}.json`, catalogo);
  const rutaBajadas = guardarJson(`bajadas_precio_${almacen}_${FECHA}.json`, bajadas);

  // --- diagnóstico ---
  const conPrecio = catalogo.filter((p) => p.precio !== null);
  const sinPrecio = catalogo.filter((p) => p.precio === null);
  const porPackaging = {};
  const porUnidad = {};
  let esPack = 0;
  let pesoVariable = 0;
  for (const p of catalogo) {
    porPackaging[p.packaging || '(sin packaging)'] = (porPackaging[p.packaging || '(sin packaging)'] || 0) + 1;
    porUnidad[p.unidad_contenido || '(sin unidad)'] = (porUnidad[p.unidad_contenido || '(sin unidad)'] || 0) + 1;
    if (p.es_pack) esPack++;
    if (p.peso_variable) pesoVariable++;
  }

  console.log('\n\n========== DIAGNÓSTICO ==========');
  console.log(`Almacén: ${almacen}`);
  console.log(`Familias recorridas: ${familias.length}  (+ 1 árbol + 1 bajadas + ${muestraEan.tamanoMuestra} fichas de muestra = ${familias.length + 2 + muestraEan.tamanoMuestra} peticiones totales)`);
  console.log(`Duración: ${(duracionSeg / 60).toFixed(1)} min (${duracionSeg.toFixed(0)} s)`);
  console.log(`\nProductos totales: ${catalogo.length}`);
  console.log(`  con precio: ${conPrecio.length}`);
  console.log(`  sin precio: ${sinPrecio.length}${sinPrecio.length ? ' — ejemplos: ' + sinPrecio.slice(0, 5).map((p) => p.nombre).join(' | ') : ''}`);
  console.log(`\nUnidad de contenido (unidad_contenido), distribución:`);
  Object.entries(porUnidad).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  console.log(`\npackaging, distribución:`);
  Object.entries(porPackaging).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  console.log(`\nes_pack (multi-unidad): ${esPack} (${((esPack / catalogo.length) * 100).toFixed(1)}%)`);
  console.log(`peso_variable (fruta/verdura/carne a peso): ${pesoVariable} (${((pesoVariable / catalogo.length) * 100).toFixed(1)}%)`);
  console.log(`\nMuestra EAN/marca (n=${muestraEan.tamanoMuestra}):`);
  console.log(`  con EAN: ${muestraEan.conEan}/${muestraEan.tamanoMuestra} (${((muestraEan.conEan / muestraEan.tamanoMuestra) * 100).toFixed(0)}%)`);
  console.log(`  con marca: ${muestraEan.conMarca}/${muestraEan.tamanoMuestra} (${((muestraEan.conMarca / muestraEan.tamanoMuestra) * 100).toFixed(0)}%)`);
  if (muestraEan.errores.length) console.log(`  errores en la muestra: ${muestraEan.errores.join('; ')}`);
  console.log(`\nProductos por departamento:`);
  Object.entries(conteoPorDepartamento).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  console.log(`\nFicheros guardados:`);
  console.log(`  catálogo:        ${rutaCatalogo}`);
  console.log(`  categoría cruda: ${crudaGuardada}`);
  console.log(`  bajadas precio:  ${rutaBajadas}`);
  console.log('==================================\n');
}

main().catch((err) => {
  console.error('\nFALLO NO CONTROLADO:', err);
  process.exitCode = 1;
});
