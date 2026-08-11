#!/usr/bin/env node
/**
 * NORMALIZAR LAS FOTOS DE PLATO
 *
 * Coge lo que haya en `catalogo/fotos-brutas/` —salga como salga del generador
 * o de un móvil— y escribe en `public/recetas/` un fichero por receta, todos
 * idénticos en tamaño, formato y peso.
 *
 * ═══ POR QUÉ NO SE LE PIDE EL FORMATO AL GENERADOR ═══
 *
 * Porque no obedece. Los generadores de imagen sueltan PNG a una resolución
 * fija y no aceptan «hazlo de 200 KB en JPG». Y aunque lo aceptaran, dependerías
 * de que acertara 141 veces seguidas.
 *
 * Medido con la única foto que había: `merluza_salsa_verde.png` pesa 2,7 MB. A
 * ese peso, 141 recetas son 381 MB metidos en el APK. Google Play corta el AAB
 * en 200 MB, así que la app ni se sube.
 *
 * Convirtiendo aquí, el peso deja de depender de nadie.
 *
 * ═══ WEBP, NO JPG ═══
 *
 * El LEEME decía JPG calidad 80 (~200 KB), que son 28 MB. WebP calidad 78 da la
 * misma foto en la mitad, y Android WebView lo lleva nativo desde 2014 (y iOS
 * Safari desde 2020), así que no hay a quién romperle nada. Los números reales
 * los imprime este script al terminar; no te fíes de esta estimación.
 *
 * ═══ RECORTE CENTRADO ═══
 *
 * Cuadrado, recortando por el centro. Da igual lo que entre —vertical de móvil,
 * 1024² de un generador, apaisado— sale 1080×1080. Es lo que pedía el encargo:
 * todas centradas e iguales.
 *
 * Uso:
 *   node catalogo/fotos.js            revisa y convierte
 *   node catalogo/fotos.js --revisar  solo dice qué falta, no escribe nada
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.join(aqui, '..');
const BRUTAS = path.join(aqui, 'fotos-brutas');
const DESTINO = path.join(raiz, 'public', 'recetas');
const DATOS = path.join(raiz, 'src', 'data', 'motor-datos.json');

const LADO = 1080; // se pinta a 330 px; 1080 cubre pantallas de 3×
const CALIDAD = 78;
const soloRevisar = process.argv.includes('--revisar');

/* Las 151 son platos cocinados. Los postres no salen aquí porque no son
   recetas: son ingredientes con bandera (ver src/motor/postres.ts), y un yogur
   no necesita foto. */
const datos = JSON.parse(fs.readFileSync(DATOS, 'utf8'));
const platos = datos.recetas;
const porId = new Map(platos.map((r) => [r.id, r]));

if (!fs.existsSync(BRUTAS)) fs.mkdirSync(BRUTAS, { recursive: true });

const entradas = fs
  .readdirSync(BRUTAS)
  .filter((f) => /\.(png|jpe?g|webp|avif)$/i.test(f));

/* Un fichero por receta, y el nombre ES el id. Si no cuadra, se dice cuál y no
   se adivina: renombrar a ojo acaba poniendo la foto del pollo en las lentejas. */
const huerfanas = [];
const trabajos = [];
for (const f of entradas) {
  const id = f.replace(/\.[^.]+$/, '');
  if (!porId.has(id)) huerfanas.push(f);
  else trabajos.push({ id, origen: path.join(BRUTAS, f) });
}

console.log(`platos en el recetario: ${platos.length}`);
console.log(`ficheros en fotos-brutas: ${entradas.length}`);
if (huerfanas.length) {
  console.log(`\n${huerfanas.length} sin receta que les corresponda:`);
  for (const f of huerfanas) console.log(`  ${f}`);
  console.log('  (el nombre del fichero tiene que ser el id de la receta)');
}

if (soloRevisar || trabajos.length === 0) {
  const hechas = new Set(trabajos.map((t) => t.id));
  const faltan = platos.filter((r) => !hechas.has(r.id));
  console.log(`\nfaltan por fotografiar: ${faltan.length}`);
  for (const r of faltan.slice(0, 12)) console.log(`  ${r.id}  ${r.nombre}`);
  if (faltan.length > 12) console.log(`  … y ${faltan.length - 12} más`);
  process.exit(0);
}

let total = 0;
let mayor = 0;
let mayorId = '';
for (const { id, origen } of trabajos) {
  const salida = path.join(DESTINO, `${id}.webp`);
  await sharp(origen)
    .rotate() // respeta el EXIF de un móvil; si no, las verticales salen tumbadas
    .resize(LADO, LADO, { fit: 'cover', position: 'centre' })
    .webp({ quality: CALIDAD })
    .toFile(salida);
  const peso = fs.statSync(salida).size;
  total += peso;
  if (peso > mayor) { mayor = peso; mayorId = id; }
}

const kb = (b) => `${Math.round(b / 1024)} KB`;
console.log(`\n${trabajos.length} convertidas a ${LADO}×${LADO} webp q${CALIDAD}`);
console.log(`  media: ${kb(total / trabajos.length)}`);
console.log(`  mayor: ${kb(mayor)} (${mayorId})`);
console.log(`  total: ${(total / 1024 / 1024).toFixed(1)} MB`);
console.log(`  proyección a ${platos.length} platos: ${((total / trabajos.length) * platos.length / 1024 / 1024).toFixed(1)} MB`);
console.log('\nAhora enciéndelas: node catalogo/fotos.js --encender');

/* --encender escribe el campo `foto` en los JSON de receta, que es lo único que
   hace que aparezcan. Se hace aparte y a propósito: convertir es inofensivo,
   tocar el recetario no. */
if (process.argv.includes('--encender')) {
  /**
   * EL RECETARIO SON DOS FUENTES, NO UNA.
   *
   * `generar.ts` lee el piloto (`docs/recetas-piloto.json`) MÁS los lotes de
   * `docs/recetas/`. Aquí solo se recorrían los lotes, así que `pasta_atun`
   * —que vive en el piloto— se convertía, se copiaba a public/ y no se
   * encendía nunca. La foto existía en disco y no salía en la app.
   *
   * Y no avisaba: 10 ficheros, 9 recetas encendidas, ningún error. Por eso
   * abajo se cuentan las que se quedan sin dueño y se dicen por su nombre.
   */
  const fuentes = [
    path.join(raiz, 'docs', 'recetas-piloto.json'),
    ...fs.readdirSync(path.join(raiz, 'docs', 'recetas'))
      .filter((x) => x.endsWith('.json'))
      .map((x) => path.join(raiz, 'docs', 'recetas', x)),
  ].filter((p) => fs.existsSync(p));

  const conFoto = new Set(
    fs.readdirSync(DESTINO).filter((f) => f.endsWith('.webp')).map((f) => f.replace(/\.webp$/, '')),
  );
  const encendidas = new Set();
  let tocados = 0;
  for (const p of fuentes) {
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    const arr = Array.isArray(j) ? j : j.recetas;
    let cambio = false;
    for (const r of arr) {
      const quiere = conFoto.has(r.id) ? `${r.id}.webp` : undefined;
      if (quiere) encendidas.add(r.id);
      if (quiere && r.foto !== quiere) { r.foto = quiere; cambio = true; tocados++; }
      if (!quiere && r.foto) { delete r.foto; cambio = true; }
    }
    if (cambio) fs.writeFileSync(p, `${JSON.stringify(j, null, 2)}\n`, 'utf8');
  }

  /* Una foto sin receta que la reclame no da error en ningún paso posterior:
     simplemente no aparece. Se dice aquí o no se entera nadie. */
  const huerfana = [...conFoto].filter((id) => !encendidas.has(id));
  if (huerfana.length) {
    console.log(`\nAVISO · ${huerfana.length} foto(s) en public/recetas sin receta que las use:`);
    for (const id of huerfana) console.log(`  ${id}.webp`);
    console.log('  Ese id no está en docs/recetas-piloto.json ni en docs/recetas/.');
  }
  /* Los tres, y en este orden. `generar.ts` solo devuelve los precios a la
     fecha del volcado y no avisa. Ver la cabecera de aplicar-precios.js. */
  const ultimo = fs.readdirSync(aqui).filter((f) => /^precios-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().pop();
  console.log(`campo \`foto\` puesto en ${tocados} recetas. Ahora los TRES, en este orden:`);
  console.log('  npx tsx catalogo/generar.ts');
  console.log('  node catalogo/postres.js --escribir');
  console.log(`  node catalogo/aplicar-precios.js catalogo/${ultimo ?? 'precios-AAAA-MM-DD.json'}`);
  console.log('Saltarte los dos últimos revierte los precios sin decírtelo.');
}
