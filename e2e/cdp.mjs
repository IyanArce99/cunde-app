/** Chrome sin ventana, por el protocolo de depuración. Sin dependencias: Node 22 trae WebSocket y fetch. */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = process.env.CHROME ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
export const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

export async function abrir({ puerto = 9333, perfil, ancho = 390, alto = 844 }) {
  fs.rmSync(perfil, { recursive: true, force: true });
  const proc = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${puerto}`, `--user-data-dir=${perfil}`,
    `--window-size=${ancho},${alto}`, '--hide-scrollbars', '--no-first-run', '--disable-gpu', 'about:blank',
  ], { stdio: 'ignore' });

  let lista;
  for (let i = 0; i < 40; i++) {
    try { lista = await (await fetch(`http://127.0.0.1:${puerto}/json/list`)).json(); if (lista.length) break; } catch { /* aún no */ }
    await esperar(250);
  }
  const pagina = lista.find((p) => p.type === 'page');
  const ws = new WebSocket(pagina.webSocketDebuggerUrl);
  await new Promise((r, x) => { ws.onopen = r; ws.onerror = x; });
  let id = 0;
  const pendientes = new Map();
  const consola = [];
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pendientes.has(d.id)) { const { r, x } = pendientes.get(d.id); pendientes.delete(d.id); d.error ? x(new Error(d.error.message)) : r(d.result); }
    if (d.method === 'Runtime.exceptionThrown') consola.push('EXCEPCIÓN ' + (d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text).slice(0, 300));
    if (d.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(d.params.type)) consola.push(`${d.params.type}: ` + d.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 300));
  };
  const cdp = (method, params = {}) => new Promise((r, x) => { pendientes.set(++id, { r, x }); ws.send(JSON.stringify({ id, method, params })); });

  await cdp('Page.enable');
  await cdp('Runtime.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: ancho, height: alto, deviceScaleFactor: 2, mobile: true });
  await cdp('Emulation.setTouchEmulationEnabled', { enabled: true });
  await cdp('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36' });

  const js = async (expr) => {
    const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  const api = {
    cdp, js, consola,
    ir: async (url, ms = 1500) => { await cdp('Page.navigate', { url }); await esperar(ms); },
    foto: async (fichero) => {
      const r = await cdp('Page.captureScreenshot', { format: 'png' });
      fs.mkdirSync(path.dirname(fichero), { recursive: true });
      fs.writeFileSync(fichero, Buffer.from(r.data, 'base64'));
      return fichero;
    },
    /** Lo que se puede tocar y lo que se lee, de la página visible (la última ion-page no oculta). */
    mirar: () => js(`(() => {
      const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && r.bottom > 0 && r.top < innerHeight && !e.closest('.ion-page-hidden'); };
      const t = (e) => (e.innerText || e.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim().slice(0, 70);
      return {
        ruta: location.pathname,
        titulos: [...document.querySelectorAll('h1,h2')].filter(vis).map(t),
        botones: [...document.querySelectorAll('button,a,[role=button]')].filter(vis).map(t).filter(Boolean),
        campos: [...document.querySelectorAll('input')].filter(vis).map((i) => i.className + '=' + i.value),
      };
    })()`),
    /** Toca el primer botón visible cuyo texto contiene `texto`. */
    tocar: async (texto, ms = 700) => {
      const ok = await js(`(() => {
        const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.closest('.ion-page-hidden'); };
        const t = (e) => (e.innerText || e.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim();
        const b = [...document.querySelectorAll('button,a,[role=button]')].filter(vis).find((e) => t(e).includes(${JSON.stringify(texto)}));
        if (!b) return false; b.scrollIntoView({ block: 'center' }); b.click(); return true;
      })()`);
      await esperar(ms);
      return ok;
    },
    tocarSelector: async (sel, ms = 700, n = 0) => {
      const ok = await js(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(sel)})].filter((x) => !x.closest('.ion-page-hidden'))[${n}]; if (!e) return false; e.scrollIntoView({ block: 'center' }); e.click(); return true; })()`);
      await esperar(ms);
      return ok;
    },
    escribir: async (sel, valor) => {
      await js(`(() => { const i = document.querySelector(${JSON.stringify(sel)}); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, ${JSON.stringify(valor)}); i.dispatchEvent(new Event('input', { bubbles: true })); i.blur(); })()`);
      await esperar(300);
    },
    cerrar: async () => { try { ws.close(); } catch { /* */ } proc.kill(); },
  };
  return api;
}
