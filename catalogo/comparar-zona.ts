#!/usr/bin/env node --experimental-strip-types
/**
 * ═══ ¿UN ALMACÉN REPRESENTA A LOS DEMÁS? ═══
 *
 * Compara auditorías del mismo día (catalogo/auditoria/<wh>-<fecha>.json) SKU
 * a SKU: si existe, precio, formato y escurrido. No pide nada a la red.
 *
 * Responde a una pregunta concreta: si todos los almacenes de una zona dan lo
 * mismo para los SKU que usa la app, un solo catálogo vale para todos ELLOS
 * —y solo para ellos, en esa fecha—. Si no, cada almacén va por su cuenta.
 *
 * Uso: node --experimental-strip-types catalogo/comparar-zona.ts 2026-10-14 4701 3120 3544 …
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const [fecha, ...almacenes] = process.argv.slice(2);
if (!fecha || almacenes.length < 2) {
  console.error('Uso: comparar-zona.ts <fecha> <wh> <wh> [...]');
  process.exit(1);
}

type Fila = { canonico: string; sku: string; mercadona: any; procedencia: { respuesta: string } };
const auditorias = new Map<string, Map<string, Fila>>();
for (const wh of almacenes) {
  const a = JSON.parse(fs.readFileSync(path.join(aqui, 'auditoria', `${wh}-${fecha}.json`), 'utf8'));
  auditorias.set(wh, new Map(a.filas.map((f: Fila) => [f.canonico, f])));
}

const huella = (f: Fila | undefined) => {
  if (!f) return 'sin dato';
  if (f.procedencia.respuesta !== 'ok') return f.procedencia.respuesta;
  const m = f.mercadona;
  return `${m.precio} € · ${m.contenido} ${m.unidad}${m.escurrido ? ` (esc. ${m.escurrido})` : ''}${m.unidades ? ` · ${m.unidades} ud` : ''}`;
};

const canonicos = [...auditorias.get(almacenes[0])!.keys()];
const distintos: string[] = [];
let fallos = 0;
for (const c of canonicos) {
  const valores = almacenes.map((wh) => huella(auditorias.get(wh)!.get(c)));
  if (valores.some((v) => v === 'fallo')) fallos++;
  if (new Set(valores).size > 1) {
    distintos.push(`  ${c.padEnd(24)} ${almacenes.map((wh, i) => `${wh}: ${valores[i]}`).join('  |  ')}`);
  }
}

console.log(`${canonicos.length} SKU · ${almacenes.length} almacenes · ${fecha}`);
console.log(`Descargas fallidas: ${fallos} (un fallo NO es un «no existe»)`);
console.log(`Distintos entre almacenes: ${distintos.length}`);
for (const d of distintos) console.log(d);
