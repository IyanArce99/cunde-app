#!/usr/bin/env node
/**
 * GENERAR LAS FOTOS DE PLATO CONTRA LA API
 *
 * ═══ POR QUÉ NO SE HACE EN EL CHAT ═══
 *
 * Dos motivos, y el segundo es el que costó caro.
 *
 * 1. EL COLLAGE. Pidiendo varios platos en un mensaje, el modelo compone UNA
 *    imagen con todos dentro. No se arregla con un prompt mejor: una llamada
 *    devuelve una imagen, y si quieres diez platos necesitas diez llamadas.
 *
 * 2. EL NOMBRE DEL FICHERO. Es lo que une la foto con la receta, y bajando
 *    diez imágenes seguidas del navegador hay que renombrarlas a mano. El 11
 *    de agosto se cruzaron los diez nombres de una tanda: `revuelto_garbanzos`
 *    contenía macarrones a la boloñesa. En la app eso NO da error — enseña el
 *    plato equivocado y nadie se entera. Aquí el fichero se escribe con el id
 *    que generó el prompt, así que el cruce es imposible.
 *
 * ═══ LA CLAVE NO SE ESCRIBE AQUÍ ═══
 *
 * Sale de `OPENAI_API_KEY`, del entorno o de `.env.local` (que git ignora).
 * Nunca en `.env`, que no lo estaba hasta hoy y solo por suerte.
 *
 * ═══ CUESTA DINERO ═══
 *
 * Por eso no hay modo «todas» por defecto: hay que pedir cuántas. Empieza por
 * `--limite 1`, mira el resultado, y sigue. Consulta la tarifa vigente de
 * `gpt-image-1` antes de lanzar una tanda grande: la sé aproximada y no me voy
 * a inventar el céntimo.
 *
 * Uso:
 *   node catalogo/generar-fotos.js --simular        qué haría, sin llamar ni gastar
 *   node catalogo/generar-fotos.js --limite 1       una, para probar
 *   node catalogo/generar-fotos.js --limite 10
 *   node catalogo/generar-fotos.js --solo pollo_limon,potaje_vigilia_bacalao
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promptDe, pendientes } from './prompt-foto.js';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.join(aqui, '..');
const BRUTAS = path.join(aqui, 'fotos-brutas');
const PUBLICADAS = path.join(raiz, 'public', 'recetas');

const MODELO = 'gpt-image-1';
const TAMANO = '1024x1024';   // cuadrada de origen; fotos.js la lleva a 1080²
const CALIDAD = 'high';
/* Ritmo educado, el mismo criterio que con el catálogo de Mercadona: en serie,
   nunca en paralelo, y con una pausa entre llamadas. */
const PAUSA_MS = 700;

// --- Argumentos --------------------------------------------------------------

const args = process.argv.slice(2);
const valor = (bandera) => {
  const i = args.indexOf(bandera);
  return i >= 0 ? args[i + 1] : undefined;
};
const simular = args.includes('--simular');
const limite = Number(valor('--limite') ?? 0);
const solo = valor('--solo')?.split(',').map((s) => s.trim()).filter(Boolean);

if (!simular && !limite && !solo) {
  console.error('Cuántas: `--limite N`, o `--solo id1,id2`. Con `--simular` no llama a nadie.');
  console.error('Empieza por `--limite 1`.');
  process.exit(1);
}

// --- La clave, sin pasar por el chat -----------------------------------------

/* Lector mínimo de .env.local. No se usa dotenv por no añadir dependencia para
   leer una línea, y porque así queda claro que solo se lee ESE fichero. */
function claveDeFichero() {
  const p = path.join(raiz, '.env.local');
  if (!fs.existsSync(p)) return undefined;
  for (const linea of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = /^\s*OPENAI_API_KEY\s*=\s*(.+?)\s*$/.exec(linea);
    if (m) return m[1].replace(/^["']|["']$/g, '');
  }
  return undefined;
}
const CLAVE = process.env.OPENAI_API_KEY || claveDeFichero();

if (!simular && !CLAVE) {
  console.error('Falta OPENAI_API_KEY. Ponla en .env.local (git la ignora):');
  console.error('  OPENAI_API_KEY=sk-...');
  console.error('No la pegues en un chat: queda en el historial y hay que rotarla.');
  process.exit(1);
}

// --- Qué falta ----------------------------------------------------------------

const datos = JSON.parse(fs.readFileSync(path.join(raiz, 'src', 'data', 'motor-datos.json'), 'utf8'));
const orden = fs.existsSync(path.join(aqui, 'orden-fotos.json'))
  ? JSON.parse(fs.readFileSync(path.join(aqui, 'orden-fotos.json'), 'utf8'))
  : [];

if (!fs.existsSync(BRUTAS)) fs.mkdirSync(BRUTAS, { recursive: true });

/* Ya hecha = publicada o pendiente de convertir. Reanudar una tanda cortada no
   puede volver a pagar por lo que ya está en disco. */
const yaHechas = new Set([
  ...(fs.existsSync(PUBLICADAS) ? fs.readdirSync(PUBLICADAS).filter((f) => f.endsWith('.webp')).map((f) => f.replace(/\.webp$/, '')) : []),
  ...fs.readdirSync(BRUTAS).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).map((f) => f.replace(/\.[^.]+$/, '')),
]);

let cola = pendientes(datos, orden, yaHechas);
if (solo) {
  const porId = new Map(datos.recetas.map((r) => [r.id, r]));
  const desconocidos = solo.filter((id) => !porId.has(id));
  if (desconocidos.length) { console.error('no existen esas recetas:', desconocidos.join(', ')); process.exit(1); }
  cola = solo.map((id) => porId.get(id)).filter((r) => !yaHechas.has(r.id));
} else if (limite) {
  cola = cola.slice(0, limite);
}

console.log(`${yaHechas.size} ya hechas · ${cola.length} en esta tanda`);
if (cola.length === 0) { console.log('nada que generar.'); process.exit(0); }

if (simular) {
  for (const r of cola) {
    console.log(`\n── ${r.nombre}  →  ${r.id}.png`);
    console.log(promptDe(r, datos));
  }
  console.log(`\n[simulación] ${cola.length} llamadas · no se ha llamado a nadie ni se ha gastado nada.`);
  process.exit(0);
}

// --- Generar, en serie --------------------------------------------------------

const dormir = (ms) => new Promise((r) => { setTimeout(r, ms); });

let hechas = 0;
const fallidas = [];
for (const [i, receta] of cola.entries()) {
  const etiqueta = `[${i + 1}/${cola.length}] ${receta.nombre}`;
  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${CLAVE}` },
      body: JSON.stringify({
        model: MODELO, prompt: promptDe(receta, datos),
        n: 1, size: TAMANO, quality: CALIDAD,
      }),
    });

    if (!res.ok) {
      const cuerpo = await res.text();
      /* 401 y 429 no son fallos de una receta: son del acceso o del ritmo.
         Seguir insistiendo 130 veces sería gastar y molestar para nada. */
      if (res.status === 401 || res.status === 403) {
        console.error(`\nLa clave no vale (${res.status}). Se para aquí.`);
        console.error(cuerpo.slice(0, 300));
        break;
      }
      if (res.status === 429) {
        console.error(`\nLímite de ritmo o saldo agotado (429). Se para aquí, sin reintentar.`);
        console.error(cuerpo.slice(0, 300));
        break;
      }
      console.error(`${etiqueta}  FALLA ${res.status}: ${cuerpo.slice(0, 160)}`);
      fallidas.push(receta.id);
      continue;
    }

    const json = await res.json();
    const b64 = json?.data?.[0]?.b64_json;
    if (!b64) { console.error(`${etiqueta}  sin imagen en la respuesta`); fallidas.push(receta.id); continue; }

    /* El nombre lo pone el id que generó el prompt: aquí no hay renombrado
       manual, así que no puede cruzarse con otra receta. */
    const destino = path.join(BRUTAS, `${receta.id}.png`);
    fs.writeFileSync(destino, Buffer.from(b64, 'base64'));
    hechas++;
    console.log(`${etiqueta}  →  ${receta.id}.png  ${Math.round(fs.statSync(destino).size / 1024)} KB`);
  } catch (e) {
    console.error(`${etiqueta}  ERROR: ${e.message}`);
    fallidas.push(receta.id);
  }
  if (i < cola.length - 1) await dormir(PAUSA_MS);
}

console.log(`\n${hechas} generadas${fallidas.length ? ` · ${fallidas.length} fallidas: ${fallidas.join(', ')}` : ''}`);
if (hechas) {
  console.log('\nAhora, y en este orden:');
  console.log('  node catalogo/fotos.js            convierte a 1080² webp');
  console.log('  node catalogo/fotos.js --encender');
  console.log('  npx tsx catalogo/generar.ts');
  console.log('  node catalogo/postres.js --escribir');
  const ultimo = fs.readdirSync(aqui).filter((f) => /^precios-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().pop();
  console.log(`  node catalogo/aplicar-precios.js catalogo/${ultimo ?? 'precios-AAAA-MM-DD.json'}`);
}
