#!/usr/bin/env node --experimental-strip-types
/**
 * Página LOCAL para revisar las alternativas de una zona: foto, enlace a la
 * ficha, formato y precio online, validación técnica por dimensión (con la foto
 * que falta, si falta algo) y, aparte, tu aceptación culinaria.
 *
 * La aceptación no se guarda en ningún servidor: la página genera el contenido
 * de catalogo/zonas/<zona>-aceptacion.json para copiarlo o descargarlo.
 *
 *   node --experimental-strip-types catalogo/pagina-alternativas.ts gran-canaria 3120 2026-10-14
 *   → docs/alternativas-3120.html
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const leer = (r: string) => JSON.parse(fs.readFileSync(r, 'utf8'));
const [zona, almacen, fecha] = process.argv.slice(2);

const alternativas = leer(path.join(aqui, 'zonas', `${zona}-alternativas.json`)).alternativas;
const aceptacion = leer(path.join(aqui, 'zonas', `${zona}-aceptacion.json`)).decisiones;
const madrid = new Map(leer(path.join(aqui, 'auditoria', `mad3-${fecha}.json`)).filas.map((f: any) => [f.canonico, f]));
const auditoria = new Map(leer(path.join(aqui, 'auditoria', `${almacen}-${fecha}-${zona}-propuesta-parcial.json`)).filas.map((f: any) => [f.canonico, f]));
const catalogo: any[] = leer(path.join(aqui, 'capturas-crudas', `catalogo_mercadona_${almacen}_${fecha}.json`));
const foto = new Map(catalogo.map((p) => [p.sku, p.imagen]));

const esc = (t: unknown) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const eur = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;
const peso = (m: any) => {
  if (!m) return '—';
  const g = (x: number) => (x < 1 ? `${Math.round(x * 1000)} g` : `${String(x).replace('.', ',')} ${m.unidad}`);
  return `${m.packaging ? `${m.packaging} ` : ''}${g(m.contenido)}${m.escurrido && m.escurrido / m.contenido < 0.97 ? ` (${g(m.escurrido)} escurr.)` : ''}${m.granel ? ' · pieza aprox.' : ''}`;
};

const GRUPOS: [string, string, string][] = [
  ['mismo-producto', 'Mismo producto con otra referencia', 'El mismo producto que en Madrid con otra referencia o formato, y validado técnicamente. Solo falta que digas si te vale.'],
  ['sustitucion', 'Sustitución que requiere ajustar cantidades o preparación', 'Otro producto del mismo tipo, validado técnicamente. Mira los ajustes antes de aceptarlo.'],
  ['insuficiente-o-incompatible', 'Información insuficiente o alternativa incompatible', 'Alguna dimensión técnica no está validada. Tu aceptación no basta para usarla: hace falta la evidencia que se indica.'],
  ['sin-alternativa', 'Sin alternativa', 'No hay en 3120 un producto honesto para esto. Las recetas que lo llevan quedan fuera.'],
];
const DIM: [string, string][] = [['formato', 'Formato'], ['cantidades', 'Cantidades'], ['ingredientes', 'Ingredientes'], ['alergenos', 'Alérgenos']];
const ETIQUETA: Record<string, string> = { ok: 'validado', 'segun-perfil': 'según perfil', pendiente: 'pendiente', incompatible: 'incompatible' };

function tarjeta(canonico: string, a: any): string {
  const md = madrid.get(canonico) as any;
  const original = md?.mercadona
    ? `${esc(md.mercadona.nombre)} · ${esc(peso(md.mercadona))} · ${eur(md.mercadona.precio)}`
    : esc(md?.nombreApp ?? '—');
  if (!a.sku) {
    return `<article class="alt"><header><h3>${esc(canonico.replace(/_/g, ' '))}</h3></header>
      <p class="madrid"><span>Madrid</span> ${original}</p><p>${esc(a.motivo)}</p></article>`;
  }
  const f = auditoria.get(canonico) as any;
  const m = f?.mercadona;
  const img = foto.get(a.sku);
  const filas = DIM.map(([k, nombre]) => {
    const d = a.tecnica?.[k];
    if (!d) return '';
    return `<tr><th>${nombre}</th><td><span class="chip chip--${d.estado}">${ETIQUETA[d.estado] ?? d.estado}</span></td>
      <td>${esc(d.nota)}${d.falta ? `<p class="falta"><strong>Falta:</strong> ${esc(d.falta)}</p>` : ''}</td></tr>`;
  }).join('');
  const decision = aceptacion[canonico];
  const radio = (v: string, txt: string) => `<label><input type="radio" name="${canonico}" value="${v}"${String(decision) === v ? ' checked' : ''}> ${txt}</label>`;
  const bloqueada = a.grupo === 'insuficiente-o-incompatible';
  return `<article class="alt" data-canonico="${canonico}">
    <header>
      ${img ? `<img src="${esc(img)}" alt="" loading="lazy" width="96" height="96">` : '<div class="sinfoto">sin foto</div>'}
      <div>
        <h3>${esc(canonico.replace(/_/g, ' '))}</h3>
        <p class="madrid"><span>Madrid</span> ${original}</p>
        <p class="nueva"><span>${almacen}</span> <a href="https://tienda.mercadona.es/product/${esc(a.sku)}/" target="_blank" rel="noopener">${esc(m?.nombre ?? a.sku)}</a> · SKU ${esc(a.sku)}</p>
        <p class="precio">${esc(peso(m))} · <strong>${m ? eur(m.precio) : '—'}</strong> <small>online</small></p>
      </div>
    </header>
    <p class="motivo">${esc(a.motivo)}</p>
    ${a.ajustes ? `<p class="ajustes"><strong>Ajustes:</strong> ${esc(a.ajustes)}</p>` : ''}
    <details${bloqueada ? ' open' : ''}><summary>Validación técnica</summary><table>${filas}</table></details>
    <fieldset class="culinaria"><legend>Tu aceptación culinaria${bloqueada ? ' <small>(no basta: falta evidencia técnica)</small>' : ''}</legend>
      ${radio('true', 'Me vale')} ${radio('false', 'No me vale')} ${radio('null', 'Sin decidir')}
    </fieldset>
  </article>`;
}

const secciones = GRUPOS.map(([g, titulo, explica]) => {
  const items = Object.entries<any>(alternativas).filter(([, a]) => a.grupo === g);
  return `<section><h2>${titulo} <span class="n">${items.length}</span></h2><p class="explica">${explica}</p>
    ${items.map(([c, a]) => tarjeta(c, a)).join('\n')}</section>`;
}).join('\n');

const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Alternativas 3120</title>
<style>
:root{--papel:#EFEDE6;--papel-2:#E5E2D8;--crema:#F6F4EE;--tinta:#1A1917;--azulete:#2B4C7E;--oferta:#FFD400;--roja:#C8341F;--pauta:#A9A498;--gris:#6E6A5E;
--mono:"IBM Plex Mono",ui-monospace,Consolas,monospace;--display:"Bricolage Grotesque",system-ui,sans-serif;--cuerpo:Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
*{box-sizing:border-box}body{margin:0;background:var(--papel);color:var(--tinta);font:15px/1.45 var(--cuerpo)}
main{max-width:860px;margin:0 auto;padding:24px 16px 24px}
h1{font:700 34px/1.1 var(--display);margin:0 0 8px}h2{font:700 22px/1.2 var(--display);margin:40px 0 4px}
h2 .n{font:500 15px var(--mono);color:var(--gris)}h3{font:600 17px/1.2 var(--cuerpo);margin:0 0 4px;text-transform:capitalize}
.lead,.explica{color:var(--gris);margin:0 0 12px}.lead strong{color:var(--tinta)}
.alt{background:var(--crema);border:1px solid var(--papel-2);border-radius:8px;padding:14px;margin:12px 0}
.alt header{display:flex;gap:12px;align-items:flex-start}.alt img,.sinfoto{width:96px;height:96px;flex:none;border-radius:6px;background:#fff;object-fit:contain}
.sinfoto{display:grid;place-items:center;font:13px var(--mono);color:var(--pauta)}
.madrid,.nueva,.precio{margin:2px 0;font:13px/1.4 var(--mono);font-variant-numeric:tabular-nums}
.madrid span,.nueva span{display:inline-block;min-width:48px;color:var(--gris)}
.precio strong{font-size:15px}.precio small{color:var(--gris)}
a{color:var(--azulete)}.motivo,.ajustes{margin:10px 0 0}.ajustes{background:var(--papel-2);padding:8px 10px;border-radius:6px}
details{margin-top:10px}summary{cursor:pointer;font-weight:600}
table{width:100%;border-collapse:collapse;margin-top:6px;font-size:13px}th,td{text-align:left;vertical-align:top;padding:6px 6px;border-top:1px dashed var(--pauta)}
th{width:96px;font-weight:600}td:nth-child(2){width:104px}
.chip{display:inline-block;font:500 12px var(--mono);padding:2px 6px;border-radius:4px;border:1px solid currentColor}
.chip--ok{color:var(--azulete)}.chip--segun-perfil{color:var(--tinta);background:var(--oferta);border-color:var(--oferta)}
.chip--pendiente{color:var(--gris)}.chip--incompatible{color:var(--roja)}
.falta{margin:4px 0 0;color:var(--tinta)}
fieldset{border:0;margin:12px 0 0;padding:10px 0 0;border-top:1px dashed var(--pauta)}legend{font-weight:600;padding:0}legend small{font-weight:400;color:var(--gris)}
fieldset label{margin-right:14px;white-space:nowrap}
.salida{max-width:860px;margin:0 auto;background:var(--crema);border-top:2px solid var(--tinta);padding:12px 16px 32px}
.salida textarea{width:100%;height:120px;font:12px var(--mono);border:1px solid var(--pauta);border-radius:6px;padding:8px;background:#fff;color:var(--tinta)}
button{font:600 15px var(--cuerpo);background:var(--azulete);color:#fff;border:0;border-radius:6px;padding:10px 14px;margin:8px 8px 0 0;cursor:pointer}
@media (max-width:520px){.alt header{flex-direction:column}td:nth-child(2){width:auto}}
</style></head><body><main>
<h1>Alternativas · almacén ${almacen}</h1>
<p class="lead">Gran Canaria, 35007. Precio y formato son los de la <strong>tienda online</strong> consultados el ${fecha}; en la tienda física pueden cambiar.</p>
<p class="lead"><strong>Hay dos decisiones distintas.</strong> La validación técnica (formato, cantidades, ingredientes, alérgenos) la hace la máquina con la ficha y la etiqueta, y dice qué falta. La aceptación culinaria es tuya: si ese producto te vale para cocinar esa receta. Una alternativa solo entra si tiene las dos. «Según perfil» significa que vale, salvo para quien filtra lo que declara su etiqueta.</p>
${secciones}
</main>
<div class="salida"><p><strong>Tu aceptación</strong> → guárdala como <code>catalogo/zonas/${zona}-aceptacion.json</code> y ejecuta <code>construir-zona.ts cerrar ${zona} ${fecha}</code>.</p>
<textarea id="json" readonly></textarea><br><button id="copiar">Copiar</button><button id="bajar">Descargar</button></div>
<script>
(function(){
  var CLAVE='cunde:aceptacion:${zona}';
  var base=${JSON.stringify(aceptacion)};
  var guardado={};try{guardado=JSON.parse(localStorage.getItem(CLAVE)||'{}')}catch(e){}
  Object.keys(guardado).forEach(function(c){var r=document.querySelector('input[name="'+c+'"][value="'+String(guardado[c])+'"]');if(r)r.checked=true});
  function leer(){var d={};Object.keys(base).forEach(function(c){var r=document.querySelector('input[name="'+c+'"]:checked');var v=r?r.value:'null';d[c]=v==='true'?true:v==='false'?false:null});return d}
  function pintar(){var d=leer();try{localStorage.setItem(CLAVE,JSON.stringify(d))}catch(e){}
    document.getElementById('json').value=JSON.stringify({nota:'Aceptación culinaria de las alternativas de ${zona}. true: me vale; false: no; null: sin decidir. Independiente de la validación técnica.',decisiones:d},null,2)}
  document.addEventListener('change',pintar);pintar();
  document.getElementById('copiar').onclick=function(){var t=document.getElementById('json');t.select();try{navigator.clipboard.writeText(t.value)}catch(e){document.execCommand('copy')}};
  document.getElementById('bajar').onclick=function(){var b=new Blob([document.getElementById('json').value+'\\n'],{type:'application/json'});var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='${zona}-aceptacion.json';a.click()};
})();
</script></body></html>
`;
const salida = path.join(aqui, '..', 'docs', `alternativas-${almacen}.html`);
fs.writeFileSync(salida, html);
console.log(`Escrita ${path.relative(process.cwd(), salida)}`);
