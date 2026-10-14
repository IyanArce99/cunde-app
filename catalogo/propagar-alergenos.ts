#!/usr/bin/env node --experimental-strip-types
/**
 * Lleva lo que dice la ETIQUETA al vocabulario canónico.
 *
 * enriquecer.js lee la etiqueta legal de cada SKU y la guarda en
 * alergenos-por-ean.json. Hasta ahora ese fichero solo servía para que la
 * guardia de generar.ts se quejara; el vocabulario había que corregirlo a
 * mano, uno a uno, y así se quedaron fuera el apio del caldo y la soja de la
 * picada aunque el dato llevaba semanas en disco.
 *
 * Reglas:
 *   · Solo AÑADE. Quitar un alérgeno del vocabulario es decisión humana: la
 *     etiqueta de un SKU no prueba que el ingrediente canónico esté limpio,
 *     solo que ese producto concreto lo está.
 *   · `alergenos` y `trazas` van separados. Una traza no es un ingrediente.
 *   · Solo lo que el enum Alergeno sabe filtrar. Guardar un alérgeno que
 *     luego no se puede excluir es peor que no guardarlo.
 *
 * Uso:  node --experimental-strip-types catalogo/propagar-alergenos.ts
 *       node --experimental-strip-types catalogo/propagar-alergenos.ts --seco
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Alergeno } from '../src/motor/tipos.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const RUTA_EAN = path.join(aqui, 'alergenos-por-ean.json');
const RUTA_ELEGIDO = path.join(aqui, 'mapeo-elegido.json');
const RUTA_INGREDIENTES = path.join(aqui, '..', 'docs', 'ingredientes-canonicos.json');

const leer = (r: string) => JSON.parse(fs.readFileSync(r, 'utf8'));

/** Lo que el motor sabe excluir hoy. Ver Alergeno en src/motor/tipos.ts. */
const FILTRABLES = new Set<Alergeno>([
  'gluten', 'lactosa', 'frutos_secos', 'cerdo', 'marisco', 'apio', 'soja', 'sulfitos',
  'huevo', 'pescado', 'cacahuete', 'sesamo', 'mostaza',
]);

/**
 * Cuando el propio `origen` ya lo dice, no se repite en `alergenos`: un
 * canónico de origen "huevo" no necesita llevar además el alérgeno huevo, y
 * duplicarlo solo da ruido al revisar el vocabulario a mano. Las TRAZAS sí se
 * guardan siempre — ahí el origen no dice nada.
 */
const IMPLICA: Record<string, string> = {
  huevo: 'huevo', pescado: 'pescado', marisco: 'marisco', lacteo: 'lactosa',
};

function main() {
  const seco = process.argv.includes('--seco');
  const porEan = leer(RUTA_EAN);
  const elegido: Record<string, string> = leer(RUTA_ELEGIDO);
  const doc = leer(RUTA_INGREDIENTES);

  const cambios: string[] = [];
  const sinEtiqueta: string[] = [];

  for (const ing of doc.ingredientes) {
    const sku = elegido[ing.id];
    const etiqueta = sku ? porEan[sku] : null;
    // Basta con que el SKU traiga ALGO clasificado. Pedir la lista de
    // ingredientes dejaba fuera a los productos que solo rellenan el campo
    // legal de alérgenos: así se quedó sin propagar la soja de la carne
    // picada de vacuno, y lo cazó la guardia de generar.ts en vez de esto.
    const tieneDatos = etiqueta
      && ((etiqueta.alergenos?.length ?? 0) > 0
        || (etiqueta.trazas?.length ?? 0) > 0
        || etiqueta.mercadona?.ingredientes
        || etiqueta.off?.encontrado);
    if (!tieneDatos) {
      if (sku) sinEtiqueta.push(ing.id);
      continue;
    }

    const filtrar = (lista: string[]) =>
      (lista ?? []).filter((a): a is Alergeno => FILTRABLES.has(a as Alergeno));

    const declara: Alergeno[] = ing.alergenos ?? [];
    const implicito = IMPLICA[ing.origen];
    const nuevos = filtrar(etiqueta.alergenos)
      .filter((a) => a !== implicito && !declara.includes(a));
    if (nuevos.length) {
      ing.alergenos = [...declara, ...nuevos].sort((a: string, b: string) => a.localeCompare(b));
      cambios.push(`${ing.id}  + ${nuevos.join(', ')}   ("${etiqueta.nombre}")`);
    }

    // Las trazas se sobrescriben enteras: no son curación humana, son el texto
    // de la etiqueta del producto que hay elegido hoy.
    // Más las que se han leído en una FOTO de la etiqueta y no trae el texto de
    // la ficha (`trazasFoto`, con su fuente): el cuscús, cuya caja dice «puede
    // contener soja y mostaza» y la ficha solo soja. Ver verificaciones.json.
    const trazas = filtrar([...(etiqueta.trazas ?? []), ...(etiqueta.trazasFoto ?? [])])
      .filter((t, i, todas) => todas.indexOf(t) === i)
      .filter((t) => !(ing.alergenos ?? []).includes(t));
    const antes = (ing.trazas ?? []).join(',');
    if (trazas.length) ing.trazas = trazas.sort((a, b) => a.localeCompare(b));
    else delete ing.trazas;
    if ((ing.trazas ?? []).join(',') !== antes) {
      cambios.push(`${ing.id}  trazas: ${antes || '(ninguna)'} -> ${(ing.trazas ?? []).join(', ') || '(ninguna)'}`);
    }
  }

  console.log(`${doc.ingredientes.length} ingredientes · ${cambios.length} cambios\n`);
  for (const c of cambios) console.log(`  ${c}`);
  if (sinEtiqueta.length) {
    console.log(`\n  Sin datos de etiqueta (${sinEtiqueta.length}): ${sinEtiqueta.join(', ')}`);
    console.log('  Para estos sigue mandando la red por nombre de generar.ts.');
  }

  if (seco) return console.log('\n(--seco: no he escrito nada)');
  fs.writeFileSync(RUTA_INGREDIENTES, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  console.log(`\nEscrito ${RUTA_INGREDIENTES}`);
}

main();
