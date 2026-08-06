#!/usr/bin/env node --experimental-strip-types
/**
 * Contrasta lo que el vocabulario canónico DECLARA contra lo que la etiqueta
 * del producto DICE. Es el control que faltaba: hasta ahora se adivinaba por
 * el nombre del SKU.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const real = JSON.parse(fs.readFileSync(path.join(aqui, 'alergenos-por-ean.json'), 'utf8'));
const vocab = JSON.parse(fs.readFileSync(path.join(aqui, '..', 'docs', 'ingredientes-canonicos.json'), 'utf8'));
const elegido = JSON.parse(fs.readFileSync(path.join(aqui, 'mapeo-elegido.json'), 'utf8'));

const porId: Record<string, any> = {};
for (const i of vocab.ingredientes) porId[i.id] = i;

/** Lo que el canónico dice que lleva, en el mismo idioma que la etiqueta. */
function declarado(ing: any): Set<string> {
  const s = new Set<string>(ing.alergenos);
  if (ing.origen === 'huevo') s.add('huevo');
  if (ing.origen === 'lacteo') s.add('lactosa');
  if (ing.origen === 'pescado') s.add('pescado');
  if (ing.origen === 'marisco') s.add('marisco');
  if (ing.origen === 'carne') s.add('carne');
  return s;
}

/** Solo estos importan: son los que la app ofrece filtrar. */
const FILTRABLES = ['gluten', 'lactosa', 'frutos_secos', 'huevo', 'pescado', 'marisco', 'cerdo'];

const noDeclarados: string[] = [];
const soloTrazas: string[] = [];
const sinDato: string[] = [];

for (const [canonico, sku] of Object.entries<string>(elegido)) {
  const datos = real[sku];
  const ing = porId[canonico];
  if (!datos) { sinDato.push(`${canonico} (sku ${sku}: no respondió)`); continue; }
  if (!datos.mercadona?.ingredientes && !datos.off?.encontrado) {
    sinDato.push(`${canonico} — ${datos.nombre}`);
    continue;
  }

  const dice = new Set<string>(datos.alergenos);
  const dijimos = declarado(ing);

  for (const a of FILTRABLES) {
    if (!dice.has(a) || dijimos.has(a)) continue;
    // El cerdo dentro de un canónico ya marcado como carne no es una sorpresa
    // grave, pero sí lo es para quien excluye cerdo en concreto.
    noDeclarados.push(
      `  ${canonico.padEnd(22)} lleva ${a.toUpperCase()} — "${datos.nombre}"\n`
      + `      etiqueta: ${String(datos.mercadona?.ingredientes ?? datos.off?.nombre ?? '').slice(0, 150)}`,
    );
  }
  // Las trazas se listan aparte: no son ingrediente, pero un celíaco las mira.
  for (const a of datos.trazas ?? []) {
    if (FILTRABLES.includes(a) && !dijimos.has(a)) {
      soloTrazas.push(`  ${canonico.padEnd(22)} trazas de ${a} — ${datos.nombre}`);
    }
  }
}

console.log('AUDITORÍA DE ALÉRGENOS · lo declarado frente a la etiqueta real\n');
console.log(`SKU con dato real: ${Object.keys(real).length} · de ellos con lista de ingredientes de Mercadona: ${Object.values(real).filter((x: any) => x.mercadona?.ingredientes).length}`);
console.log(`Con datos de Open Food Facts: ${Object.values(real).filter((x: any) => x.off?.encontrado).length}\n`);

console.log(`=== ALÉRGENOS NO DECLARADOS (${noDeclarados.length}) ===`);
console.log(noDeclarados.length ? noDeclarados.join('\n') : '  ninguno');

console.log(`\n=== SOLO TRAZAS (${soloTrazas.length}) ===`);
console.log(soloTrazas.length ? soloTrazas.join('\n') : '  ninguno');

console.log(`\n=== SIN DATO PARA CONTRASTAR (${sinDato.length}) ===`);
console.log(sinDato.length ? sinDato.map((s) => '  ' + s).join('\n') : '  ninguno');

// Y de paso: qué lleva de verdad cada SKU de los que más importan.
console.log('\n=== ETIQUETA REAL DE LOS SKU CON ALÉRGENOS FILTRABLES ===');
for (const [canonico, sku] of Object.entries<string>(elegido)) {
  const d = real[sku];
  if (!d) continue;
  const filtrables = (d.alergenos ?? []).filter((a: string) => FILTRABLES.includes(a));
  if (!filtrables.length) continue;
  console.log(`  ${canonico.padEnd(22)} ${filtrables.join(', ').padEnd(28)} ${d.nombre}`);
}
