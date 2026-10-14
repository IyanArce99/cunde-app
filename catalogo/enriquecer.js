#!/usr/bin/env node
/**
 * Alérgenos reales por EAN, no adivinados por el nombre del producto.
 *
 * El sistema anterior cruzaba el NOMBRE del SKU contra palabras delatoras.
 * Falló de verdad una vez: "Aceitunas verdes rellenas de anchoa" pasaba por
 * un canónico declarado vegetal y se servía a quien excluía pescado. Y solo
 * caza lo evidente — un caldo con lactosa o un embutido con gluten no lo
 * llevan en el nombre.
 *
 * Dos fuentes, por orden de fiabilidad:
 *   1. El propio detalle de Mercadona. `nutrition_information.ingredients`
 *      trae la lista legal completa con los alérgenos en <strong>, que es
 *      justo el resaltado que obliga el reglamento 1169/2011. Cobertura
 *      prácticamente total en producto español.
 *   2. Open Food Facts por EAN, como contraste independiente.
 *
 * Uso:  node enriquecer.js            (solo los SKU elegidos, ~100)
 *       node enriquecer.js --todos    (todos los candidatos del mapeo)
 *
 * Ritmo educado: pausa entre peticiones y User-Agent identificable. Si el
 * servidor responde 403 o 429 se PARA — no se reintenta ni se disimula.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const RUTA_PROPUESTO = path.join(aqui, 'mapeo-propuesto.json');
const RUTA_ELEGIDO = path.join(aqui, 'mapeo-elegido.json');
const RUTA_SALIDA = path.join(aqui, 'alergenos-por-ean.json');

const UA = 'Cunde/0.1 (app de compra semanal; contacto: iyiarce@gmail.com)';
// Ritmos distintos por servidor: Mercadona aguanta bien, Open Food Facts nos
// devolvió 429 a 3 peticiones por segundo. Su límite documentado para lectura
// de producto son 100/min, así que nos quedamos holgadamente por debajo.
const PAUSA_MERCADONA = 320;
const PAUSA_OFF = 900;

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

class BloqueoDetectado extends Error {}

/**
 * `critico` distingue las dos dependencias. Mercadona es la fuente que de
 * verdad hace falta: si nos corta, se para. Open Food Facts es contraste
 * secundario y nos limita el ritmo aunque vayamos despacio — ahí, cuando
 * dice que paremos, paramos DE CONSULTARLO y seguimos con lo demás. Dejar
 * que un extra bloquee una auditoría de alérgenos sería lo peor de los dos
 * mundos: ni el dato ni el aviso.
 */
async function pedir(url, { critico = true } = {}) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (res.status === 403 || res.status === 429) {
    if (critico) throw new BloqueoDetectado(`${res.status} en ${url} — el servidor dice que paremos`);
    return { bloqueado: true };
  }
  if (res.status === 404) return null;
  if (!res.ok) return null;
  return res.json();
}

// --- Traducción de lo que declaran las etiquetas a nuestro vocabulario -----

import { deMercadona, TAGS_OFF } from './alergenos-etiqueta.js';

function deOff(producto) {
  if (!producto) return { encontrado: false, alergenos: [], trazas: [] };
  const traducir = (tags) => [...new Set((tags ?? []).map((t) => TAGS_OFF[t]).filter(Boolean))].sort();
  return {
    encontrado: true,
    nombre: producto.product_name ?? null,
    alergenos: traducir(producto.allergens_tags),
    trazas: traducir(producto.traces_tags),
    analisis: producto.ingredients_analysis_tags ?? [],
  };
}

// ---------------------------------------------------------------------------

/**
 * Vuelve a clasificar sin pedir nada a la red: el texto crudo de la etiqueta
 * ya está guardado. Sirve para corregir el clasificador sin volver a
 * molestar a los dos servidores.
 */
function recalcular() {
  const salida = JSON.parse(fs.readFileSync(RUTA_SALIDA, 'utf8'));
  for (const registro of Object.values(salida)) {
    const m = deMercadona({
      ingredients: registro.mercadona?.ingredientes ?? '',
      allergens: registro.mercadona?.alergenosTexto ?? '',
    });
    registro.mercadona = { ...registro.mercadona, contiene: m.contiene, trazas: m.trazas };
    registro.alergenos = [...new Set([...m.contiene, ...(registro.off?.alergenos ?? [])])].sort((a, b) => a.localeCompare(b));
    registro.trazas = [...new Set([...m.trazas, ...(registro.off?.trazas ?? [])])].sort((a, b) => a.localeCompare(b));
  }
  fs.writeFileSync(RUTA_SALIDA, JSON.stringify(salida, null, 2), 'utf8');
  console.log(`Reclasificados ${Object.keys(salida).length} SKU desde el texto guardado, sin red.`);
}

async function main() {
  if (process.argv.includes('--recalcular')) return recalcular();
  const todos = process.argv.includes('--todos');
  const propuesto = JSON.parse(fs.readFileSync(RUTA_PROPUESTO, 'utf8'));

  const skus = new Map(); // sku -> { nombre, canonicos:Set }
  const anotar = (sku, nombre, canonico) => {
    if (!skus.has(sku)) skus.set(sku, { nombre, canonicos: new Set() });
    skus.get(sku).canonicos.add(canonico);
  };

  if (todos) {
    for (const [canonico, info] of Object.entries(propuesto)) {
      for (const c of info.candidatos) anotar(c.sku, c.nombre, canonico);
    }
  } else {
    const elegido = JSON.parse(fs.readFileSync(RUTA_ELEGIDO, 'utf8'));
    for (const [canonico, sku] of Object.entries(elegido)) {
      const c = propuesto[canonico]?.candidatos.find((x) => x.sku === sku);
      if (c) anotar(sku, c.nombre, canonico);
    }
  }

  const previo = fs.existsSync(RUTA_SALIDA) ? JSON.parse(fs.readFileSync(RUTA_SALIDA, 'utf8')) : {};
  const salida = { ...previo };
  const lista = [...skus.entries()].filter(([sku]) => !salida[sku]);

  console.log(`${skus.size} SKU a mirar · ${lista.length} pendientes · pausas ${PAUSA_MERCADONA}/${PAUSA_OFF} ms`);
  let conOff = 0;
  let sinOff = 0;
  let fallos = 0;
  let offCortado = false;

  try {
    for (const [i, [sku, meta]] of lista.entries()) {
      const detalle = await pedir(`https://tienda.mercadona.es/api/products/${sku}/`);
      await esperar(PAUSA_MERCADONA);
      if (!detalle) { fallos++; continue; }

      const mercadona = deMercadona(detalle.nutrition_information);
      let off = { encontrado: false, alergenos: [], trazas: [] };
      if (detalle.ean && !offCortado) {
        const j = await pedir(
          `https://world.openfoodfacts.org/api/v2/product/${detalle.ean}.json`
          + '?fields=code,product_name,allergens_tags,traces_tags,ingredients_analysis_tags',
          { critico: false },
        );
        await esperar(PAUSA_OFF);
        if (j?.bloqueado) {
          offCortado = true;
          console.log('  Open Food Facts nos corta el ritmo: sigo solo con la etiqueta de Mercadona.');
        } else {
          off = deOff(j?.status === 1 ? j.product : null);
        }
      }
      if (off.encontrado) conOff++; else sinOff++;

      salida[sku] = {
        sku,
        ean: detalle.ean ?? null,
        nombre: meta.nombre,
        canonicos: [...meta.canonicos].sort((a, b) => a.localeCompare(b)),
        mercadona,
        off,
        // Lo que el producto LLEVA: la etiqueta de Mercadona más lo que
        // declare Open Food Facts. Las trazas van aparte a propósito.
        alergenos: [...new Set([...mercadona.contiene, ...off.alergenos])].sort((a, b) => a.localeCompare(b)),
        trazas: [...new Set([...mercadona.trazas, ...(off.trazas ?? [])])].sort((a, b) => a.localeCompare(b)),
      };

      if ((i + 1) % 20 === 0) {
        console.log(`  ${i + 1}/${lista.length}…`);
        fs.writeFileSync(RUTA_SALIDA, JSON.stringify(salida, null, 2), 'utf8');
      }
    }
  } catch (e) {
    if (e instanceof BloqueoDetectado) {
      console.error(`\nPARADO: ${e.message}`);
      fs.writeFileSync(RUTA_SALIDA, JSON.stringify(salida, null, 2), 'utf8');
      process.exit(2);
    }
    throw e;
  }

  fs.writeFileSync(RUTA_SALIDA, JSON.stringify(salida, null, 2), 'utf8');
  console.log(`\nGuardado ${RUTA_SALIDA}`);
  console.log(`  con datos de Open Food Facts: ${conOff}`);
  console.log(`  sin datos de Open Food Facts: ${sinOff}`);
  console.log(`  SKU que no respondieron: ${fallos}`);
  const conIngredientes = Object.values(salida).filter((x) => x.mercadona?.ingredientes).length;
  console.log(`  con lista de ingredientes de Mercadona: ${conIngredientes} de ${Object.keys(salida).length}`);
}

main();
