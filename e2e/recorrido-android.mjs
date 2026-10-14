/**
 * Recorrido de la beta en el emulador, por el WebView depurable de la app.
 * instalar → zona → generar → modificar comida → comprar → cerrar → reabrir sin red
 * → preparar la siguiente semana con la fecha adelantada (Date desplazado en el WebView).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ADB = path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk', 'platform-tools', 'adb.exe');
const adb = (...a) => execFileSync(ADB, a, { encoding: 'utf8' });
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const [repo, destino] = process.argv.slice(2);
fs.mkdirSync(destino, { recursive: true });
const PROD = 'es.cunde.app';
const BETA = 'es.cunde.app.beta';
const res = [];
const paso = (que, ok, det = '') => { res.push(ok); console.log(`${ok ? 'OK   ' : 'FALLO'} ${que}${det ? ` · ${det}` : ''}`); };
const foto = (n) => fs.writeFileSync(path.join(destino, n), execFileSync(ADB, ['exec-out', 'screencap', '-p']));

async function conectar(paquete) {
  for (let i = 0; i < 40; i++) {
    try {
      const pid = adb('shell', 'pidof', paquete).trim();
      const sock = pid && adb('shell', 'cat', '/proc/net/unix').match(new RegExp(`webview_devtools_remote_${pid}\\b`))?.[0];
      if (sock) {
        try { adb('forward', '--remove', 'tcp:9231'); } catch { /* */ }
        adb('forward', 'tcp:9231', `localabstract:${sock}`);
        const lista = await (await fetch('http://127.0.0.1:9231/json')).json();
        const p = lista.find((x) => x.type === 'page' && JSON.parse(x.description || '{}').attached) ?? lista.find((x) => x.type === 'page');
        const ws = new WebSocket(p.webSocketDebuggerUrl);
        await new Promise((r, x) => { ws.onopen = r; ws.onerror = x; });
        let id = 0; const pend = new Map();
        ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
        const cdp = (method, params = {}) => new Promise((r) => { pend.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
        const js = async (e) => (await cdp('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.result?.value;
        return { cdp, js, cerrar: () => ws.close() };
      }
    } catch { /* aún no */ }
    await esperar(1000);
  }
  throw new Error(`no encuentro el WebView de ${paquete}`);
}
const tocar = (c, t) => c.js(`(() => { const n = (e) => (e.innerText || '').replace(/\\s+/g, ' ').trim();
  const b = [...document.querySelectorAll('button,a,[role=button],ion-tab-button')].filter((e) => !e.closest('.ion-page-hidden') && e.getBoundingClientRect().width > 0).find((e) => n(e).includes(${JSON.stringify(t)}));
  if (!b) return false; b.scrollIntoView({ block: 'center' }); b.click(); return true; })()`);
const texto = (c) => c.js(`(document.querySelector('.ion-page:not(.ion-page-hidden)') || document.body).innerText`);
const estado = (c) => c.js(`(() => { const e = JSON.parse(localStorage.getItem('cunde:estado:v16') || '{}'); return { semana: e.contadores?.semanaNumero, inicio: e.semana?.fechaInicio, cerrada: e.cierre?.guardada, total: (e.lista || []).filter((i) => !i.esDespensa).reduce((a, i) => a + (i.precio || 0), 0), libres: (e.semana?.plan?.huecos || []).filter((h) => h.tipo === 'libre').length, zona: e.zonaDelPlan, marcados: (e.lista || []).filter((i) => i.enElCarro).length, items: (e.lista || []).length }; })()`);
const abrir = (p) => { adb('shell', 'am', 'start', '-n', `${p}/es.cunde.app.MainActivity`); };

// 0 · La versión «actual» instalada y con datos.
adb('install', '-r', path.join(repo, 'android/app/build/outputs/apk/debug/app-debug.apk'));
abrir(PROD); await esperar(6000);
let c = await conectar(PROD);
// Una clave propia: la del estado la reescribe la app abierta en cada cambio.
await c.js(`localStorage.setItem('cunde:prueba-coexistencia', 'datos-de-produccion')`);
c.cerrar();
const instaladoAntes = adb('shell', 'dumpsys', 'package', PROD).match(/firstInstallTime=([^\n]+)/)?.[1]?.trim();

// 1 · Instalar la beta, junto a la otra.
adb('install', '-r', path.join(repo, 'android/app/build/outputs/apk/beta/app-beta.apk'));
const paquetes = adb('shell', 'pm', 'list', 'packages', 'es.cunde');
paso('la beta se instala junto a la actual', paquetes.includes(`package:${BETA}`) && paquetes.includes(`package:${PROD}`), paquetes.replace(/\s+/g, ' ').trim());
abrir(PROD); await esperar(5000);
c = await conectar(PROD);
const marca = await c.js(`localStorage.getItem('cunde:prueba-coexistencia')`);
c.cerrar();
paso('la actual conserva sus datos y su instalación', marca === 'datos-de-produccion' && instaladoAntes === adb('shell', 'dumpsys', 'package', PROD).match(/firstInstallTime=([^\n]+)/)?.[1]?.trim(), `marca ${marca}`);
adb('shell', 'am', 'force-stop', PROD);

// 2 · Zona y semana en la beta.
abrir(BETA); await esperar(7000);
c = await conectar(BETA);
await c.js(`localStorage.clear()`); await c.js(`location.replace('/')`); await esperar(4000);
c = await conectar(BETA);
await tocar(c, 'Cuadrar mi semana'); await esperar(1500);
await c.js(`(() => { const i = document.querySelector('.super__cp-input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, '35007'); i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
await esperar(800);
const nota = await c.js(`document.querySelector('#super-cp-nota')?.innerText`);
paso('zona: 35007 → almacén 3120', /3120/.test(nota ?? ''), nota);
await tocar(c, 'Seguir'); await esperar(6000);
c = await conectar(BETA);
await tocar(c, 'Seguir'); await esperar(2000);
await tocar(c, 'Ver mi semana'); await esperar(15000);
const e1 = await estado(c);
paso('genera la semana', e1.items > 0 && e1.zona === 'gran-canaria', `${e1.items} productos · inicio ${e1.inicio}`);
foto('r1-semana.png');

// 3 · Modificar una comida: «No cocino» en el primer plato.
const primero = await c.js(`[...document.querySelectorAll('.ion-page:not(.ion-page-hidden) button')].find((b) => /€/.test(b.innerText) && /min/.test(b.innerText))?.innerText.split('\\n')[0]`);
await c.js(`[...document.querySelectorAll('.ion-page:not(.ion-page-hidden) button')].find((b) => /€/.test(b.innerText) && /min/.test(b.innerText))?.click()`);
await esperar(2000);
foto('r2-hoja-dia.png');
await tocar(c, 'No cocino'); await esperar(3000);
await tocar(c, 'Dejarlo así'); await esperar(3000);
const e2 = await estado(c);
paso('modificar una comida: «No cocino» la quita sin subir la compra', e2.libres >= 1 && e2.total <= e1.total + 0.005, `${primero} · libres ${e2.libres} · ${e1.total.toFixed(2)} → ${e2.total.toFixed(2)} €`);

// 4 · Comprar: marcar todo, cerrar la compra.
await tocar(c, 'COMPRA'); await esperar(2500);
await c.js(`[...document.querySelectorAll('.compra__pasillo-cabecera')].forEach((b) => b.click())`); await esperar(1500);
const e3 = await estado(c);
await tocar(c, 'Cerrar la compra'); await esperar(1500);
await c.js(`(() => { const i = document.querySelector('.cierre__input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, '55,10'); i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
await esperar(500);
await tocar(c, 'Guardar esta semana'); await esperar(5000);
const e4 = await estado(c);
paso('comprar y cerrar la compra', e3.marcados > 0 && e4.cerrada === true, `marcados ${e3.marcados}/${e3.items} · cerrada ${e4.cerrada}`);
foto('r3-cerrada.png');

// 5 · Reabrir sin red, en frío.
adb('shell', 'cmd', 'connectivity', 'airplane-mode', 'enable');
adb('shell', 'am', 'force-stop', BETA); await esperar(1500);
abrir(BETA); await esperar(14000);
c = await conectar(BETA);
const e5 = await estado(c);
const t5 = await texto(c);
paso('reabrir sin red: la semana y el cierre siguen', e5.cerrada === true && e5.inicio === e4.inicio && /SEMANA/.test(t5 ?? ''), `inicio ${e5.inicio} · pantalla: ${(t5 ?? '').split(String.fromCharCode(10)).slice(0, 4).join(' | ')}`);
foto('r4-sin-red.png');
adb('shell', 'cmd', 'connectivity', 'airplane-mode', 'disable');

// 6 · Siguiente semana, con la fecha del WebView adelantada 7 días.
await c.cdp('Page.enable');
await c.cdp('Page.addScriptToEvaluateOnNewDocument', { source: `(() => { const D = Date; const off = 7 * 864e5; class F extends D { constructor(...a) { if (a.length) { super(...a); } else { super(D.now() + off); } } static now() { return D.now() + off; } } window.Date = F; })();` });
await c.js(`location.reload()`); await esperar(7000);
c = await conectar(BETA);
const hay = await c.js(`[...document.querySelectorAll('button')].some((b) => b.innerText.trim() === 'Preparar siguiente semana')`);
await tocar(c, 'Preparar siguiente semana'); await esperar(10000);
const e6 = await estado(c);
paso('pasados 7 días, «Preparar siguiente semana» abre la semana 2', hay && e6.semana === 2 && e6.inicio !== e4.inicio && !e6.cerrada, `botón ${hay} · semana ${e6.semana} · inicio ${e6.inicio}`);
foto('r5-semana-2.png');
c.cerrar();
console.log(`\n${res.filter(Boolean).length}/${res.length} pasos bien`);
process.exit(0);
