import fs from 'node:fs';

const T = JSON.parse(fs.readFileSync('docs/capturas/_tarjetas.json', 'utf8'));
const vin = (n) => fs.readFileSync(`public/marca/vinetas/${n}.svg`, 'utf8').replace(/\n\s*/g, ' ');

/* Ilustración pastel al estilo de la referencia: formas blandas, paleta
   apagada, degradado suave, esquinas redondeadas. Dibujada a mano para que la
   comparación sea justa, no descargada. */
const pastelA = `<svg viewBox="0 0 200 150" width="100%" height="100%">
  <defs><linearGradient id="cielo" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FBE3D2"/><stop offset="1" stop-color="#FDF2E9"/>
  </linearGradient></defs>
  <rect width="200" height="150" rx="14" fill="url(#cielo)"/>
  <circle cx="150" cy="42" r="19" fill="#F7C9A8"/>
  <path d="M0 110 q34 -18 62 -2 q30 17 60 -4 q26 -18 78 -1 V150 H0 Z" fill="#CBD9C6"/>
  <path d="M0 127 q40 -12 74 2 q34 14 66 -3 q30 -15 60 -2 V150 H0 Z" fill="#A9BFA6"/>
  <circle cx="78" cy="68" r="12" fill="#E8A87C"/>
  <path d="M62 117 q0 -22 16 -22 q16 0 16 22 Z" fill="#8FA8C4"/>
  <circle cx="107" cy="77" r="10" fill="#EFC1A0"/>
  <path d="M93 117 q0 -18 14 -18 q14 0 14 18 Z" fill="#B9C7D8"/>
</svg>`;

const pastelB = `<svg viewBox="0 0 200 150" width="100%" height="100%">
  <rect width="200" height="150" rx="14" fill="#F6EDE4"/>
  <circle cx="100" cy="68" r="40" fill="#FBDFCB"/>
  <path d="M79 68 h42" stroke="#E8A87C" stroke-width="7" stroke-linecap="round"/>
  <path d="M62 104 q38 14 76 0" stroke="#CBD9C6" stroke-width="6" fill="none" stroke-linecap="round"/>
  <circle cx="150" cy="36" r="9" fill="#A9BFA6"/>
  <circle cx="48" cy="112" r="6" fill="#F7C9A8"/>
</svg>`;

const chips = ['1', '2', '3', '4', '5+']
  .map((n) => `<span class="chip${n === '2' ? ' chip--sel' : ''}">${n}</span>`).join('');

const html = `<title>Cunde · pastel y tarjetas de día</title>
<style>
  :root{--papel:#EFEDE6;--crema:#F6F4EE;--papel2:#E5E2D8;--tinta:#1A1917;--azulete:#2B4C7E;
    --oferta-f:rgba(255,212,0,.22);--oferta-b:#C9A800;--gris:#6E6A5F;--pauta:#A9A498;
    --mono:ui-monospace,'SF Mono',Menlo,Consolas,monospace;
    --cuerpo:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;}
  @media (prefers-color-scheme:dark){:root{--papel:#161513;--crema:#1E1D1A;--papel2:#242219;
    --tinta:#EDEBE4;--azulete:#8FB3E0;--gris:#A8A39A;--pauta:#4A4740;}}
  :root[data-theme='dark']{--papel:#161513;--crema:#1E1D1A;--papel2:#242219;--tinta:#EDEBE4;
    --azulete:#8FB3E0;--gris:#A8A39A;--pauta:#4A4740;}
  :root[data-theme='light']{--papel:#EFEDE6;--crema:#F6F4EE;--papel2:#E5E2D8;--tinta:#1A1917;
    --azulete:#2B4C7E;--gris:#6E6A5F;--pauta:#A9A498;}
  body{margin:0;background:var(--papel);color:var(--tinta);font-family:var(--cuerpo);-webkit-font-smoothing:antialiased}
  .env{max-width:1180px;margin:0 auto;padding:36px 20px 80px}
  header{border-bottom:1.5px solid var(--tinta);padding-bottom:16px}
  h1{font:700 clamp(26px,5vw,40px)/1 var(--cuerpo);letter-spacing:-.03em;margin:8px 0 0}
  .sello{font:500 12px/1 var(--mono);color:var(--gris)}
  .baja{font:400 15px/1.6 var(--cuerpo);color:var(--gris);max-width:64ch;margin:12px 0 0}
  h2{font:700 clamp(19px,3vw,25px)/1.2 var(--cuerpo);letter-spacing:-.02em;margin:48px 0 4px}
  .nota{font:400 15px/1.6 var(--cuerpo);max-width:62ch;margin:6px 0 22px}
  .fila{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:26px;align-items:start}
  .col{min-width:0}
  .etq{font:500 12px/1.4 var(--mono);color:var(--gris);margin-bottom:8px;display:block}
  .movil{width:340px;max-width:100%;background:var(--papel);border:1px solid var(--pauta);padding:16px 14px}
  .ver{border-left:3px solid var(--azulete);padding:2px 0 2px 16px;margin:18px 0 0}
  .ver p{font:400 15px/1.65 var(--cuerpo);margin:0;max-width:62ch}
  .ver strong{font-weight:600}

  .anc{display:flex;align-items:center;gap:16px;margin-bottom:14px}
  .anc svg{width:68px;height:68px;flex:none;color:var(--pauta)}
  .preg{font:700 22px/1.25 var(--cuerpo);letter-spacing:-.02em;margin:0}
  .past{margin-bottom:14px;line-height:0}
  .chip{display:inline-block;border:1.5px solid var(--pauta);border-radius:4px;padding:12px 18px;
    font:600 17px var(--cuerpo);margin:0 6px 8px 0}
  .chip--sel{border-color:var(--azulete);background:rgba(43,76,126,.07);color:var(--azulete)}

  .t-act{border:1px solid var(--pauta);border-radius:4px;padding:11px 14px 13px;margin-bottom:8px}
  .t-act__dia{display:block;font:500 13px/1 var(--mono);color:var(--gris)}
  .t-act__h{margin-top:8px;padding-top:6px;border-top:1px dashed var(--pauta)}
  .t-act__cab{display:flex;justify-content:space-between;align-items:baseline;gap:6px}
  .t-act__ran,.t-act__meta{font:500 13px/1 var(--mono);color:var(--gris)}
  .t-act__pl{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:baseline;margin-top:3px}
  .t-act__nom{font:600 17px/1.2 var(--cuerpo);min-width:0}
  .t-act__nom--s{font-weight:400;color:var(--gris)}
  .t-act__pre{font:400 15px/1.2 var(--mono);white-space:nowrap}
  .t-act__org{display:block;font:400 13px/1.2 var(--mono);color:var(--gris);margin-top:3px}

  .b1{margin-bottom:14px}
  .b1__dia{display:block;font:500 13px/1 var(--mono);color:var(--gris);margin-bottom:6px}
  .b1__h{display:flex;gap:6px;background:var(--crema);border-radius:4px;padding:10px 12px 11px;
    margin-bottom:6px;position:relative;overflow:hidden}
  .b1__barra{position:absolute;left:0;top:0;bottom:0;width:4px}
  .b1__h--cocinado .b1__barra{background:var(--azulete)}
  .b1__h--sobras .b1__barra{background:var(--pauta)}
  .b1__h--ensamblaje .b1__barra{background:var(--oferta-b)}
  .b1__h--sobras{background:var(--papel2)}
  .b1__cuerpo{flex:1;min-width:0;padding-left:6px}
  .b1__cab{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
  .b1__ran,.b1__meta{font:500 12px/1 var(--mono);color:var(--gris)}
  .b1__meta{margin-left:auto}
  .b1__sello{font:600 10px/1 var(--cuerpo);letter-spacing:.06em;padding:3px 6px;border-radius:3px}
  .b1__sello--cocinado{background:rgba(43,76,126,.12);color:var(--azulete)}
  .b1__sello--sobras{background:transparent;color:var(--gris);border:1px solid var(--pauta)}
  .b1__sello--ensamblaje{background:var(--oferta-f);color:var(--oferta-b)}
  .b1__pl{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:baseline;margin-top:5px}
  .b1__nom{font:600 17px/1.2 var(--cuerpo);min-width:0}
  .b1__pre{font:400 15px/1.2 var(--mono);white-space:nowrap}
  .b3__foto{width:52px;height:52px;flex:none;border-radius:3px;background:var(--papel2);
    background-image:var(--foto);background-size:cover;background-position:center;margin-left:6px}

  .b2{display:grid;grid-template-columns:64px 1fr;gap:12px;padding:12px 0;border-top:1px dashed var(--pauta)}
  .b2__rail{display:flex;flex-direction:column;gap:2px}
  .b2__dia{font:600 15px/1 var(--mono)}
  .b2__tot{font:400 13px/1 var(--mono);color:var(--gris)}
  .b2__col{display:flex;flex-direction:column;gap:10px;min-width:0}
  .b2__h{display:flex;gap:10px;align-items:flex-start;min-width:0}
  .b2__punto{width:10px;height:10px;border-radius:50%;flex:none;margin-top:5px}
  .b2__punto--cocinado{background:var(--azulete)}
  .b2__punto--sobras{background:transparent;border:2px solid var(--pauta)}
  .b2__punto--ensamblaje{background:var(--oferta-b)}
  .b2__nom{display:block;font:600 17px/1.2 var(--cuerpo)}
  .b2__sub{display:block;font:400 13px/1.5 var(--mono);color:var(--gris)}
</style>
<div class="env">
<header>
  <span class="sello">340 px DE ANCHO · MISMOS TOKENS Y LA MISMA SEMANA EN TODAS</span>
  <h1>Pastel y tarjetas de día</h1>
  <p class="baja">Todo con la misma semana real del motor —63,89 € para dos— para que la comparación sea de forma y no de contenido. Claro y oscuro según tu sistema.</p>
</header>

<h2>1 · El ancla del onboarding</h2>
<p class="nota">Izquierda, la viñeta de ticket que hay hoy. Derecha, una ilustración pastel dibujada a mano al estilo de la referencia que me mandaste: formas blandas, paleta apagada, degradado, esquinas redondeadas.</p>
<div class="fila">
  <div class="col"><span class="etq">A · VIÑETA DE TICKET (actual)</span>
    <div class="movil">
      <div class="anc">${vin('comensales')}<h3 class="preg">¿Cuántos sois?</h3></div>
      <div>${chips}</div>
      <div class="anc" style="margin-top:26px">${vin('restricciones')}<h3 class="preg">¿Hay algo que no podáis comer?</h3></div>
    </div>
  </div>
  <div class="col"><span class="etq">B · ILUSTRACIÓN PASTEL</span>
    <div class="movil">
      <div class="past">${pastelA}</div>
      <h3 class="preg">¿Cuántos sois?</h3>
      <div style="margin-top:12px">${chips}</div>
      <div class="past" style="margin-top:26px">${pastelB}</div>
      <h3 class="preg">¿Hay algo que no podáis comer?</h3>
    </div>
  </div>
</div>
<div class="ver"><p><strong>Júzgalo por el conjunto, no por la ilustración.</strong> La pastel es agradable sola. Al lado del ticket de la portada y de la cifra monoespaciada de Semana, decide si las dos cosas parecen la misma app. Y fíjate en el alto: la ilustración pide el triple que la viñeta, así que empuja los botones hacia abajo — en el onboarding eso se paga en toques.</p></div>

<h2>2 · Las tarjetas de día</h2>
<p class="nota">Tres formatos con los mismos tres días. Lo que se busca: que la diferencia entre <em>cocinas</em>, <em>recalientas</em> y <em>aprovechas</em> —que es lo que vende el producto— se vea sin tener que leer.</p>
<div class="fila">
  <div class="col"><span class="etq">ACTUAL · caja con borde, rótulo de texto</span><div class="movil">${T.actual}</div></div>
  <div class="col"><span class="etq">B1 · BARRA DE COLOR Y SELLO POR TIPO</span><div class="movil">${T.b1}</div></div>
  <div class="col"><span class="etq">B2 · RAÍL DE DÍA, SIN CAJA</span><div class="movil">${T.b2}</div></div>
</div>

<h2>3 · B1 cuando haya fotos</h2>
<p class="nota">La misma B1 con la miniatura de 52 px donde la receta tiene foto. Hoy la tiene 1 de 112; con las 15 del ranking, la mitad de los huecos que sirve la app.</p>
<div class="fila"><div class="col"><span class="etq">B1 + MINIATURA</span><div class="movil">${T.b3}</div></div></div>

<div class="ver"><p><strong>Lo que yo defiendo:</strong> el color de B1 es información —azulete cocinas, gris recalientas, amarillo aprovechas—, así que rompe la uniformidad sin añadir ruido y reutiliza los tres colores que el usuario ya conoce de la barra de presupuesto. B2 gana en scroll y pierde de vista el coste por ración. Y la vividez que buscas la traen las fotos, no la paleta: mira la sección 3.</p></div>
</div>
`;

fs.writeFileSync('docs/capturas/pastel-tarjetas.html', html);
console.log(`${(fs.statSync('docs/capturas/pastel-tarjetas.html').size / 1024).toFixed(0)} KB`);
