#!/usr/bin/env node --experimental-strip-types
/**
 * Escribe en Markdown la tabla SKU a SKU de una auditoría (auditar-catalogo.ts):
 * estado, por qué, qué respalda la correspondencia y de dónde sale el dato.
 * Sin red. Para pegar en un informe de docs/.
 *
 * Uso: node --experimental-strip-types catalogo/informe-auditoria.ts catalogo/auditoria/mad3-2026-10-14.json
 */
import fs from 'node:fs';

const a = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const celda = (t: unknown) => String(t ?? '').replace(/\|/g, '/').replace(/\s+/g, ' ').trim();
const orden: Record<string, number> = { discrepancia: 0, pendiente: 1, comprobado: 2 };
const filas = [...a.filas].sort((x, y) => orden[x.estado] - orden[y.estado] || x.papel.localeCompare(y.papel) || x.canonico.localeCompare(y.canonico));

console.log(`Almacén \`${a.almacen}\` · auditado ${a.auditadoEn} · catálogo de la app ${a.catalogoApp}\n`);
const cuenta = (e: string) => filas.filter((f) => f.estado === e).length;
console.log(`**${cuenta('comprobado')} comprobado · ${cuenta('discrepancia')} discrepancia · ${cuenta('pendiente')} pendiente** de ${filas.length}.\n`);
console.log('| Estado | Canónico | Papel | SKU | Producto (Mercadona) | Precio · formato | Correspondencia | Motivo | Consultado |');
console.log('|---|---|---|---|---|---|---|---|---|');
for (const f of filas) {
  const m = f.mercadona;
  const formato = m
    ? `${m.precio} € · ${m.contenido} ${m.unidad}${m.escurrido ? ` (esc. ${m.escurrido})` : ''}${m.unidades ? ` · ${m.unidades} ud` : ''}${m.granel ? ' · pieza aprox.' : ''}`
    : f.procedencia.respuesta;
  const motivos = [
    ...f.hallazgos.filter((h: any) => h.gravedad === 'discrepancia').map((h: any) => `${h.campo}: app ${celda(JSON.stringify(h.app))} · Mercadona ${celda(JSON.stringify(h.mercadona))}`),
    ...f.pendientes,
    ...f.hallazgos.filter((h: any) => h.gravedad === 'aviso').map((h: any) => `(aviso) ${h.campo}: ${celda(JSON.stringify(h.mercadona ?? h.app))}`),
  ];
  console.log(`| ${f.estado} | ${f.canonico} | ${f.papel} | ${f.sku} | ${celda(m?.nombre ?? f.nombreApp)} | ${celda(formato)} | ${f.correspondencia} | ${celda(motivos.join('; ')) || '—'} | ${f.procedencia.consultadoEn.slice(0, 16).replace('T', ' ')} · HTTP ${f.procedencia.http} |`);
}
