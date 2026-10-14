#!/usr/bin/env node --experimental-strip-types
/**
 * La tabla de alternativas de una zona, para que una persona las revise.
 *
 *   node --experimental-strip-types catalogo/tabla-alternativas.ts gran-canaria 3120 2026-10-14
 *
 * Por fila: el producto de Madrid, la alternativa, foto y enlace a su ficha, el
 * formato y el precio EN LA TIENDA ONLINE de ese almacén, en qué se diferencian,
 * los alérgenos de su etiqueta frente a lo que declara el vocabulario, y qué
 * cambia en cantidades o preparación. Sin red. No marca nada como revisado.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const leer = (r: string) => JSON.parse(fs.readFileSync(r, 'utf8'));
const [zona, almacen, fecha] = process.argv.slice(2);

const alternativas = leer(path.join(aqui, 'zonas', `${zona}-alternativas.json`)).alternativas;
const madrid = new Map(leer(path.join(aqui, 'auditoria', `mad3-${fecha}.json`)).filas.map((f: any) => [f.canonico, f]));
const alt = new Map(leer(path.join(aqui, 'auditoria', `${almacen}-${fecha}-${zona}-propuesta-parcial.json`)).filas.map((f: any) => [f.canonico, f]));
const catalogo: any[] = leer(path.join(aqui, 'capturas-crudas', `catalogo_mercadona_${almacen}_${fecha}.json`));
const foto = new Map(catalogo.map((p) => [p.sku, p.imagen]));
const crudoVocab = leer(path.join(aqui, '..', 'docs', 'ingredientes-canonicos.json'));
const vocab = new Map((Array.isArray(crudoVocab) ? crudoVocab : crudoVocab.ingredientes ?? Object.values(crudoVocab)).map((i: any) => [i.id, i]));

const formato = (m: any) => m
  ? `${m.packaging ?? ''} ${m.contenido < 1 ? `${Math.round(m.contenido * 1000)} g` : `${m.contenido} ${m.unidad}`}${m.escurrido && m.escurrido / m.contenido < 0.97 ? ` (${Math.round(m.escurrido * 1000)} g escurr.)` : ''}${m.granel ? ' · pieza aprox.' : ''}`.trim()
  : '—';
const eur = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;
const kilo = (m: any) => (m ? `${(m.precio / (m.escurrido && m.escurrido / m.contenido < 0.97 ? m.escurrido : m.contenido)).toFixed(2).replace('.', ',')} €/${m.unidad}` : '');
const celda = (t: unknown) => String(t ?? '').replace(/\|/g, '/').replace(/\s+/g, ' ').trim();

console.log('| Canónico | Madrid (mad3) | Alternativa en ' + almacen + ' | Formato · precio online | Diferencias | Alérgenos de la etiqueta | Ajustes | Auditoría |');
console.log('|---|---|---|---|---|---|---|---|');
for (const [canonico, a] of Object.entries<any>(alternativas)) {
  const md = madrid.get(canonico) as any;
  const f = alt.get(canonico) as any;
  const m = f?.mercadona;
  const v = vocab.get(canonico) as any;
  const original = md?.mercadona ? `${md.mercadona.nombre} · ${formato(md.mercadona)} · ${eur(md.mercadona.precio)}` : md?.nombreApp ?? '—';
  if (!a.sku || !f) {
    console.log(`| ${canonico} | ${celda(original)} | **sin alternativa** | — | ${celda(a.motivo)} | — | Las recetas que lo llevan quedan fuera | — |`);
    continue;
  }
  const img = foto.get(a.sku);
  const enlace = `[${celda(m?.nombre ?? a.sku)}](https://tienda.mercadona.es/product/${a.sku}/)`;
  const declarado = [...(v?.alergenos ?? []), ...(v?.trazas ?? []).map((t: string) => `trazas de ${t}`)].join(', ') || 'nada';
  const etiqueta = f.alergenos
    ? `${f.alergenos.etiqueta.join(', ') || 'ninguno'}${f.alergenos.trazasEtiqueta.length ? `; trazas de ${f.alergenos.trazasEtiqueta.join(', ')}` : ''}`
    : 'sin etiqueta en la ficha';
  const graves = (f.hallazgos ?? []).filter((h: any) => h.gravedad === 'discrepancia').map((h: any) => h.campo);
  const auditoria = `${f.estado}${graves.length ? ` (${graves.join(', ')})` : ''} · correspondencia: ${f.correspondencia}`;
  console.log(`| ${canonico} | ${celda(original)} | ${img ? `![](${img}) ` : ''}${enlace} · SKU ${a.sku} | ${celda(formato(m))} · **${eur(m.precio)}** (${kilo(m)}) | ${celda(a.motivo)} | ${celda(etiqueta)} · vocabulario: ${celda(declarado)} | ${celda(a.ajustes ?? '—')} | ${celda(auditoria)} |`);
}
