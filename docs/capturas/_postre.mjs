import fs from 'node:fs';

/* Precios reales de Mercadona mad3, 28 jul. 2 personas.
   No: 0 · Entre semana: 5 días = 10 postres · Todos los días: 7 días = 14. */
const NIVELES = [
  { v: 'no', label: 'No', nota: 'sin postre', precio: 0, extra: 'lo más barato' },
  { v: 'semana', label: 'Entre semana', nota: '5 días', precio: 2.84, extra: '+2,84 €' },
  { v: 'todos', label: 'Todos los días', nota: '7 días', precio: 4.69, extra: '+4,69 €' },
];
const eur = (n) => n.toFixed(2).replace('.', ',') + ' €';

/* La hoja real: mismas preguntas, mismo orden, mismos componentes. */
const pill = (label, meta, sel) =>
  `<button class="aj__pill${sel ? ' aj__pill--sel' : ''}"><span class="aj__pill-label">${label}</span>${meta ? `<span class="aj__pill-meta">${meta}</span>` : ''}</button>`;
const bloque = (label, sub, sel) =>
  `<button class="aj__bloque${sel ? ' aj__bloque--sel' : ''}"><span class="aj__bloque-label">${label}</span><span class="aj__bloque-sub">${sub}</span></button>`;
const selcoste = (ops, elegido) => `<div class="sc">${ops.map((o) => `
  <button class="sc__op${elegido === o.v ? ' sc__op--sel' : ''}">
    <span class="sc__label">${o.label}</span><span class="sc__nota">${o.nota}</span>
    <span class="sc__principal">${o.precio === 0 ? '0,00 €' : eur(o.precio)}</span>
    <span class="sc__extra">${o.extra}</span>
  </button>`).join('')}</div>`;

const VARIEDAD = [
  { v: 'poca', label: 'Poca', nota: 'repites bastante', precio: 57.4, extra: 'lo más barato' },
  { v: 'normal', label: 'Normal', nota: 'repites algo', precio: 63.89, extra: '+6,49 €' },
  { v: 'mucha', label: 'Mucha', nota: 'casi sin repetir', precio: 71.2, extra: '+13,80 €' },
];
const PROTEINA = [
  { v: 'baja', label: 'Justa', nota: '45 g al día', precio: 58.1, extra: 'lo más barato' },
  { v: 'normal', label: 'Normal', nota: '58 g al día', precio: 63.89, extra: '+5,79 €' },
  { v: 'alta', label: 'Alta', nota: '75 g al día', precio: 74.5, extra: '+10,61 €' },
];

/** postre: 'no' (no está) · 'abajo' (6ª pregunta) · 'arriba' (2ª pregunta). */
const preguntaPostre = (puesto) => `
  <h2 class="aj__preg">¿Pones postre?</h2>
  ${selcoste(NIVELES, puesto ? 'todos' : 'no')}
  ${puesto ? `<p class="aj__nota aj__nota--coste">Sale de los 65 €, no se suma encima: el menú se rehace con 4,69 € menos. Fruta y yogur, variados solos.</p>`
    : `<p class="aj__nota">Fruta y yogur, variados solos. Sale de los 65 €, no se suma encima.</p>`}`;

const hoja = (postre, puesto) => `
<div class="hoja">
  <h2 class="aj__preg">¿Qué resuelvo?</h2>
  <div class="aj__fila">${pill('Comidas', '7 platos')}${pill('Cenas', '7 platos')}${pill('Las dos', '14 platos', true)}</div>
${postre === 'arriba' ? preguntaPostre(puesto) : ''}
  <h2 class="aj__preg">¿Cuánto quieres cocinar?</h2>
  <div class="aj__bloques">${bloque('Lo mínimo', 'menos de 20 min')}${bloque('Lo normal', '30 a 40 min', true)}${bloque('Me gusta cocinar', 'sin límite')}</div>

  <h2 class="aj__preg">¿Cuánta variedad quieres?</h2>
  ${selcoste(VARIEDAD, 'normal')}

  <h2 class="aj__preg">¿Cuánta proteína?</h2>
  ${selcoste(PROTEINA, 'normal')}
${postre === 'abajo' ? preguntaPostre(puesto) : ''}
  <h2 class="aj__preg">¿Algo que no comes?</h2>
  <button class="aj__pill aj__pill--ancho aj__pill--sel"><span class="aj__pill-label">Nada, como de todo</span></button>
  <span class="aj__grupo">Alergias e intolerancias</span>
  <div class="aj__chips">${['gluten', 'lactosa', 'frutos secos', 'marisco', 'huevo'].map((c) => `<button class="aj__chip">${c}</button>`).join('')}</div>
  <span class="aj__grupo">Por dieta</span>
  <div class="aj__chips">${['vegetariano', 'vegano', 'sin cerdo', 'sin pescado'].map((c) => `<button class="aj__chip">${c}</button>`).join('')}</div>

  <button class="aj__guardar">Guardar ajustes</button>
</div>`;

const movil = (id, postre, puesto) => `
<div class="movil" id="${id}">
  <div class="fondo">
    <div class="fondo__tabs"><span class="on">SEMANA</span><span>COMPRA</span></div>
    <div class="fondo__cifra">${puesto ? '59,45 €' : '63,89 €'}</div>
    <div class="fondo__ctx">${puesto ? '+ 4,69 € de postre · 64,14 € por caja' : '65,00 € de presupuesto · 14 comidas'}</div>
  </div>
  <div class="velo"></div>
  ${hoja(postre, puesto)}
</div>`;

const html = `<title>Cunde · ¿Pones postre?</title>
<style>
  :root{
    --papel:#EFEDE6;--papel2:#E5E2D8;--crema:#F6F4EE;--tinta:#1A1917;
    --azulete:#2B4C7E;--azulete-fondo:rgba(43,76,126,.07);--oferta-borde:#C9A800;
    --pauta:#A9A498;--gris:#6E6A5F;--linea:#D6D2C6;
    --borde-rest:1.5px solid rgba(169,164,152,.7);--borde-sel:1.5px solid var(--azulete);
    --mono:ui-monospace,'SF Mono',Menlo,Consolas,monospace;
    --cuerpo:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
  }
  @media (prefers-color-scheme:dark){:root{--papel:#161513;--papel2:#242219;--crema:#1E1D1A;
    --tinta:#EDEBE4;--azulete:#8FB3E0;--azulete-fondo:rgba(143,179,224,.12);--oferta-borde:#E3C233;
    --pauta:#5C584F;--gris:#A8A39A;--linea:#302E29;
    --borde-rest:1.5px solid rgba(92,88,79,.9);--borde-sel:1.5px solid var(--azulete);}}
  :root[data-theme='dark']{--papel:#161513;--papel2:#242219;--crema:#1E1D1A;--tinta:#EDEBE4;
    --azulete:#8FB3E0;--azulete-fondo:rgba(143,179,224,.12);--oferta-borde:#E3C233;
    --pauta:#5C584F;--gris:#A8A39A;--linea:#302E29;--borde-rest:1.5px solid rgba(92,88,79,.9);}
  :root[data-theme='light']{--papel:#EFEDE6;--papel2:#E5E2D8;--crema:#F6F4EE;--tinta:#1A1917;
    --azulete:#2B4C7E;--azulete-fondo:rgba(43,76,126,.07);--oferta-borde:#C9A800;
    --pauta:#A9A498;--gris:#6E6A5F;--linea:#D6D2C6;--borde-rest:1.5px solid rgba(169,164,152,.7);}

  *{box-sizing:border-box}
  body{margin:0;background:var(--papel);color:var(--tinta);font-family:var(--cuerpo);
    line-height:1.6;-webkit-font-smoothing:antialiased}
  .env{max-width:1360px;margin:0 auto;padding:40px 20px 90px}
  header{border-bottom:2px solid var(--tinta);padding-bottom:22px}
  .sello{font:500 12px/1 var(--mono);letter-spacing:.12em;color:var(--gris);text-transform:uppercase}
  h1{font:700 clamp(28px,5.5vw,42px)/1.03 var(--cuerpo);letter-spacing:-.035em;margin:10px 0 0;text-wrap:balance}
  .baja{font-size:17px;color:var(--gris);max-width:62ch;margin:14px 0 0}

  .rejilla{display:grid;grid-template-columns:repeat(auto-fit,minmax(404px,1fr));gap:30px;margin-top:34px;align-items:start}
  .caso h2{font:700 19px/1.2 var(--cuerpo);letter-spacing:-.02em;margin:0 0 4px}
  .caso>p{font-size:14.5px;color:var(--gris);margin:0 0 10px;max-width:46ch}
  .medida{display:block;font:500 12px/1.5 var(--mono);color:var(--azulete);margin-bottom:12px}

  /* ── móvil 390×844, hoja sobre la pantalla Semana ── */
  .movil{position:relative;width:390px;height:844px;max-width:100%;border:1px solid var(--pauta);
    overflow:hidden;background:var(--papel)}
  .fondo{padding:22px 30px}
  .fondo__tabs{display:flex;gap:22px;font:600 13px/1 var(--cuerpo);letter-spacing:.18em;color:var(--gris);
    padding-bottom:12px;border-bottom:1px dashed var(--pauta)}
  .fondo__tabs .on{color:var(--tinta)}
  .fondo__cifra{margin-top:20px;font:700 56px/1 var(--cuerpo);letter-spacing:-.03em;font-variant-numeric:tabular-nums}
  .fondo__ctx{margin-top:8px;font:400 13px/1.5 var(--mono);color:var(--gris)}
  .velo{position:absolute;inset:0;background:rgba(26,25,23,.45)}

  .hoja{position:absolute;left:0;right:0;bottom:0;max-height:776px;overflow-y:auto;
    background:var(--papel);border-radius:14px 14px 0 0;padding:26px 30px 34px;
    box-shadow:0 -1px 0 var(--linea)}
  .aj__preg{margin:24px 0 14px;font:600 22px/1.25 var(--cuerpo);letter-spacing:-.02em}
  .aj__preg:first-child{margin-top:4px}
  .aj__fila{display:flex;flex-wrap:wrap;gap:8px}
  .aj__pill{display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-height:56px;
    padding:8px 16px;background:transparent;border:var(--borde-rest);border-radius:4px;text-align:left;
    font-family:inherit;cursor:pointer}
  .aj__pill--ancho{width:100%;flex-direction:row;align-items:center;padding:0 16px}
  .aj__pill--sel{background:var(--azulete-fondo);border-color:var(--azulete)}
  .aj__pill-label{font:500 17px/1 var(--cuerpo);color:var(--tinta)}
  .aj__pill--sel .aj__pill-label{color:var(--azulete)}
  .aj__pill-meta{font:400 13px/1 var(--mono);color:var(--gris)}
  .aj__bloques{display:flex;flex-direction:column;gap:8px}
  .aj__bloque{display:flex;flex-direction:column;align-items:flex-start;gap:5px;width:100%;padding:16px;
    background:transparent;border:var(--borde-rest);border-radius:4px;text-align:left;font-family:inherit;cursor:pointer}
  .aj__bloque--sel{background:var(--azulete-fondo);border-color:var(--azulete)}
  .aj__bloque-label{font:500 17px/1.1 var(--cuerpo);color:var(--tinta)}
  .aj__bloque--sel .aj__bloque-label{color:var(--azulete)}
  .aj__bloque-sub{font:400 13px/1.2 var(--mono);color:var(--gris)}
  .aj__grupo{display:block;margin:16px 0 8px;font:600 15px/1.3 var(--cuerpo);color:var(--tinta)}
  .aj__chips{margin-top:8px;display:flex;flex-wrap:wrap;gap:8px}
  .aj__chip{display:inline-flex;align-items:center;min-height:56px;padding:0 16px;background:transparent;
    border:var(--borde-rest);border-radius:999px;color:var(--tinta);font:500 15px/1 var(--cuerpo);
    font-family:inherit;cursor:pointer}
  .aj__nota{margin:12px 0 0;font:400 13px/1.6 var(--mono);color:var(--gris)}
  .aj__nota--coste{color:var(--tinta);font-variant-numeric:tabular-nums}
  .aj__guardar{width:100%;min-height:56px;margin-top:24px;border:0;border-radius:4px;
    background:var(--azulete);color:#fff;font:600 17px/1 var(--cuerpo);font-family:inherit;cursor:pointer}

  /* selector de coste: el mismo de variedad y proteína */
  .sc{display:flex;gap:8px}
  .sc__op{flex:1 1 0;min-width:0;display:flex;flex-direction:column;gap:2px;min-height:56px;
    padding:9px 8px;background:none;border:var(--borde-rest);border-radius:4px;text-align:left;
    font-family:inherit;cursor:pointer}
  .sc__op--sel{border:var(--borde-sel);background:var(--azulete-fondo)}
  .sc__label{font:600 15px/1.1 var(--cuerpo);color:var(--tinta)}
  .sc__nota{font:400 13px/1.1 var(--mono);color:var(--gris)}
  .sc__principal{margin-top:4px;font:500 17px/1.1 var(--mono);color:var(--tinta);font-variant-numeric:tabular-nums}
  .sc__extra{font:400 13px/1.1 var(--mono);color:var(--gris);font-variant-numeric:tabular-nums}

  .ver{border-left:3px solid var(--azulete);padding:2px 0 2px 18px;margin:40px 0 0}
  .ver p{font-size:16px;margin:0 0 12px;max-width:66ch}
  .ver p:last-child{margin-bottom:0}
  .ver strong{font-weight:600}
  code{font:500 13.5px/1 var(--mono);background:var(--papel2);padding:2px 5px;border-radius:3px}
</style>
<div class="env">
<header>
  <span class="sello">390 × 844 · la hoja de Ajustes real, con los mismos componentes</span>
  <h1>¿Pones postre?</h1>
  <p class="baja">Con el mismo <code>SelectorCoste</code> que ya usan variedad y proteína — el componente que existe justamente para decidir con el precio delante. Lo monté primero como sexta pregunta y al medirlo se cayó el argumento: quedaba bajo el pliegue. Aquí están las dos posiciones. Las hojas tienen scroll propio: baja dentro de ellas.</p>
</header>

<div class="rejilla">
  <div class="caso"><h2>Ajustes hoy</h2>
    <p>Cinco preguntas. La referencia para ver qué cuesta añadir la sexta.</p>
    <span class="medida" id="m1">midiendo…</span>
    ${movil('p1', 'no', false)}</div>

  <div class="caso"><h2>Como sexta pregunta</h2>
    <p>Donde lo puse primero: detrás de proteína. Hay que hacer scroll para verlo.</p>
    <span class="medida" id="m2">midiendo…</span>
    ${movil('p2', 'abajo', false)}</div>

  <div class="caso"><h2>Como segunda · apagado</h2>
    <p>Pegado a «¿Qué resuelvo?», que es la misma pregunta: qué te pone la app.</p>
    <span class="medida" id="m3">midiendo…</span>
    ${movil('p3', 'arriba', false)}</div>

  <div class="caso"><h2>Como segunda · puesto</h2>
    <p>La cifra de detrás baja a 59,45 € de menú y la línea dice qué pasa por caja.</p>
    <span class="medida" id="m4">midiendo…</span>
    ${movil('p4', 'arriba', true)}</div>
</div>

<div class="ver">
  <p><strong>La medición cambió la propuesta.</strong> Como sexta pregunta el postre cae a 661 px dentro de una hoja de 1.368: bajo el pliegue, con lo cual «visible y con su precio» era mentira y por defecto apagado equivalía a no existir. Subido al segundo puesto se ve sin tocar nada. Y encaja mejor por contenido: «¿Qué resuelvo?» ya responde qué te pone la app —comidas, cenas o las dos— y el postre es esa misma pregunta.</p>
  <p><strong>Por qué este componente y no un interruptor.</strong> Un <em>sí/no</em> no puede decir cuánto cuesta, y aquí el precio es toda la decisión. <code>SelectorCoste</code> ya resuelve eso para variedad y proteína: etiqueta, una nota sin adjetivos, el importe y la diferencia con la más barata. El postre encaja sin inventar nada.</p>
  <p><strong>El nivel lo pone el usuario; los productos, el motor.</strong> Igual que no eliges las recetas, no eliges si hoy toca plátano o yogur: dices cuántos días quieres postre y el motor varía la fruta y calcula el envase — el pack de seis yogures sale a 0,17 la unidad y la fruta se vende por pieza, así que <strong>no sobra nada</strong>. Es la única categoría del catálogo donde lo que se come y lo que pasa por caja coinciden exactos.</p>
  <p><strong>Y sale de dentro, nunca de encima.</strong> Con postre puesto el menú se rehace con 4,69 € menos: 59,45 € de comida más 4,69 € de postre, 64,14 € por caja, dentro de los 65 €. Lo medí con el motor: siguen saliendo 9 platos distintos y la proteína sube de 58 a 60 g al día. Poner postre no le quita nada al menú.</p>
</div>

<script>
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const base = document.querySelector('#p1 .hoja').scrollHeight;
    for (const [id, salida] of [['p1','m1'],['p2','m2'],['p3','m3'],['p4','m4']]) {
      const h = document.querySelector('#' + id + ' .hoja');
      const alto = Math.round(h.scrollHeight);
      const visto = Math.round(h.getBoundingClientRect().height);
      const d = alto - Math.round(base);
      const preg = [...h.querySelectorAll('.aj__preg')].find((e) => e.textContent.includes('postre'));
      // El pliegue no lo marca el titular: lo marca el ÚLTIMO pixel del control.
      const fin = preg ? preg.nextElementSibling.nextElementSibling : null;
      const abajo = fin ? Math.round(fin.offsetTop + fin.offsetHeight) : 0;
      const donde = preg
        ? ' · postre de ' + Math.round(preg.offsetTop) + ' a ' + abajo + ' px' +
          (abajo <= visto ? ' · entero sin scroll' : ' · CORTADO por el pliegue')
        : '';
      document.getElementById(salida).textContent =
        'hoja de ' + alto + ' px' + (d ? ' (+' + d + ')' : ' · referencia') + donde;
    }
  }));
</script>
</div>
`;

fs.writeFileSync('docs/capturas/postre.html', html);
console.log(`${(fs.statSync('docs/capturas/postre.html').size / 1024).toFixed(0)} KB`);
