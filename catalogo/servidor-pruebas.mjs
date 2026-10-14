#!/usr/bin/env node
/**
 * ═══ UN SUPABASE DE MENTIRA, PARA PROBAR EN LOCAL ═══
 *
 * Imita las dos RPC que usa la app, con el mismo contrato que las de verdad:
 *
 *   GET  /rest/v1/rpc/instantanea_actual?p_zona=<zona>   la instantánea activa
 *        de esa zona (sin p_zona, Madrid: igual que la función con su valor por
 *        defecto). Ver supabase/migrations/20261014_instantanea_por_zona.sql.
 *   POST /rest/v1/rpc/track_events   { p_events: [...] }  idempotente por
 *        event_id, como la función real (on conflict do nothing).
 *
 * Y tres órdenes para la prueba:
 *   POST /__publicar?zona=<zona>   cuerpo: la instantánea. La deja activa.
 *   GET  /__eventos                lo recibido: eventos únicos y repetidos.
 *   POST /__caido?si=1|0           responde 503 a todo, como un servidor caído.
 *
 * No es Supabase: no prueba RLS, ni el pooler, ni la migración SQL. Prueba que
 * la APP publica, descarga, rechaza y reenvía como debe.
 *
 *   node catalogo/servidor-pruebas.mjs [puerto=8787]
 */
import http from 'node:http';

const PUERTO = Number(process.argv[2] ?? 8787);
const activas = new Map(); // zona -> instantánea
const eventos = new Map(); // event_id -> evento
let repetidos = 0;
let peticionesEventos = 0;
let caido = false;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, accept, prefer',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const responder = (res, codigo, cuerpo) => {
  res.writeHead(codigo, { ...cors, 'Content-Type': 'application/json' });
  res.end(cuerpo === undefined ? '' : JSON.stringify(cuerpo));
};
const leerCuerpo = (req) => new Promise((ok) => { let b = ''; req.on('data', (c) => { b += c; }); req.on('end', () => ok(b)); });

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PUERTO}`);
  if (req.method === 'OPTIONS') return responder(res, 204);
  if (url.pathname === '/__publicar' && req.method === 'POST') {
    activas.set(url.searchParams.get('zona') ?? 'madrid', JSON.parse(await leerCuerpo(req)));
    return responder(res, 200, { ok: true });
  }
  if (url.pathname === '/__caido') { caido = url.searchParams.get('si') === '1'; return responder(res, 200, { caido }); }
  if (url.pathname === '/__eventos') {
    return responder(res, 200, { unicos: eventos.size, repetidos, peticiones: peticionesEventos, nombres: [...eventos.values()].map((e) => e.event_name) });
  }
  if (caido) return responder(res, 503, { message: 'caído (simulado)' });
  if (url.pathname === '/rest/v1/rpc/instantanea_actual' && req.method === 'GET') {
    // PostgREST devuelve el jsonb tal cual, o null si no hay activa.
    return responder(res, 200, activas.get(url.searchParams.get('p_zona') ?? 'madrid') ?? null);
  }
  if (url.pathname === '/rest/v1/rpc/track_events' && req.method === 'POST') {
    peticionesEventos++;
    const { p_events: lote = [] } = JSON.parse((await leerCuerpo(req)) || '{}');
    for (const e of lote) {
      if (eventos.has(e.event_id)) repetidos++;
      else eventos.set(e.event_id, e);
    }
    return responder(res, 200, null);
  }
  return responder(res, 404, { message: 'no existe' });
}).listen(PUERTO, () => console.log(`servidor de pruebas en http://localhost:${PUERTO}`));
