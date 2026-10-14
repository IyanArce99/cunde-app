#!/usr/bin/env node --experimental-strip-types
/**
 * ═══ CUÁNTO DE CADA CONSERVA SE APROVECHA ═══
 *
 * Las recetas dicen «los garbanzos escurridos», y 15 de las 17 que los usan lo
 * escriben así. El tarro de garbanzos pone 570 g netos y 400 g escurridos. El
 * motor contaba el tarro por los 570: para 480 g de garbanzo escurrido compraba
 * un tarro, y en casa salían 400.
 *
 * Mercadona calcula su precio por kilo sobre el escurrido (0,80 € / 0,4 kg =
 * 2,00 €/kg), que es lo que exige la norma para lo que va en líquido de
 * gobierno. Aquí se hace lo mismo: el envase rinde su escurrido.
 *
 * Este fichero solo EXTRAE el dato de una auditoría ya hecha, con su origen y
 * su fecha; no pide nada a la red. Lo aplica `generar.ts`.
 *
 * Supuesto, y hay que decirlo: la cantidad de la receta es peso escurrido. Lo
 * dicen los pasos («añade los garbanzos escurridos»), no un campo de datos.
 *
 * Uso: node --experimental-strip-types catalogo/escurridos.ts catalogo/auditoria/mad3-2026-10-14.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const origen = process.argv[2];
if (!origen) {
  console.error('Uso: escurridos.ts <auditoría.json>');
  process.exit(1);
}

const auditoria = JSON.parse(fs.readFileSync(origen, 'utf8'));
const salida: Record<string, unknown> = {};
for (const f of auditoria.filas) {
  const m = f.mercadona;
  if (!m?.escurrido || !m.contenido) continue;
  // Por debajo del 97 % es escurrido de verdad; por encima, redondeo de etiqueta.
  if (m.escurrido / m.contenido >= 0.97) continue;
  salida[f.sku] = {
    canonico: f.canonico,
    nombre: m.nombre,
    neto: m.contenido,
    escurrido: m.escurrido,
    unidad: m.unidad,
    fuente: f.procedencia.fuente,
    consultadoEn: f.procedencia.consultadoEn,
  };
}

const ruta = path.join(aqui, 'peso-escurrido.json');
fs.writeFileSync(ruta, `${JSON.stringify({
  nota: 'Peso escurrido de la etiqueta. generar.ts cuenta cada envase por esto, no por el neto. Ver escurridos.ts.',
  auditoria: path.basename(origen),
  skus: salida,
}, null, 2)}\n`);
console.log(`${Object.keys(salida).length} conservas con escurrido → ${path.relative(process.cwd(), ruta)}`);
