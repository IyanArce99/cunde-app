#!/usr/bin/env node
/**
 * ¿FALTA EL PRODUCTO O FALTA EL SURTIDO?
 *
 * comparar-almacenes.js dijo que 25 de nuestros 108 SKU no existen en algún
 * almacén, y de ahí salió que en Sevilla no se puede comprar el 29% del
 * recetario. Esa conclusión solo vale si además NO HAY EQUIVALENTE: que falte
 * ese SKU de cordero no significa que falte el cordero.
 *
 * Aquí se mira la subfamilia entera —Carne/Cordero, Marisco y pescado/Dorada—
 * en cada almacén y se lista lo que sí hay. Si hay otro cordero, lo que
 * tenemos es un problema de MAPEO (elegimos un SKU de Madrid), no de surtido,
 * y se arregla eligiendo el SKU por almacén en vez de reescribir recetas.
 *
 * Mismo trato que siempre: 300-500 ms, sin concurrencia, User-Agent con
 * contacto, y parada seca al primer 403/429.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'https://tienda.mercadona.es/api';
const USER_AGENT =
  'CundeCatalogBot/0.1 (+contacto: iyiarce@gmail.com; comprobacion puntual de surtido equivalente en 6 almacenes para una app de listas de la compra, uso interno)';
const ESPERA_MIN_MS = 300;
const ESPERA_MAX_MS = 500;

const ALMACENES = [
  ['mad3', 'Madrid'], ['svq1', 'Sevilla'], ['bcn1', 'Barcelona'],
  ['4804', 'A Coruña'], ['4480', 'Oviedo'], ['3842', 'Palma'],
];

/** Las subfamilias de los productos que faltaban, y qué buscamos en ellas. */
const BUSCAR = [
  { familia: 'Cordero', que: 'chuletas de cordero' },
  { familia: 'Vacuno', que: 'entrecot y filetes de vacuno' },
  { familia: 'Dorada', que: 'dorada' },
  { familia: 'Lubina', que: 'lubina' },
];

class BloqueoDetectado extends Error {}
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const pausa = () => esperar(ESPERA_MIN_MS + Math.random() * (ESPERA_MAX_MS - ESPERA_MIN_MS));

async function pedir(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (res.status === 403 || res.status === 429) throw new BloqueoDetectado(`HTTP ${res.status} en ${url}`);
  if (!res.ok) return null;
  return res.json();
}

async function main() {
  const salida = {};
  for (const [wh, zona] of ALMACENES) {
    console.log(`\n########## ${wh} · ${zona}`);
    const arbol = await pedir(`${BASE}/categories/?lang=es&wh=${wh}`);
    await pausa();
    if (!arbol) { console.log('  no devuelve el árbol'); continue; }

    // El árbol es departamento -> familias. Se buscan las familias por nombre.
    const familias = [];
    for (const dep of arbol.results) {
      for (const fam of dep.categories ?? []) familias.push({ id: fam.id, nombre: fam.name, dep: dep.name });
    }

    salida[wh] = {};
    for (const { familia, que } of BUSCAR) {
      const f = familias.find((x) => x.nombre.toLowerCase() === familia.toLowerCase());
      if (!f) {
        console.log(`  ${familia.padEnd(10)} LA FAMILIA NO EXISTE en este almacén`);
        salida[wh][familia] = null;
        continue;
      }
      const detalle = await pedir(`${BASE}/categories/${f.id}/?lang=es&wh=${wh}`);
      await pausa();
      const productos = [];
      for (const sub of detalle?.categories ?? []) {
        for (const p of sub.products ?? []) {
          productos.push({
            sku: p.id,
            nombre: p.display_name,
            precio: p.price_instructions?.unit_price != null ? Number(p.price_instructions.unit_price) : null,
          });
        }
      }
      salida[wh][familia] = productos;
      console.log(`  ${familia.padEnd(10)} ${String(productos.length).padStart(2)} productos  (buscábamos: ${que})`);
      for (const p of productos.slice(0, 6)) {
        console.log(`      ${String(p.sku).padStart(6)}  ${(p.precio == null ? '—' : p.precio.toFixed(2)).padStart(6)} €  ${p.nombre}`);
      }
    }
  }
  fs.writeFileSync(path.join(__dirname, 'alternativas-almacen.json'), JSON.stringify(salida, null, 1));
  console.log('\nGuardado en catalogo/alternativas-almacen.json');
}

main().catch((e) => {
  if (e instanceof BloqueoDetectado) {
    console.error(`\nPARO: ${e.message}`);
    process.exit(2);
  }
  console.error(e);
  process.exit(1);
});
