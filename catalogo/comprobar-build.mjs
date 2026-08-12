#!/usr/bin/env node
/**
 * ═══ ¿LLEVA EL BUILD LO QUE TIENE QUE LLEVAR? ═══
 *
 * Vite mete en el bundle las variables `VITE_*` que encuentre AL COMPILAR. Si
 * no están, no falla: compila igual y la app sale sin analítica y sin precios
 * actualizables, en silencio.
 *
 * Ese silencio es el problema. Publicas la beta, esperas datos, y a la semana
 * descubres que no llegó ni un evento porque compilaste desde otra carpeta.
 *
 * Esto mira DENTRO del `dist/` ya generado —no las variables de entorno— porque
 * lo que importa no es lo que había al lanzar el comando, sino lo que acabó en
 * el fichero que se instala en el móvil.
 *
 * Uso:
 *   node catalogo/comprobar-build.mjs            avisa
 *   node catalogo/comprobar-build.mjs --exigir   falla si falta algo (release)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(aqui, '..', 'dist');
const exigir = process.argv.includes('--exigir');

if (!fs.existsSync(DIST)) {
  console.error('No hay dist/. Compila primero: npm run build');
  process.exit(1);
}

/** Todo el JS del build, concatenado. Son ~2 MB: se lee de una y se busca. */
function todoElJs(dir) {
  let texto = '';
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) texto += todoElJs(p);
    else if (e.name.endsWith('.js')) texto += fs.readFileSync(p, 'utf8');
  }
  return texto;
}
const js = todoElJs(DIST);

let fallos = 0;
let avisos = 0;

/**
 * ═══ SE BUSCA LA CONFIGURACIÓN, NO EL CÓDIGO ═══
 *
 * La primera versión de esto buscaba `/rest/v1/rpc/track_events` y una URL de
 * Supabase. Pasaba SIEMPRE, incluso borrando `.env.local`: la ruta de la RPC es
 * una cadena escrita en el fuente —está en el bundle haya o no credenciales— y
 * la URL de Supabase aparece igualmente por `VITE_PRECIOS_URL`.
 *
 * O sea: comprobaba que el código existe, que es lo único que nunca falla. Se
 * descubrió probando la propia comprobación, borrando el fichero de entorno a
 * ver si saltaba. No saltó.
 *
 * Lo que Vite sustituye al compilar es el VALOR de cada `import.meta.env.VITE_*`
 * —y pone `undefined` si no existe—. Así que hay que buscar los valores, y cada
 * uno con una huella que solo pueda venir de su variable.
 */
const NECESARIO = [
  {
    que: 'clave de Supabase para la analítica',
    /* Solo puede venir de VITE_SUPABASE_ANON_KEY: es el formato de las claves
       publishable/anon y no aparece en ningún otro sitio del fuente. */
    busca: /sb_publishable_[A-Za-z0-9_-]{10}|eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\./,
    sinEllo: 'la app NO enviará ni un evento: no sabrás quién llega a la semana 2',
  },
  {
    que: 'URL de la analítica',
    busca: /https:\/\/[a-z0-9]{15,}\.supabase\.co/,
    sinEllo: 'sin destino al que enviar',
  },
  {
    que: 'precios actualizables',
    /* `instantanea_actual` es el nombre de la RPC que sirve la instantánea y NO
       está escrito en ningún sitio de `src/` — comprobado. Solo puede llegar al
       bundle a través de `VITE_PRECIOS_URL`, así que sirve de huella.
       Mi primer intento buscaba `/rest/v1/…instantanea` y fallaba: la URL real
       lleva `/rpc/` por medio. */
    busca: /instantanea_actual/,
    sinEllo: 'los precios se quedarán congelados en los del APK',
  },
];

console.log('LO QUE TIENE QUE LLEVAR');
for (const c of NECESARIO) {
  const hay = c.busca.test(js);
  if (!hay) { fallos++; }
  console.log(`  ${hay ? 'ok   ' : 'FALTA'} ${c.que}${hay ? '' : ` — ${c.sinEllo}`}`);
}

/**
 * ═══ Y LO QUE NO PUEDE ESTAR ═══
 *
 * Vite solo expone las `VITE_*`, así que en teoría nada de esto puede colarse.
 * En teoría. Basta que alguien renombre una variable a `VITE_OPENAI_KEY` para
 * que la clave viaje en el APK de todo el mundo, y eso no da ningún error.
 */
const PROHIBIDO = [
  { que: 'clave de OpenAI', busca: /sk-proj-[A-Za-z0-9_-]{20}/ },
  { que: 'clave service_role de Supabase', busca: /service_role|SUPABASE_SERVICE/ },
  { que: 'cadena de conexión a Postgres', busca: /postgresql:\/\/[^\s"']+:[^\s"']+@/ },
  { que: 'contraseña de la base de datos', busca: /pooler\.supabase\.com/ },
];

console.log('\nLO QUE NO PUEDE LLEVAR');
for (const c of PROHIBIDO) {
  const hay = c.busca.test(js);
  if (hay) { fallos++; }
  console.log(`  ${hay ? 'GRAVE' : 'ok   '} ${c.que}${hay ? ' — ESTÁ DENTRO DEL BUNDLE' : ''}`);
}

/* La clave publishable SÍ va dentro, y es correcto: la protege que solo pueda
   ejecutar `track_events`, no esconderla. Se dice para que nadie se asuste. */
if (/sb_publishable_|eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9/.test(js)) {
  console.log('\n  (la clave publishable de Supabase va dentro a propósito:');
  console.log('   es pública de facto y solo puede ejecutar track_events)');
}

if (avisos + fallos === 0) console.log('\nel build lleva lo que tiene que llevar.');
if (fallos > 0) {
  console.log(`\n${fallos} problema(s).`);
  console.log('Si faltan variables: comprueba que .env.local existe en la raíz');
  console.log('y que las variables empiezan por VITE_. Luego vuelve a compilar.');
}
process.exit(exigir && fallos > 0 ? 1 : 0);
