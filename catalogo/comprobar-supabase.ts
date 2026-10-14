#!/usr/bin/env node --experimental-strip-types
/**
 * ═══ ¿ESTÁ VIVO EL BACKEND DE LA BETA? ═══
 *
 * Solo lee, y no escribe nada en la base de datos: la analítica se prueba con un
 * lote VACÍO, que la función acepta sin insertar. Usa las mismas variables que
 * la app (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_PRECIOS_URL`) y
 * nunca las imprime: de la URL solo enseña los cuatro primeros caracteres de la
 * referencia del proyecto.
 *
 *   node --experimental-strip-types catalogo/comprobar-supabase.ts [--env .env.produccion]
 *
 * Comprueba, por orden, y para en el primer fallo que impide seguir:
 *   1. DNS del proyecto (y si el fallo es autoritativo: el dominio padre existe)
 *   2. HTTPS y que responde la API
 *   3. RPC instantanea_actual para Madrid y para Gran Canaria
 *   4. si la migración por zona está aplicada (la RPC acepta p_zona)
 *   5. RPC track_events con un lote vacío
 *   6. que el historial de precios está cerrado (RLS) para la clave pública
 */
import fs from 'node:fs';
import dns from 'node:dns/promises';

const i = process.argv.indexOf('--env');
const ficheros = i > -1 ? [process.argv[i + 1]] : ['.env', '.env.local'];
const env: Record<string, string> = {};
for (const f of ficheros) {
  if (!fs.existsSync(f)) continue;
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2];
  }
}
const url = env.VITE_SUPABASE_URL;
const clave = env.VITE_SUPABASE_ANON_KEY;
const precios = env.VITE_PRECIOS_URL;
const linea = (ok: boolean | null, que: string, det = '') => console.log(`${ok === null ? '—    ' : ok ? 'OK   ' : 'FALLO'} ${que}${det ? ` · ${det}` : ''}`);

if (!url || !clave) { linea(false, 'faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY'); process.exit(1); }
const host = new URL(url).host;
const ref = host.split('.')[0];
console.log(`Proyecto ${ref.slice(0, 4)}… · clave ${clave.startsWith('sb_publishable_') ? 'publicable' : clave.startsWith('eyJ') ? 'anon (JWT)' : 'de tipo desconocido'} · precios ${precios?.includes('{zona}') ? 'con {zona}' : 'SIN {zona}: solo Madrid'}`);

// 1 · DNS
try {
  const ips = await dns.resolve4(host);
  linea(true, 'DNS', `${ips.length} dirección(es)`);
} catch (e) {
  const codigo = (e as { code?: string }).code;
  let padre = false;
  try { await dns.resolveSoa(host.split('.').slice(1).join('.')); padre = true; } catch { /* */ }
  linea(false, 'DNS', `${codigo}${padre ? ' · el dominio padre existe: el servidor autoritativo dice que este proyecto no' : ''}`);
  console.log('\nNo se puede seguir sin DNS. Mira el estado del proyecto en el panel (docs/lanzamiento-beta.md).');
  process.exit(1);
}

const cab = { apikey: clave, Authorization: `Bearer ${clave}`, Accept: 'application/json' };
const pedir = async (ruta: string, init: RequestInit = {}) => {
  try {
    const r = await fetch(`${url}${ruta}`, { ...init, headers: { ...cab, ...(init.headers ?? {}) } });
    return { status: r.status, cuerpo: await r.text() };
  } catch (e) { return { status: 0, cuerpo: (e as Error).message }; }
};

// 2 · HTTPS
const raiz = await pedir('/rest/v1/');
linea(raiz.status > 0 && raiz.status < 500, 'HTTPS y API', `HTTP ${raiz.status}${raiz.status === 540 ? ' (proyecto PAUSADO)' : ''}`);
if (raiz.status === 0 || raiz.status >= 500) process.exit(1);

// 3 y 4 · precios
const vieja = await pedir('/rest/v1/rpc/instantanea_actual');
const version = (t: string) => { try { const j = JSON.parse(t); return j ? `${j.version} (${j.zona ?? 'sin zona: Madrid'})` : 'ninguna activa'; } catch { return t.slice(0, 80); } };
linea(vieja.status === 200, 'instantánea de Madrid (sin p_zona)', `HTTP ${vieja.status} · ${version(vieja.cuerpo)}`);
for (const zona of ['madrid', 'gran-canaria']) {
  const r = await pedir(`/rest/v1/rpc/instantanea_actual?p_zona=${zona}`);
  linea(r.status === 200, `instantánea de ${zona} (con p_zona)`, r.status === 200 ? version(r.cuerpo) : `HTTP ${r.status}: ${r.status === 404 ? 'la migración por zona NO está aplicada' : r.cuerpo.slice(0, 80)}`);
}

// 5 · analítica, con un lote vacío: no inserta nada
const ev = await pedir('/rest/v1/rpc/track_events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ p_events: [] }) });
linea(ev.status >= 200 && ev.status < 300, 'analítica (track_events, lote vacío)', `HTTP ${ev.status}${ev.status === 404 ? ': falta la migración 20260811_analitica.sql' : ''}`);

// 6 · RLS
const hist = await pedir('/rest/v1/precio?select=sku&limit=1');
const cerrado = hist.status === 401 || hist.status === 403 || hist.status === 404 || hist.cuerpo.trim() === '[]';
linea(cerrado, 'historial de precios cerrado a la clave pública', `HTTP ${hist.status}`);
