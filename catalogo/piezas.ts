#!/usr/bin/env node --experimental-strip-types
/**
 * ═══ CUÁNTO PESA HOY UNA PIEZA ═══
 *
 * La fruta y la verdura a granel se venden por pieza a un precio fijo, con un
 * peso APROXIMADO que pone Mercadona. Ese peso cambia con la temporada: el 28
 * de julio un calabacín eran 410 g y el 14 de octubre son 370 g, al mismo 0,70 €.
 * Las recetas piden gramos, así que con el peso viejo la app compra menos
 * piezas de las que hacen falta y da un precio por kilo más bajo que el real.
 *
 * Este script NO pide nada: extrae de una auditoría ya hecha las piezas cuyo
 * peso ha cambiado con el precio igual, con su origen y su fecha. Lo aplican
 * generar.ts (recetas) y postres.js (fruta de postre).
 *
 * Solo piezas (`approx_size`) y solo con el mismo precio: si cambia el precio,
 * eso es trabajo de revisar-precios.js y aplicar-precios.js, no de esto.
 *
 * Uso: node --experimental-strip-types catalogo/piezas.ts catalogo/auditoria/mad3-2026-10-14.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const origen = process.argv[2];
if (!origen) { console.error('Uso: piezas.ts <auditoría.json>'); process.exit(1); }

const auditoria = JSON.parse(fs.readFileSync(origen, 'utf8'));
const salida: Record<string, unknown> = {};
for (const f of auditoria.filas) {
  const m = f.mercadona;
  if (!m?.granel || !m.contenido) continue;
  const cambiaPeso = f.hallazgos.some((h: { campo: string }) => h.campo === 'contenido');
  const mismoPrecio = Math.abs(m.precio - f.app.precio) < 0.005;
  if (!cambiaPeso || !mismoPrecio) continue;
  salida[f.sku] = {
    canonico: f.canonico,
    nombre: m.nombre,
    antes: f.app.contenido,
    pieza: m.contenido,
    unidad: m.unidad,
    precio: m.precio,
    fuente: f.procedencia.fuente,
    consultadoEn: f.procedencia.consultadoEn,
  };
}

const ruta = path.join(aqui, 'peso-pieza.json');
fs.writeFileSync(ruta, `${JSON.stringify({
  nota: 'Peso aproximado por pieza que da Mercadona hoy. generar.ts y postres.js lo aplican sobre el del volcado de julio. Ver piezas.ts.',
  auditoria: path.basename(origen),
  skus: salida,
}, null, 2)}\n`);
console.log(`${Object.keys(salida).length} piezas con otro peso → ${path.relative(process.cwd(), ruta)}`);
for (const [sku, x] of Object.entries(salida) as [string, any][]) console.log(`  ${sku.padEnd(7)} ${x.nombre.padEnd(22)} ${x.antes} → ${x.pieza} ${x.unidad}`);
