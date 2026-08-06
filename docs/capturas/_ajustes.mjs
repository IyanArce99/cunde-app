import fs from 'node:fs';

/* Números reales: variedad y proteína salen del motor con 2 personas y 65 €;
   el postre, de los precios de Mercadona del 28 jul (6 yogures + fruta). */
const VARIEDAD = [
  { v: 'poca', l: 'Poca', n: 'repites bastante', p: 64.80, e: '+4,58 €' },
  { v: 'normal', l: 'Normal', n: 'repites algo', p: 60.22, e: 'lo más barato' },
  { v: 'mucha', l: 'Mucha', n: 'casi sin repetir', p: 60.50, e: '+0,28 €' },
];
const PROTEINA = [
  { v: 'basica', l: 'Básica', n: 'legumbre y huevo', pr: '59 g', ti: '3,24 €', p: 62.93 },
  { v: 'normal', l: 'Normal', n: 'carne 3 días', pr: '58 g', ti: '5,27 €', p: 63.89 },
  { v: 'alta', l: 'Alta', n: 'carne casi a diario', pr: '62 g', ti: '6,29 €', p: 63.62 },
];
const POSTRE = [
  { v: 'no', l: 'No', n: 'sin postre', p: 0, e: 'lo más barato' },
  { v: 'semana', l: 'Entre semana', n: '5 días', p: 2.84, e: '+2,84 €' },
  { v: 'todos', l: 'Todos los días', n: '7 días', p: 4.69, e: '+4,69 €' },
];
const COMIDAS = [['Comidas', '7 platos'], ['Cenas', '7 platos'], ['Las dos', '14 platos']];
const TIEMPO = [['Lo mínimo', 'menos de 20 min'], ['Lo normal', '30 a 40 min'], ['Me gusta cocinar', 'sin límite']];
const ALERGIAS = ['Gluten', 'Lactosa', 'Huevo', 'Frutos secos', 'Marisco', 'Pescado', 'Cacahuete', 'Soja', 'Sésamo', 'Apio', 'Sulfitos', 'Mostaza'];
const DIETAS = ['Vegetariano', 'Vegano', 'Cerdo'];
const eur = (n) => n.toFixed(2).replace('.', ',') + ' €';

/* ── piezas ─────────────────────────────────────────────────────────── */
const preg = (t) => `<h2 class="aj__preg">${t}</h2>`;
const pills = (ops, sel) => `<div class="aj__fila">${ops.map(([l, m]) => `
  <button class="aj__pill${l === sel ? ' on' : ''}"><span class="aj__pill-l">${l}</span><span class="aj__pill-m">${m}</span></button>`).join('')}</div>`;
const bloques = (ops, sel) => `<div class="aj__bloques">${ops.map(([l, s]) => `
  <button class="aj__bloque${l === sel ? ' on' : ''}"><span class="aj__bl">${l}</span><span class="aj__bs">${s}</span></button>`).join('')}</div>`;
const sc = (ops, sel, ejes) => `<div class="sc">${ops.map((o) => `
  <button class="sc__op${o.v === sel ? ' on' : ''}"><span class="sc__l">${o.l}</span><span class="sc__n">${o.n}</span>
  <span class="sc__p">${ejes ? ejes(o).a : (o.p === 0 ? '0,00 €' : eur(o.p))}</span>
  <span class="sc__e">${ejes ? ejes(o).b : o.e}</span></button>`).join('')}</div>`;
const ejesProt = (o) => ({ a: o.pr, b: `tiras ${o.ti} · ${eur(o.p)}` });
const chips = (xs, sel) => `<div class="aj__chips">${xs.map((c) => `<button class="aj__chip${c === sel ? ' on' : ''}">${c}</button>`).join('')}</div>`;
const restricciones = () => `
  <button class="aj__pill aj__pill--ancho on"><span class="aj__pill-l">Nada, como de todo</span></button>
  <span class="aj__grupo">Alergias e intolerancias</span>${chips(ALERGIAS)}
  <span class="aj__grupo">Por dieta</span>${chips(DIETAS)}`;
const cab = (t) => `<div class="aj__cab"><span class="aj__tit">${t}</span><button class="aj__x">✕</button></div>`;
const guardar = () => `<button class="aj__guardar">Guardar ajustes</button>`;
/** Línea de ticket: concepto, guía de puntos, valor. Abre lo suyo. */
const linea = (l, v, extra = '') => `<button class="aj__linea">
  <span class="aj__linea-l">${l}</span><span class="aj__linea-g"></span>
  <span class="aj__linea-v">${v}</span>${extra}<span class="aj__linea-f">›</span></button>`;
const plegado = (t, v) => `<button class="aj__plegado">
  <span class="aj__plegado-t">${t}</span><span class="aj__linea-g"></span>
  <span class="aj__plegado-v">${v}</span><span class="aj__linea-f">›</span></button>`;

/* ── las cinco ──────────────────────────────────────────────────────── */
const A = `${cab('AJUSTAR LA SEMANA')}
  ${preg('¿Qué resuelvo?')}${pills(COMIDAS, 'Las dos')}
  ${preg('¿Cuánto quieres cocinar?')}${bloques(TIEMPO, 'Lo normal')}
  ${preg('¿Cuánta variedad quieres?')}${sc(VARIEDAD, 'normal')}
  ${preg('¿Cuánta proteína?')}${sc(PROTEINA, 'normal', ejesProt)}
  <p class="aj__nota">Algo de lo fresco se queda por el camino.</p>
  ${preg('¿Pones postre?')}${sc(POSTRE, 'no')}
  <p class="aj__nota">Fruta y yogur, variados solos. Sale del presupuesto, no se suma encima.</p>
  ${preg('¿Algo que no comes?')}${restricciones()}
  ${guardar()}`;

const B = `${cab('AJUSTAR LA SEMANA')}
  <p class="aj__intro">Lo que mueve el dinero.</p>
  ${preg('¿Cuánta variedad quieres?')}${sc(VARIEDAD, 'normal')}
  ${preg('¿Cuánta proteína?')}${sc(PROTEINA, 'normal', ejesProt)}
  <p class="aj__nota">Algo de lo fresco se queda por el camino.</p>
  ${preg('¿Pones postre?')}${sc(POSTRE, 'no')}
  <p class="aj__nota">Fruta y yogur, variados solos. Sale del presupuesto.</p>
  <div class="aj__separador"></div>
  ${plegado('Qué resuelvo', 'comidas y cenas')}
  ${plegado('Cuánto cocinas', 'lo normal')}
  ${plegado('Lo que no comes', 'de todo')}
  ${guardar()}`;

const C = `${cab('AJUSTAR LA SEMANA')}
  <div class="aj__indice">
    ${linea('Variedad', 'normal', '<span class="aj__linea-p">60,22 €</span>')}
    ${linea('Proteína', 'normal', '<span class="aj__linea-p">63,89 €</span>')}
    ${linea('Postre', 'no', '<span class="aj__linea-p">0,00 €</span>')}
    ${linea('Qué resuelvo', 'comidas y cenas')}
    ${linea('Cuánto cocinas', 'lo normal')}
    ${linea('Lo que no comes', 'de todo')}
  </div>
  <p class="aj__nota">Cada línea se abre sola. La semana se rehace al guardar.</p>
  ${guardar()}`;

const D = `${cab('AJUSTAR LA SEMANA')}
  ${preg('¿Cuánta variedad quieres?')}${sc(VARIEDAD, 'normal')}
  <div class="aj__cerradas">
    ${plegado('Proteína', 'normal · 58 g')}
    ${plegado('Postre', 'no')}
    ${plegado('Qué resuelvo', 'comidas y cenas')}
    ${plegado('Cuánto cocinas', 'lo normal')}
    ${plegado('Lo que no comes', 'de todo')}
  </div>
  ${guardar()}`;

const E = `${cab('AJUSTAR LA SEMANA')}
  <div class="aj__total">
    <span class="aj__total-et">LA SEMANA QUEDARÍA EN</span>
    <span class="aj__total-c">60,22 €</span>
    <span class="aj__total-s">de 65,00 € · te sobrarían 4,78 €</span>
  </div>
  ${preg('¿Cuánta variedad quieres?')}${sc(VARIEDAD, 'normal')}
  ${preg('¿Cuánta proteína?')}${sc(PROTEINA, 'normal', ejesProt)}
  ${preg('¿Pones postre?')}${sc(POSTRE, 'no')}
  <div class="aj__separador"></div>
  ${plegado('Qué resuelvo', 'comidas y cenas')}
  ${plegado('Cuánto cocinas', 'lo normal')}
  ${plegado('Lo que no comes', 'de todo')}
  ${guardar()}`;

const OPCIONES = [
  { id: 'a', t: 'A · Como está hoy, más el postre', d: 'La referencia. Seis preguntas del mismo peso, una detrás de otra.', html: A },
  { id: 'b', t: 'B · Por frecuencia', d: 'Arriba lo que mueve el dinero y se toca cada semana. Plegado lo que se pone una vez.', html: B },
  { id: 'c', t: 'C · Índice de ticket', d: 'La hoja es una lista de líneas con su valor. Cada una abre la suya.', html: C },
  { id: 'd', t: 'D · Una abierta', d: 'Solo una pregunta desplegada; al elegir se cierra y se abre la siguiente.', html: D },
  { id: 'e', t: 'E · Manda el total', d: 'La cifra de la semana arriba, fija, y debajo lo que la mueve.', html: E },
];

const movil = (o) => `
<div class="movil" id="p-${o.id}">
  <div class="fondo">
    <div class="fondo__tabs"><span class="on">SEMANA</span><span>COMPRA</span></div>
    <div class="fondo__cifra">63,89 €</div>
  </div>
  <div class="velo"></div>
  <div class="hoja">${o.html}</div>
</div>`;

const html = `<title>Cunde · Cinco Ajustes</title>
<style>
  :root{--papel:#EFEDE6;--papel2:#E5E2D8;--crema:#F6F4EE;--tinta:#1A1917;
    --azulete:#2B4C7E;--az-f:rgba(43,76,126,.07);--oferta:#C9A800;--pauta:#A9A498;--gris:#6E6A5F;--linea:#D6D2C6;
    --borde:1.5px solid rgba(169,164,152,.7);
    --mono:ui-monospace,'SF Mono',Menlo,Consolas,monospace;
    --cuerpo:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;}
  @media (prefers-color-scheme:dark){:root{--papel:#161513;--papel2:#242219;--crema:#1E1D1A;--tinta:#EDEBE4;
    --azulete:#8FB3E0;--az-f:rgba(143,179,224,.12);--oferta:#E3C233;--pauta:#5C584F;--gris:#A8A39A;--linea:#302E29;
    --borde:1.5px solid rgba(92,88,79,.9);}}
  :root[data-theme='dark']{--papel:#161513;--papel2:#242219;--crema:#1E1D1A;--tinta:#EDEBE4;--azulete:#8FB3E0;
    --az-f:rgba(143,179,224,.12);--oferta:#E3C233;--pauta:#5C584F;--gris:#A8A39A;--linea:#302E29;
    --borde:1.5px solid rgba(92,88,79,.9);}
  :root[data-theme='light']{--papel:#EFEDE6;--papel2:#E5E2D8;--crema:#F6F4EE;--tinta:#1A1917;--azulete:#2B4C7E;
    --az-f:rgba(43,76,126,.07);--oferta:#C9A800;--pauta:#A9A498;--gris:#6E6A5F;--linea:#D6D2C6;
    --borde:1.5px solid rgba(169,164,152,.7);}
  *{box-sizing:border-box}
  body{margin:0;background:var(--papel);color:var(--tinta);font-family:var(--cuerpo);line-height:1.6;-webkit-font-smoothing:antialiased}
  .env{max-width:1360px;margin:0 auto;padding:42px 20px 100px}
  header{border-bottom:2px solid var(--tinta);padding-bottom:24px}
  .sello{font:500 12px/1 var(--mono);letter-spacing:.12em;color:var(--gris);text-transform:uppercase}
  h1{font:700 clamp(28px,5.5vw,44px)/1.02 var(--cuerpo);letter-spacing:-.035em;margin:10px 0 0;text-wrap:balance}
  .baja{font-size:17px;color:var(--gris);max-width:64ch;margin:14px 0 0}
  .rejilla{display:grid;grid-template-columns:repeat(auto-fit,minmax(404px,1fr));gap:30px;margin-top:36px;align-items:start}
  .caso h2{font:700 20px/1.15 var(--cuerpo);letter-spacing:-.02em;margin:0 0 4px}
  .caso>p{font-size:14.5px;color:var(--gris);margin:0 0 10px;max-width:46ch}
  .medida{display:block;font:500 12px/1.5 var(--mono);color:var(--azulete);margin-bottom:12px}

  .movil{position:relative;width:390px;height:844px;max-width:100%;border:1px solid var(--pauta);overflow:hidden;background:var(--papel)}
  .fondo{padding:22px 30px}
  .fondo__tabs{display:flex;gap:22px;font:600 13px/1 var(--cuerpo);letter-spacing:.18em;color:var(--gris);padding-bottom:12px;border-bottom:1px dashed var(--pauta)}
  .fondo__tabs .on{color:var(--tinta)}
  .fondo__cifra{margin-top:20px;font:700 56px/1 var(--cuerpo);letter-spacing:-.03em;font-variant-numeric:tabular-nums}
  .velo{position:absolute;inset:0;background:rgba(26,25,23,.45)}
  /* 92% de 844 y el padding real de BottomSheet */
  .hoja{position:absolute;left:0;right:0;bottom:0;max-height:776px;overflow-y:auto;background:var(--papel);
    border-radius:14px 14px 0 0;padding:26px 30px 34px}

  .aj__cab{display:flex;align-items:center;justify-content:space-between;gap:12px}
  .aj__tit{font:500 13px/1.3 var(--mono);color:var(--gris)}
  .aj__x{width:56px;height:56px;margin:-12px -12px -12px 0;background:none;border:0;color:var(--gris);
    font:400 17px/1 var(--mono);cursor:pointer}
  .aj__intro{margin:14px 0 0;font:400 13px/1.5 var(--mono);color:var(--gris)}
  .aj__preg{margin:24px 0 14px;font:600 22px/1.25 var(--cuerpo);letter-spacing:-.02em}
  .aj__cab + .aj__preg{margin-top:10px}
  .aj__fila{display:flex;flex-wrap:wrap;gap:8px}
  .aj__pill{display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-height:56px;padding:8px 16px;
    background:transparent;border:var(--borde);border-radius:4px;text-align:left;font-family:inherit;cursor:pointer}
  .aj__pill--ancho{width:100%;flex-direction:row;align-items:center;padding:0 16px}
  .aj__pill.on{background:var(--az-f);border-color:var(--azulete)}
  .aj__pill-l{font:500 17px/1 var(--cuerpo);color:var(--tinta)}
  .aj__pill.on .aj__pill-l{color:var(--azulete)}
  .aj__pill-m{font:400 13px/1 var(--mono);color:var(--gris)}
  .aj__bloques{display:flex;flex-direction:column;gap:8px}
  .aj__bloque{display:flex;flex-direction:column;align-items:flex-start;gap:5px;padding:16px;border:var(--borde);
    border-radius:4px;background:none;font-family:inherit;text-align:left;cursor:pointer}
  .aj__bloque.on{border-color:var(--azulete);background:var(--az-f)}
  .aj__bl{font:500 17px/1.1 var(--cuerpo)}
  .aj__bloque.on .aj__bl{color:var(--azulete)}
  .aj__bs{font:400 13px/1.2 var(--mono);color:var(--gris)}
  .aj__grupo{display:block;margin:16px 0 8px;font:600 15px/1.3 var(--cuerpo)}
  .aj__chips{margin-top:8px;display:flex;flex-wrap:wrap;gap:8px}
  .aj__chip{min-height:56px;padding:0 16px;border:var(--borde);border-radius:999px;background:none;
    font:500 15px/1 var(--cuerpo);color:var(--tinta);font-family:inherit;cursor:pointer}
  .aj__nota{margin:12px 0 0;font:400 13px/1.6 var(--mono);color:var(--gris)}
  .aj__guardar{width:100%;min-height:56px;margin-top:24px;border:0;border-radius:4px;background:var(--azulete);
    color:#fff;font:600 17px/1 var(--cuerpo);font-family:inherit;cursor:pointer}
  .sc{display:flex;gap:8px}
  .sc__op{flex:1 1 0;min-width:0;display:flex;flex-direction:column;gap:2px;min-height:56px;padding:9px 8px;
    border:var(--borde);border-radius:4px;background:none;font-family:inherit;text-align:left;cursor:pointer}
  .sc__op.on{border-color:var(--azulete);background:var(--az-f)}
  .sc__l{font:600 15px/1.1 var(--cuerpo)}
  .sc__n{font:400 13px/1.1 var(--mono);color:var(--gris)}
  .sc__p{margin-top:4px;font:500 17px/1.1 var(--mono);font-variant-numeric:tabular-nums}
  .sc__e{font:400 13px/1.1 var(--mono);color:var(--gris);font-variant-numeric:tabular-nums}

  /* piezas nuevas de las variantes */
  .aj__separador{margin:26px 0 6px;border-top:1px dashed var(--pauta)}
  .aj__plegado,.aj__linea{display:flex;align-items:baseline;gap:8px;width:100%;min-height:56px;padding:10px 0;
    background:none;border:0;border-bottom:1px solid var(--linea);text-align:left;font-family:inherit;cursor:pointer}
  .aj__plegado-t,.aj__linea-l{font:500 16px/1.3 var(--cuerpo);color:var(--tinta)}
  .aj__linea-g{flex:1;min-width:12px;border-bottom:1px dotted var(--pauta);transform:translateY(-4px)}
  .aj__plegado-v,.aj__linea-v{font:400 15px/1.3 var(--mono);color:var(--gris)}
  .aj__linea-p{margin-left:10px;font:500 15px/1.3 var(--mono);color:var(--tinta);font-variant-numeric:tabular-nums}
  .aj__linea-f{margin-left:10px;font-family:var(--mono);color:var(--azulete)}
  .aj__indice{margin-top:14px}
  .aj__cerradas{margin-top:24px}
  .aj__total{margin-top:16px;padding:14px 16px;background:var(--papel2);border-left:3px solid var(--azulete);border-radius:3px}
  .aj__total-et{display:block;font:500 12px/1 var(--mono);letter-spacing:.08em;color:var(--gris)}
  .aj__total-c{display:block;margin-top:6px;font:700 34px/1 var(--cuerpo);letter-spacing:-.02em;font-variant-numeric:tabular-nums}
  .aj__total-s{display:block;margin-top:4px;font:400 13px/1.4 var(--mono);color:var(--gris)}

  .ver{border-left:3px solid var(--azulete);padding:2px 0 2px 18px;margin:50px 0 0}
  .ver p{font-size:16px;margin:0 0 12px;max-width:66ch}
  .ver p:last-child{margin-bottom:0}
  .ver strong{font-weight:600}
  .tabla-env{overflow-x:auto;margin:26px 0;border:1px solid var(--linea)}
  table{border-collapse:collapse;width:100%;min-width:640px;background:var(--crema)}
  th,td{text-align:left;padding:11px 14px;border-bottom:1px solid var(--linea);font-size:14.5px;vertical-align:top}
  th{font:500 12px/1.3 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--gris);background:var(--papel2);white-space:nowrap}
  tbody tr:last-child td{border-bottom:0}
  td.v{font:500 13.5px/1.4 var(--mono);white-space:nowrap;font-variant-numeric:tabular-nums}
</style>
<div class="env">
<header>
  <span class="sello">390 × 844 · la hoja real: 776 px de alto máximo, padding 26/30/34</span>
  <h1>Cinco Ajustes</h1>
  <p class="baja">La hoja de hoy mide 1.188 px en 776 de hueco, y con el postre pasa de 1.380: casi dos pantallas de scroll para seis preguntas del mismo peso. Cada opción reparte eso de otra manera. Las hojas se desplazan por dentro.</p>
</header>

<div class="rejilla">
  ${OPCIONES.map((o) => `
  <div class="caso"><h2>${o.t}</h2><p>${o.d}</p>
    <span class="medida" id="m-${o.id}">midiendo…</span>
    ${movil(o)}</div>`).join('')}
</div>

<div class="ver">
  <p><strong>Lo que hay que mirar, y no es cuál es más bonita.</strong> Con la hoja abierta, ¿se ve el postre sin tocar nada? ¿Y la variedad, que es lo que más se cambia? Lo demás —comidas o cenas, cuánto cocinas, las alergias— se pone una vez en la vida, y hoy ocupa la mitad del alto.</p>
  <p><strong>La C y la D cambian el trato.</strong> Las dos convierten un cambio en dos toques: abrir la línea y elegir. A cambio la hoja cabe entera. Si la mayoría de las visitas son para tocar una sola cosa, salen ganando; si se entra a tocar tres, salen perdiendo.</p>
  <p><strong>La E es la única que enseña la consecuencia.</strong> Hoy eliges "mucha variedad" y no sabes qué le pasa a la semana hasta que guardas y se rehace. Con el total arriba, la decisión se toma con el resultado delante — que es lo que hace el deslizador del presupuesto, y es la mecánica de la app entera.</p>
</div>

<div class="tabla-env"><table>
  <thead><tr><th>Opción</th><th>Alto</th><th>Toques para cambiar la variedad</th><th>Qué arriesga</th></tr></thead>
  <tbody>
    <tr><td class="v">A · hoy</td><td class="v" id="t-a">—</td><td class="v">1 + scroll</td><td>Seis preguntas iguales, sin jerarquía. Lo que se toca cada semana está enterrado en medio.</td></tr>
    <tr><td class="v">B · frecuencia</td><td class="v" id="t-b">—</td><td class="v">1</td><td>Hay que acertar qué va arriba. Si alguien cambia mucho las restricciones, le hemos escondido lo suyo.</td></tr>
    <tr><td class="v">C · índice</td><td class="v" id="t-c">—</td><td class="v">2</td><td>Un toque más siempre, y una hoja dentro de otra hoja.</td></tr>
    <tr><td class="v">D · una abierta</td><td class="v" id="t-d">—</td><td class="v">1 la primera, 2 el resto</td><td>El acordeón mueve el contenido bajo el dedo; con reduced-motion hay que resolverlo sin animación.</td></tr>
    <tr><td class="v">E · total</td><td class="v" id="t-e">—</td><td class="v">1</td><td>La cifra hay que recalcularla en cada toque, y eso es una generación del motor. Hoy son 1,2 s.</td></tr>
  </tbody>
</table></div>

<script>
  requestAnimationFrame(() => requestAnimationFrame(() => {
    for (const id of ['a','b','c','d','e']) {
      const h = document.querySelector('#p-' + id + ' .hoja');
      const alto = Math.round(h.scrollHeight);
      const visto = Math.round(h.getBoundingClientRect().height);
      const postre = [...h.querySelectorAll('.aj__preg, .aj__linea-l, .aj__plegado-t')]
        .find((e) => /ostre/.test(e.textContent));
      const y = postre ? Math.round(postre.offsetTop) : null;
      document.getElementById('m-' + id).textContent =
        alto + ' px · ' + (alto / visto).toFixed(1) + ' pantallas'
        + (y === null ? '' : ' · el postre a ' + y + ' px' + (y + 120 <= visto ? ', se ve' : ', hay que bajar'));
      document.getElementById('t-' + id).textContent = alto + ' px';
    }
  }));
</script>
</div>
`;

fs.writeFileSync('docs/capturas/ajustes-cinco.html', html);
console.log(`${(fs.statSync('docs/capturas/ajustes-cinco.html').size / 1024).toFixed(0)} KB`);
