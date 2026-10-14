#!/usr/bin/env node --experimental-strip-types
/**
 * ═══ ¿QUÉ ALMACÉN DE MERCADONA SIRVE CADA CÓDIGO POSTAL DE GRAN CANARIA? ═══
 *
 * El mapa de agosto (catalogo/mapa-almacenes.json) ya encontró al menos nueve
 * almacenes en la provincia de Las Palmas, que incluye Lanzarote y
 * Fuerteventura. Aquí se pregunta código a código por los de Gran Canaria
 * (350xx a 354xx) y, como control, por uno de cada una de las otras dos islas.
 *
 * Los códigos de la lista son los que figuran para los municipios de la isla;
 * los que Mercadona no reconoce vuelven sin almacén y se anotan así, no se
 * descartan.
 *
 * Uso: node --experimental-strip-types catalogo/zonas-gran-canaria.ts
 * Escribe catalogo/zonas/gran-canaria-cp.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { almacenDe, BloqueoDetectado } from './mercadona-api.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));

const MUNICIPIOS: Record<string, string[]> = {
  'Las Palmas de Gran Canaria': ['35001', '35002', '35003', '35004', '35005', '35006', '35007', '35008', '35009', '35010', '35011', '35012', '35013', '35014', '35015', '35016', '35017', '35018', '35019'],
  'Telde': ['35200', '35210', '35211', '35212', '35213', '35214', '35215', '35219'],
  'Valsequillo': ['35217'],
  'Ingenio': ['35240', '35250'],
  'Agüimes': ['35118', '35119', '35260'],
  'Santa Lucía de Tirajana': ['35110', '35111', '35280'],
  'San Bartolomé de Tirajana': ['35100', '35106', '35107', '35290'],
  'Mogán': ['35120', '35129', '35130', '35138', '35140'],
  'La Aldea de San Nicolás': ['35470'],
  'Arucas': ['35400', '35411', '35412', '35413', '35418'],
  'Firgas': ['35430'],
  'Moya': ['35420'],
  'Santa María de Guía': ['35450', '35457'],
  'Gáldar': ['35460', '35468'],
  'Agaete': ['35480', '35489'],
  'Teror': ['35330'],
  'Valleseco': ['35340'],
  'Vega de San Mateo': ['35320'],
  'Santa Brígida': ['35300', '35307', '35308', '35310'],
  'Tejeda': ['35360'],
  'Artenara': ['35350'],
};
const CONTROL: Record<string, string[]> = {
  'Lanzarote · Arrecife': ['35500'],
  'Fuerteventura · Puerto del Rosario': ['35600'],
};

const filas: { cp: string; municipio: string; isla: string; almacen: string | null; http: number | null; en: string; motivo?: string }[] = [];
try {
  for (const [isla, grupo] of [['Gran Canaria', MUNICIPIOS], ['control', CONTROL]] as const) {
    for (const [municipio, cps] of Object.entries(grupo)) {
      for (const cp of cps) {
        const r = await almacenDe(cp);
        filas.push({ ...r, municipio, isla });
        console.log(`${cp}  ${municipio.padEnd(30)} → ${r.almacen ?? `(sin almacén · HTTP ${r.http}${r.motivo ? ` · ${r.motivo}` : ''})`}`);
      }
    }
  }
} catch (err) {
  if (err instanceof BloqueoDetectado) { console.error(`\n${err.message}`); process.exitCode = 1; } else throw err;
}

const porAlmacen = new Map<string, Set<string>>();
for (const f of filas) {
  if (!f.almacen || f.isla !== 'Gran Canaria') continue;
  if (!porAlmacen.has(f.almacen)) porAlmacen.set(f.almacen, new Set());
  porAlmacen.get(f.almacen)!.add(f.municipio);
}
console.log('\nALMACENES DE GRAN CANARIA');
for (const [a, ms] of porAlmacen) console.log(`  ${a.padEnd(6)} ${[...ms].join(' · ')}`);

fs.mkdirSync(path.join(aqui, 'zonas'), { recursive: true });
fs.writeFileSync(path.join(aqui, 'zonas', 'gran-canaria-cp.json'), `${JSON.stringify({
  medidoEn: new Date().toISOString(),
  fuente: 'PUT https://tienda.mercadona.es/api/postal-codes/actions/change-pc/ · cabecera x-customer-wh',
  nota: 'Muestra de códigos postales de Gran Canaria por municipio, más un control de Lanzarote y otro de Fuerteventura. Un CP sin almacén puede no existir o no tener servicio online.',
  codigos: filas,
}, null, 2)}\n`);
console.log('\nEscrito catalogo/zonas/gran-canaria-cp.json');
