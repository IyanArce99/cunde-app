/** Precios y analítica contra el servidor de pruebas local (catalogo/servidor-pruebas.mjs). */
import { abrir, esperar } from './cdp.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const [repo, perfil, destino] = process.argv.slice(2);
const APP = 'http://localhost:5299';
const SRV = 'http://localhost:8787';
const resultados = [];
const paso = (que, ok, detalle = '') => { resultados.push({ que, ok }); console.log(`${ok ? 'OK   ' : 'FALLO'} ${que}${detalle ? ` · ${detalle}` : ''}`); };

// Las instantáneas, como las publicaría publicar-precios.js.
const tmp = path.join(destino, 'inst-gc.json');
execFileSync('node', [path.join(repo, 'catalogo/publicar-precios.js'), '--zona', 'gran-canaria', '--salida', tmp], { cwd: repo });
const base = JSON.parse(fs.readFileSync(tmp, 'utf8'));
const conPrecios = (version, cambios, zona = 'gran-canaria') => {
  const i = structuredClone(base); i.version = version; i.zona = zona;
  for (const [c, p] of Object.entries(cambios)) i.skus[c].precio = p;
  return i;
};
const publicar = (zona, inst) => fetch(`${SRV}/__publicar?zona=${zona}`, { method: 'POST', body: JSON.stringify(inst) });
const eventos = async () => (await fetch(`${SRV}/__eventos`)).json();

const n = await abrir({ perfil, puerto: 9351 });
const texto = () => n.js(`(document.querySelector('.ion-page:not(.ion-page-hidden)') || document.body).innerText`);
const estado = () => n.js(`(() => { const e = JSON.parse(localStorage.getItem('cunde:estado:v16') || '{}'); return { precios: e.preciosDeLaLista, espera: e.preciosEnEspera, aviso: e.avisoPrecios, zona: e.zonaDelPlan, lista: (e.lista || []).map((i) => i.id + ':' + i.precio + (i.enElCarro ? '*' : '')) }; })()`);
const guardada = (zona) => n.js(`(() => { const x = localStorage.getItem(${JSON.stringify(zona === 'madrid' ? 'cunde:precios:v1' : `cunde:precios:v1:${zona}`)}); return x ? JSON.parse(x).version : null; })()`);
const reabrir = async (ms = 5000) => { await n.ir(APP + '/compra', ms); };

try {
  await publicar('gran-canaria', conPrecios('2026-10-20', { cebolla: 3.4, patata: 5.1 }));
  await publicar('madrid', conPrecios('2026-10-20', {}, 'madrid'));

  // 1 · Onboarding con 35007 y semana. Al arrancar, la app pide la instantánea de SU zona.
  await n.ir(APP + '/', 3500);
  await n.tocar('Cuadrar mi semana');
  await n.escribir('.super__cp-input', '35007');
  await n.tocar('Seguir', 5000);
  await n.tocar('Seguir', 1500);
  await n.tocar('Ver mi semana', 300); await esperar(9000);
  await esperar(2000);
  // Antes de poner el código postal la app está en Madrid y baja la de Madrid
  // (guardada aparte); con 35007, la de Gran Canaria. Cada una en su clave.
  const gcGuardada = await n.js(`JSON.parse(localStorage.getItem('cunde:precios:v1:gran-canaria') || 'null')?.zona`);
  paso('con 35007 descarga y guarda la instantánea de Gran Canaria, en su clave', (await guardada('gran-canaria')) === '2026-10-20' && gcGuardada === 'gran-canaria',
    `gc ${await guardada('gran-canaria')} (zona ${gcGuardada}) · madrid ${await guardada('madrid')} (de antes del código postal)`);
  const e0 = await estado();

  // 2 · Al volver a abrir se aplica: compra sin empezar → se revalora y se avisa.
  await reabrir();
  const e1 = await estado();
  const t1 = await texto();
  paso('se aplica al reabrir, con aviso de cuánto cambia la lista', e1.precios === '2026-10-20' && !!e1.aviso && /tu lista pasa de/.test(t1),
    `${e0.precios} → ${e1.precios} · ${t1.split('\n').find((l) => /tu lista pasa/.test(l)) ?? 'sin aviso'}`);
  paso('la fecha visible es la de los precios de la lista', /20 OCT/.test(t1));
  await n.foto(path.join(destino, 'p1-aviso.png'));

  // 3 · Compra en curso: algo en el carro y llega otra instantánea.
  await n.tocarSelector('.fila-producto__principal', 800, 0);
  const marcados = (await estado()).lista.filter((x) => x.endsWith('*')).length;
  await publicar('gran-canaria', conPrecios('2026-10-21', { cebolla: 3.6, patata: 5.1 }));
  await reabrir(4000); await reabrir(4000); // la primera la baja, la segunda la aplicaría
  const e2 = await estado();
  paso('con la compra empezada, la lista y sus precios no cambian; los nuevos esperan',
    marcados > 0 && JSON.stringify(e2.lista) === JSON.stringify((await estado()).lista) && e2.precios === '2026-10-20' && e2.espera === '2026-10-21',
    `marcados ${marcados} · lista ${e2.precios} · en espera ${e2.espera}`);
  paso('y lo dice', /No te cambio la lista a mitad de compra/.test(await texto()));

  // 4 · Rechazos: una de otra zona en la URL de Gran Canaria, y una con un precio inverosímil.
  await publicar('gran-canaria', { ...conPrecios('2026-10-22', {}), zona: 'madrid' });
  await reabrir(4000);
  paso('una instantánea de otra zona no se guarda', (await guardada('gran-canaria')) === '2026-10-21', `guardada ${await guardada('gran-canaria')}`);
  await publicar('gran-canaria', conPrecios('2026-10-23', { cebolla: 30 }));
  await reabrir(4000);
  const vAntes = await n.js(`localStorage.getItem('cunde:estado:v16')`);
  await reabrir(4000);
  const cebolla = (await estado()).lista.find((x) => x.startsWith('69079:'));
  paso('un precio que se dispara (+800 %) no se aplica', !/:30(\*|$)/.test(cebolla ?? ''), `cebolla en la lista: ${cebolla}`);
  void vAntes;

  // 5 · Sin conexión. Antes, una navegación interna CON red: en el navegador el
  // trozo de Ionic de la transición se carga la primera vez que se usa (en el
  // APK va dentro y no hace falta).
  await n.tocar('SEMANA', 1200); await n.tocar('COMPRA', 1200);
  await n.cdp('Network.enable');
  await n.cdp('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await n.tocar('SEMANA', 1200); await n.tocar('COMPRA', 1200);
  const t5 = await texto();
  paso('sin conexión: misma zona y fecha visible', /Gran Canaria/.test(t5) && /20 OCT/.test(t5));

  // 6 · Analítica: llegó algo, y la cola offline se reenvía sin duplicar.
  const ev0 = await eventos();
  await n.tocarSelector('.fila-producto__principal', 400, 1); await n.tocarSelector('.fila-producto__principal', 400, 2);
  await n.tocar('SEMANA', 800); await n.tocar('COMPRA', 800);
  const cola = await n.js(`JSON.parse(localStorage.getItem('cunde:analytics-queue') || '[]').length`);
  await n.cdp('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await n.js(`window.dispatchEvent(new Event('online'))`); await esperar(2500);
  await fetch(`${SRV}/__caido?si=1`);
  await n.tocar('SEMANA', 600); await n.js(`document.dispatchEvent(new Event('visibilitychange'))`); await esperar(1500);
  await fetch(`${SRV}/__caido?si=0`);
  await n.js(`window.dispatchEvent(new Event('online'))`); await esperar(2500);
  const ev1 = await eventos();
  paso('el servidor recibe eventos de analítica', ev0.unicos > 0, `${ev0.unicos} al empezar (${[...new Set(ev0.nombres)].join(', ')})`);
  paso('la cola sin conexión se reenvía al volver, sin duplicados', cola > 0 && ev1.unicos > ev0.unicos && ev1.repetidos === 0,
    `en cola ${cola} · únicos ${ev0.unicos} → ${ev1.unicos} · repetidos ${ev1.repetidos} · peticiones ${ev1.peticiones}`);
  await n.foto(path.join(destino, 'p2-final.png'));
} finally {
  console.log(`\n${resultados.filter((r) => r.ok).length}/${resultados.length} pasos bien`);
  console.log('CONSOLA:\n' + (n.consola.join('\n') || '(sin errores)'));
  await n.cerrar();
}
