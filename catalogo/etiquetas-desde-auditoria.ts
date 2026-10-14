#!/usr/bin/env node --experimental-strip-types
/**
 * ═══ LAS ETIQUETAS QUE ENRIQUECER.JS NO PUDO TRAER ═══
 *
 * enriquecer.js pide cada ficha SIN almacén, y Mercadona contesta con el suyo
 * por defecto. Un producto que solo está en Madrid —la gamba arrocera, la
 * dorada, la lubina— vuelve vacío, y su etiqueta nunca llegó a
 * alergenos-por-ean.json. Por eso la gamba seguía sin sus sulfitos.
 *
 * La auditoría ya guardó esas fichas, pedidas con almacén. Aquí se clasifican
 * con el MISMO clasificador (alergenos-etiqueta.js) sin volver a la red, y solo
 * para los SKU que faltan: lo que ya está no se toca.
 *
 * Uso: node --experimental-strip-types catalogo/etiquetas-desde-auditoria.ts mad3 2026-10-14
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deMercadona } from './alergenos-etiqueta.js';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const [almacen, fecha] = process.argv.slice(2);
if (!almacen || !fecha) { console.error('Uso: etiquetas-desde-auditoria.ts <almacen> <fecha>'); process.exit(1); }

const RUTA_EAN = path.join(aqui, 'alergenos-por-ean.json');
const crudas = JSON.parse(fs.readFileSync(path.join(aqui, 'capturas-crudas', `${almacen}-${fecha}.json`), 'utf8'));
const auditoria = JSON.parse(fs.readFileSync(path.join(aqui, 'auditoria', `${almacen}-${fecha}.json`), 'utf8'));
const salida = JSON.parse(fs.readFileSync(RUTA_EAN, 'utf8'));

const canonicosDe = new Map<string, string[]>();
for (const f of auditoria.filas) canonicosDe.set(f.sku, [...(canonicosDe.get(f.sku) ?? []), f.canonico]);

let nuevos = 0;
for (const [sku, canonicos] of canonicosDe) {
  if (salida[sku]) continue;
  const r = crudas[sku];
  if (r?.estado !== 'ok') { console.log(`  ${sku}: sin ficha en la auditoría (${r?.estado ?? 'no pedida'})`); continue; }
  const p = r.datos;
  const mercadona = deMercadona(p.nutrition_information);
  salida[sku] = {
    sku,
    ean: p.ean ?? null,
    nombre: p.display_name,
    canonicos: [...canonicos].sort((a, b) => a.localeCompare(b)),
    mercadona,
    off: { encontrado: false, alergenos: [], trazas: [], noConsultado: true },
    alergenos: [...mercadona.contiene].sort((a, b) => a.localeCompare(b)),
    trazas: [...mercadona.trazas].sort((a, b) => a.localeCompare(b)),
    fuente: `${r.url} · ${r.en} (auditoría ${almacen} ${fecha})`,
  };
  nuevos++;
  console.log(`  ${sku} ${p.display_name}: contiene [${mercadona.contiene.join(', ')}] · trazas [${mercadona.trazas.join(', ')}]`);
}
fs.writeFileSync(RUTA_EAN, JSON.stringify(salida, null, 2), 'utf8');
console.log(`${nuevos} etiquetas añadidas a ${path.relative(process.cwd(), RUTA_EAN)}`);
