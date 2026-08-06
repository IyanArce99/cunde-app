import fs from 'node:fs';

const S = JSON.parse(fs.readFileSync('docs/capturas/_semana.json', 'utf8'));
/* El usuario va a fotografiar TODO el recetario, así que aquí se supone
   cobertura total. Nota: los doce ensamblajes son platos propios —"sopa con el
   pollo del ajillo" no es "jamoncitos al ajillo"— así que también necesitan la
   suya, o su hueco se queda sin imagen. */
for (const h of S.huecos) h.foto = h.nombre !== 'No cocinas' ? 'si' : null;
const FOTO = '';

const DIAS = [...new Set(S.huecos.map((h) => h.dia))];
const porDia = DIAS.map((d) => ({ dia: d, huecos: S.huecos.filter((h) => h.dia === d) }));
const eur = (n) => n.toFixed(2).replace('.', ',') + ' €';
const meta = (h) => (h.tipo === 'sobras' ? 'solo calentar' : h.min + ' min');
const SELLO = { cocinado: 'COCINAS', sobras: 'RECALIENTAS', ensamblaje: 'APROVECHAS' };
const ran = (h) => (h.ranura === 'comida' ? 'COMIDA' : 'CENA');
const maxPrecio = Math.max(...S.huecos.map((h) => h.precio));

/* ── F1 · Rollo de ticket continuo ─────────────────────────────────────────
   Sin tarjetas. La semana entera como un solo rollo: el día es un separador y
   cada hueco una línea de ticket con guía de puntos hasta el importe. Es el
   lenguaje de la app llevado hasta el final. */
const f1 = porDia.map((d) => `
  <div class="f1__dia"><span>${d.dia}</span><span class="f1__linea"></span>
    <span class="f1__tot">${eur(d.huecos.reduce((a, h) => a + h.precio, 0))}</span></div>
  ${d.huecos.map((h) => `
  <div class="f1__h f1__h--${h.tipo}">
    ${FOTO}
    <span class="f1__nom">${h.nombre}</span>
    <span class="f1__guia"></span>
    <span class="f1__pre">${eur(h.precio)}</span>
    <span class="f1__sub">${ran(h).toLowerCase()} · ${meta(h)}${h.tipo !== 'cocinado' ? ' · ' + SELLO[h.tipo].toLowerCase() : ''}</span>
  </div>`).join('')}`).join('');

/* ── F2 · Barra de color y sello por tipo ──────────────────────────────────
   El color es información: azulete cocinas, gris recalientas, amarillo
   aprovechas. Los tres que el usuario ya conoce de la barra de presupuesto. */
const f2 = porDia.map((d) => `
  <div class="f2"><span class="f2__dia">${d.dia}</span>
  ${d.huecos.map((h) => `
    <div class="f2__h f2__h--${h.tipo}"><span class="f2__barra"></span>${FOTO}
      <div class="f2__cuerpo">
        <div class="f2__cab"><span class="f2__ran">${ran(h)}</span>
          <span class="f2__sello f2__sello--${h.tipo}">${SELLO[h.tipo]}</span>
          <span class="f2__meta">${meta(h)}</span></div>
        <div class="f2__pl"><span class="f2__nom">${h.nombre}</span>
          <span class="f2__pre">${eur(h.precio)}</span></div>
      </div>
    </div>`).join('')}</div>`).join('');

/* ── F3 · Rejilla comida / cena ────────────────────────────────────────────
   Siete filas en vez de catorce. Es la maqueta clásica del planificador
   semanal: el día manda y las dos comidas se comparan de un vistazo. */
const f3 = `<div class="f3">
  <div class="f3__cab"><span></span><span>COMIDA</span><span>CENA</span></div>
  ${porDia.map((d) => `
  <div class="f3__fila"><span class="f3__dia">${d.dia}</span>
    ${['comida', 'cena'].map((r) => {
      const h = d.huecos.find((x) => x.ranura === r);
      if (!h) return '<span class="f3__c f3__c--vacio">—</span>';
      return `<span class="f3__c f3__c--${h.tipo}">
        ${FOTO}
        <span class="f3__nom">${h.nombre}</span>
        <span class="f3__sub">${meta(h)} · ${eur(h.precio)}</span></span>`;
    }).join('')}
  </div>`).join('')}</div>`;

/* ── F4 · El día con peso tipográfico ──────────────────────────────────────
   El día deja de ser una etiqueta de 13 px y pasa a ser el elemento que marca
   el ritmo. Rompe la uniformidad de siete cajas iguales sin añadir color. */
const f4 = porDia.map((d) => `
  <div class="f4">
    <div class="f4__cab"><span class="f4__dia">${d.dia}</span>
      <span class="f4__tot">${eur(d.huecos.reduce((a, h) => a + h.precio, 0))}</span></div>
    ${d.huecos.map((h) => `
    <div class="f4__h">
      <span class="f4__ran">${ran(h).charAt(0)}</span>
      ${FOTO}
      <div class="f4__cuerpo">
        <span class="f4__nom${h.tipo !== 'cocinado' ? ' f4__nom--apagado' : ''}">${h.nombre}</span>
        <span class="f4__sub">${meta(h)}${h.tipo !== 'cocinado' ? ' · ' + SELLO[h.tipo].toLowerCase() : ''} · ${eur(h.precio)}</span>
      </div>
    </div>`).join('')}
  </div>`).join('');

/* ── F5 · Barra de coste por hueco ─────────────────────────────────────────
   El precio deja de leerse y pasa a verse: cada hueco lleva una barra
   proporcional a lo que cuesta. La app tiene ese dato y nunca lo enseña
   gráficamente, y es una app de dinero. */
const f5 = porDia.map((d) => `
  <div class="f5"><span class="f5__dia">${d.dia}</span>
  ${d.huecos.map((h) => `
    <div class="f5__h">
      ${FOTO}
      <div class="f5__linea"><span class="f5__nom">${h.nombre}</span>
        <span class="f5__pre">${eur(h.precio)}</span></div>
      <div class="f5__pista"><span class="f5__barra f5__barra--${h.tipo}"
        style="width:${Math.max(2, (h.precio / maxPrecio) * 100)}%"></span></div>
      <span class="f5__sub">${ran(h).toLowerCase()} · ${meta(h)}${h.tipo !== 'cocinado' ? ' · ' + SELLO[h.tipo].toLowerCase() : ''}</span>
    </div>`).join('')}</div>`).join('');

const FORMATOS = [
  ['F1', 'Rollo de ticket continuo', 'Sin cajas. El día es un separador y cada comida una línea con guía de puntos, como en la lista de la compra. Es el lenguaje de la app llevado al final.', f1],
  ['F2', 'Barra de color y sello', 'El color codifica el tipo de hueco: azulete cocinas, gris recalientas, amarillo aprovechas. Reutiliza los tres colores que ya significan algo en la app.', f2],
  ['F3', 'Rejilla comida / cena', 'Siete filas en vez de catorce. La maqueta clásica del planificador: el día manda y las dos comidas se comparan de un vistazo.', f3],
  ['F4', 'El día con peso', 'El día pasa de etiqueta de 13 px a elemento que marca el ritmo. Rompe la uniformidad de siete cajas iguales sin meter ni un color nuevo.', f4],
  ['F5', 'Barra de coste', 'El precio deja de leerse y pasa a verse: cada comida lleva una barra proporcional a lo que cuesta. Es una app de dinero y ese dato nunca se enseña gráficamente.', f5],
];

const html = `<title>Cunde · cinco formatos de semana</title>
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
  .env{max-width:1400px;margin:0 auto;padding:36px 20px 80px}
  header{border-bottom:1.5px solid var(--tinta);padding-bottom:16px;margin-bottom:8px}
  h1{font:700 clamp(26px,5vw,40px)/1 var(--cuerpo);letter-spacing:-.03em;margin:8px 0 0}
  .sello{font:500 12px/1 var(--mono);color:var(--gris)}
  .baja{font:400 15px/1.6 var(--cuerpo);color:var(--gris);max-width:64ch;margin:12px 0 0}
  .rejilla{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:28px;margin-top:32px;align-items:start}
  .caso{min-width:0}
  .caso h2{font:700 20px/1.2 var(--cuerpo);letter-spacing:-.02em;margin:0 0 4px}
  .caso h2 span{font:500 12px/1 var(--mono);color:var(--gris);margin-right:8px}
  .caso p{font:400 14px/1.55 var(--cuerpo);color:var(--gris);margin:0 0 14px;max-width:44ch}
  .movil{width:340px;max-width:100%;background:var(--papel);border:1px solid var(--pauta);padding:14px 14px 18px}

  .foto{flex:none;border-radius:3px;background:var(--papel2) center/cover no-repeat;
    background-image:var(--foto)}

  /* F1 */
  .f1__dia{display:flex;align-items:baseline;gap:8px;margin:14px 0 6px;font:500 13px/1 var(--mono);color:var(--gris)}
  .f1__dia:first-child{margin-top:0}
  .f1__linea{flex:1;border-bottom:1px dashed var(--pauta);transform:translateY(-4px)}
  .f1__tot{font-variant-numeric:tabular-nums}
  .f1__h{display:grid;grid-template-columns:44px 1fr auto auto;gap:8px;align-items:baseline;padding:6px 0}
  .f1__h .foto{width:44px;height:44px;grid-row:span 2;align-self:start}
  .f1__nom{font:600 16px/1.25 var(--cuerpo);min-width:0}
  .f1__h--sobras .f1__nom{font-weight:400;color:var(--gris)}
  .f1__guia{border-bottom:1px dotted var(--pauta);transform:translateY(-5px);min-width:12px}
  .f1__pre{font:400 15px/1.2 var(--mono);white-space:nowrap;font-variant-numeric:tabular-nums}
  .f1__sub{grid-column:2/-1;font:400 12px/1.4 var(--mono);color:var(--gris)}

  /* F2 */
  .f2{margin-bottom:14px}
  .f2__dia{display:block;font:500 13px/1 var(--mono);color:var(--gris);margin-bottom:6px}
  .f2__h{display:flex;background:var(--crema);border-radius:4px;padding:10px 12px 11px;margin-bottom:6px;position:relative;overflow:hidden}
  .f2__barra{position:absolute;left:0;top:0;bottom:0;width:4px}
  .f2__h--cocinado .f2__barra{background:var(--azulete)}
  .f2__h--sobras .f2__barra{background:var(--pauta)}
  .f2__h--ensamblaje .f2__barra{background:var(--oferta-b)}
  .f2__h--sobras{background:var(--papel2)}
  .f2__h .foto{width:50px;height:50px;margin-left:6px}
  .f2__cuerpo{flex:1;min-width:0;padding-left:8px}
  .f2__cab{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
  .f2__ran,.f2__meta{font:500 12px/1 var(--mono);color:var(--gris)}
  .f2__meta{margin-left:auto}
  .f2__sello{font:600 10px/1 var(--cuerpo);letter-spacing:.06em;padding:3px 6px;border-radius:3px}
  .f2__sello--cocinado{background:rgba(43,76,126,.12);color:var(--azulete)}
  .f2__sello--sobras{background:transparent;color:var(--gris);border:1px solid var(--pauta)}
  .f2__sello--ensamblaje{background:var(--oferta-f);color:var(--oferta-b)}
  .f2__pl{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:baseline;margin-top:5px}
  .f2__nom{font:600 17px/1.2 var(--cuerpo);min-width:0}
  .f2__pre{font:400 15px/1.2 var(--mono);white-space:nowrap}

  /* F3 */
  .f3__cab{display:grid;grid-template-columns:38px 1fr 1fr;gap:8px;padding-bottom:6px;border-bottom:1px solid var(--tinta)}
  .f3__cab span{font:500 11px/1 var(--mono);color:var(--gris);letter-spacing:.04em}
  .f3__fila{display:grid;grid-template-columns:38px 1fr 1fr;gap:8px;padding:9px 0;border-bottom:1px dashed var(--pauta);align-items:start}
  .f3__dia{font:500 13px/1.3 var(--mono);color:var(--gris)}
  .f3__c{display:block;min-width:0;padding-left:7px;border-left:3px solid var(--azulete)}
  .f3__c .foto{width:100%;aspect-ratio:1;height:auto;margin-bottom:5px;display:block}
  .f3__c--sobras{border-left-color:var(--pauta)}
  .f3__c--ensamblaje{border-left-color:var(--oferta-b)}
  .f3__c--vacio{border-left-color:transparent;color:var(--pauta)}
  .f3__nom{display:block;font:600 14px/1.25 var(--cuerpo)}
  .f3__c--sobras .f3__nom{font-weight:400;color:var(--gris)}
  .f3__sub{display:block;font:400 11px/1.4 var(--mono);color:var(--gris);margin-top:2px}

  /* F4 */
  .f4{margin-bottom:18px}
  .f4__cab{display:flex;align-items:baseline;justify-content:space-between;gap:8px;
    padding-bottom:4px;border-bottom:1.5px solid var(--tinta)}
  .f4__dia{font:700 26px/1 var(--cuerpo);letter-spacing:-.02em}
  .f4__tot{font:400 13px/1 var(--mono);color:var(--gris);font-variant-numeric:tabular-nums}
  .f4__h{display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-bottom:1px dotted var(--pauta)}
  .f4__ran{font:500 12px/1.4 var(--mono);color:var(--gris);width:14px;flex:none}
  .f4__h .foto{width:52px;height:52px}
  .f4__cuerpo{min-width:0;flex:1}
  .f4__nom{display:block;font:600 17px/1.2 var(--cuerpo)}
  .f4__nom--apagado{font-weight:400;color:var(--gris)}
  .f4__sub{display:block;font:400 12px/1.4 var(--mono);color:var(--gris);margin-top:2px}

  /* F5 */
  .f5{margin-bottom:16px}
  .f5__dia{display:block;font:500 13px/1 var(--mono);color:var(--gris);margin-bottom:8px}
  .f5__h{margin-bottom:12px;display:grid;grid-template-columns:56px 1fr;gap:10px;align-items:start}
  .f5__h .foto{width:56px;height:56px;grid-row:span 3}
  .f5__linea{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
  .f5__nom{font:600 16px/1.2 var(--cuerpo);min-width:0}
  .f5__pre{font:400 14px/1.2 var(--mono);white-space:nowrap;font-variant-numeric:tabular-nums}
  .f5__pista{height:5px;background:var(--papel2);margin:5px 0 3px;border-radius:2px;overflow:hidden}
  .f5__barra{display:block;height:100%}
  .f5__barra--cocinado{background:var(--azulete)}
  .f5__barra--sobras{background:var(--pauta)}
  .f5__barra--ensamblaje{background:var(--oferta-b)}
  .f5__sub{font:400 12px/1.4 var(--mono);color:var(--gris)}
</style>
<div class="env">
<header>
  <span class="sello">340 px DE ANCHO · LOS SIETE DÍAS · LA MISMA SEMANA REAL, 63,89 € PARA DOS</span>
  <h1>Cinco formatos de semana</h1>
  <p class="baja">Cinco ideas distintas, no cinco versiones de una. Todas con los mismos datos y los mismos tokens, y todas tienen que resolver lo mismo: que se vea sin leer la diferencia entre cocinar, recalentar y aprovechar, y que el coste por ración no se pierda. Están completas con los siete días para que juzgues también el scroll. <strong>Todas van con foto en todos los huecos</strong>, que es el estado al que vas: es la misma imagen repetida porque solo hay una receta fotografiada de 112, así que juzga la maqueta, no la variedad.</p>
</header>
<div class="rejilla">
  ${FORMATOS.map(([id, titulo, nota, cuerpo]) => `
  <div class="caso">
    <h2><span>${id}</span>${titulo}</h2>
    <p>${nota}</p>
    <div class="movil">${cuerpo}</div>
  </div>`).join('')}
</div>
</div>
`;

fs.writeFileSync('docs/capturas/_cinco-sinfoto.html', html);
console.log(`${(fs.statSync('docs/capturas/_cinco-sinfoto.html').size / 1024).toFixed(0)} KB`);
