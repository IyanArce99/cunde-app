import fs from 'node:fs';

const S = JSON.parse(fs.readFileSync('docs/capturas/_semana.json', 'utf8'));
const DIAS = [...new Set(S.huecos.map((h) => h.dia))];
const porDia = DIAS.map((d) => ({ dia: d, huecos: S.huecos.filter((h) => h.dia === d) }));
const eur = (n) => n.toFixed(2).replace('.', ',') + ' €';
const meta = (h) => (h.tipo === 'sobras' ? 'solo calentar' : h.min + ' min');
const SELLO = { cocinado: 'cocinas', sobras: 'recalientas', ensamblaje: 'aprovechas' };
const ran = (h) => (h.ranura === 'comida' ? 'comida' : 'cena');
const maxP = Math.max(...S.huecos.map((h) => h.precio));

/* F6 · La línea de ticket de F1, con la barra de coste de F5 metida dentro y
   una señal de tipo en el borde de la miniatura.
   - la estructura es F1: guía de puntos del nombre al importe, total por día;
   - la barra es F5: el dinero se ve en vez de leerse, y sobre todo se ve el
     cero de los días que no cuestan nada;
   - el borde de color resuelve el fallo de F1: ahí el tipo de hueco caía a un
     subtítulo gris de 12 px, o sea que lo que diferencia al producto era lo
     menos visible de la fila. El borde no cuesta ni un píxel de alto. */
const f6 = (conFoto) => porDia.map((d) => `
  <div class="k__dia"><span>${d.dia}</span><span class="k__linea"></span>
    <span class="k__tot">${eur(d.huecos.reduce((a, h) => a + h.precio, 0))}</span></div>
  ${d.huecos.map((h) => `
  <div class="k__h k__h--${h.tipo}${conFoto ? '' : ' k__h--sinfoto'}">
    ${conFoto ? '<span class="k__foto"></span>' : ''}
    <span class="k__nom">${h.nombre}</span>
    <span class="k__guia"></span>
    <span class="k__pre">${eur(h.precio)}</span>
    <span class="k__pista"><span class="k__barra" style="width:${Math.max(1.5, (h.precio / maxP) * 100)}%"></span></span>
    <span class="k__sub">${ran(h)} · ${meta(h)} · ${SELLO[h.tipo]}</span>
  </div>`).join('')}`).join('');

/* F1 y F5 tal cual, para comparar al lado. */
const f1 = porDia.map((d) => `
  <div class="k__dia"><span>${d.dia}</span><span class="k__linea"></span>
    <span class="k__tot">${eur(d.huecos.reduce((a, h) => a + h.precio, 0))}</span></div>
  ${d.huecos.map((h) => `
  <div class="k__h k__h--llano">
    <span class="k__foto k__foto--llano"></span>
    <span class="k__nom">${h.nombre}</span>
    <span class="k__guia"></span>
    <span class="k__pre">${eur(h.precio)}</span>
    <span class="k__sub">${ran(h)} · ${meta(h)}${h.tipo !== 'cocinado' ? ' · ' + SELLO[h.tipo] : ''}</span>
  </div>`).join('')}`).join('');

const f5 = porDia.map((d) => `
  <div class="c5"><span class="c5__dia">${d.dia}</span>
  ${d.huecos.map((h) => `
    <div class="c5__h"><span class="k__foto k__foto--llano c5__foto"></span>
      <div class="c5__linea"><span class="c5__nom">${h.nombre}</span><span class="c5__pre">${eur(h.precio)}</span></div>
      <span class="k__pista"><span class="k__barra k__barra--${h.tipo}" style="width:${Math.max(1.5, (h.precio / maxP) * 100)}%"></span></span>
      <span class="c5__sub">${ran(h)} · ${meta(h)} · ${SELLO[h.tipo]}</span>
    </div>`).join('')}</div>`).join('');

const html = `<title>Cunde · F6, la mezcla</title>
<style>
  :root{--papel:#EFEDE6;--crema:#F6F4EE;--papel2:#E5E2D8;--tinta:#1A1917;--azulete:#2B4C7E;
    --oferta-b:#C9A800;--gris:#6E6A5F;--pauta:#A9A498;
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
  header{border-bottom:1.5px solid var(--tinta);padding-bottom:16px}
  h1{font:700 clamp(26px,5vw,40px)/1 var(--cuerpo);letter-spacing:-.03em;margin:8px 0 0}
  .sello{font:500 12px/1 var(--mono);color:var(--gris)}
  .baja{font:400 15px/1.6 var(--cuerpo);color:var(--gris);max-width:66ch;margin:12px 0 0}
  .rejilla{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:28px;margin-top:34px;align-items:start}
  .caso{min-width:0}
  .caso h2{font:700 20px/1.2 var(--cuerpo);letter-spacing:-.02em;margin:0 0 4px}
  .caso h2 span{font:500 12px/1 var(--mono);color:var(--gris);margin-right:8px}
  .caso p{font:400 14px/1.55 var(--cuerpo);color:var(--gris);margin:0 0 6px;max-width:44ch}
  .medida{font:500 12px/1.5 var(--mono);color:var(--azulete);margin:0 0 14px;display:block}
  .movil{width:340px;max-width:100%;background:var(--papel);border:1px solid var(--pauta);padding:14px 14px 18px}
  .ver{border-left:3px solid var(--azulete);padding:2px 0 2px 16px;margin:30px 0 0}
  .ver p{font:400 15px/1.65 var(--cuerpo);margin:0 0 10px;max-width:64ch}
  .ver p:last-child{margin-bottom:0}
  .ver strong{font-weight:600}

  .k__dia{display:flex;align-items:baseline;gap:8px;margin:16px 0 4px;font:500 13px/1 var(--mono);color:var(--gris)}
  .k__dia:first-child{margin-top:0}
  .k__linea{flex:1;border-bottom:1px dashed var(--pauta);transform:translateY(-4px)}
  .k__tot{font-variant-numeric:tabular-nums}
  .k__h{display:grid;grid-template-columns:44px 1fr auto auto;gap:4px 8px;align-items:baseline;padding:6px 0}
  .k__h--sinfoto{grid-template-columns:1fr auto auto}
  .k__foto{width:44px;height:44px;grid-row:span 3;align-self:start;border-radius:3px;
    background:var(--papel2) center/cover no-repeat;background-image:var(--foto);
    border-left:3px solid var(--azulete)}
  .k__h--sobras .k__foto{border-left-color:var(--pauta);filter:saturate(.35) opacity(.75)}
  .k__h--ensamblaje .k__foto{border-left-color:var(--oferta-b)}
  .k__foto--llano{border-left:0}
  .k__nom{font:600 16px/1.25 var(--cuerpo);min-width:0}
  .k__h--sobras .k__nom{font-weight:400;color:var(--gris)}
  .k__guia{border-bottom:1px dotted var(--pauta);transform:translateY(-5px);min-width:12px}
  .k__pre{font:400 15px/1.2 var(--mono);white-space:nowrap;font-variant-numeric:tabular-nums}
  .k__pista{grid-column:2/-1;height:4px;background:var(--papel2);border-radius:2px;overflow:hidden;margin-top:2px}
  .k__h--sinfoto .k__pista,.k__h--sinfoto .k__sub{grid-column:1/-1}
  .k__barra{display:block;height:100%;background:var(--azulete)}
  .k__h--sobras .k__barra{background:var(--pauta)}
  .k__h--ensamblaje .k__barra{background:var(--oferta-b)}
  .k__barra--sobras{background:var(--pauta)}
  .k__barra--ensamblaje{background:var(--oferta-b)}
  .k__sub{grid-column:2/-1;font:400 12px/1.4 var(--mono);color:var(--gris)}

  .c5{margin-bottom:16px}
  .c5__dia{display:block;font:500 13px/1 var(--mono);color:var(--gris);margin-bottom:8px}
  .c5__h{margin-bottom:12px;display:grid;grid-template-columns:56px 1fr;gap:10px;align-items:start}
  .c5__foto{width:56px;height:56px;grid-row:span 3}
  .c5__linea{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
  .c5__nom{font:600 16px/1.2 var(--cuerpo);min-width:0}
  .c5__pre{font:400 14px/1.2 var(--mono);white-space:nowrap;font-variant-numeric:tabular-nums}
  .c5__sub{font:400 12px/1.4 var(--mono);color:var(--gris)}
</style>
<div class="env">
<header>
  <span class="sello">340 px · LOS SIETE DÍAS · MISMA SEMANA REAL, 63,89 € PARA DOS</span>
  <h1>F6 · la mezcla, y la pregunta de la foto</h1>
  <p class="baja">F6 toma la estructura de F1 —línea de ticket con guía de puntos y total por día— le mete la barra de coste de F5, y resuelve el fallo de F1 con un borde de color en la miniatura: azulete cocinas, gris recalientas, amarillo aprovechas. El borde no cuesta ni un píxel de alto. Las dos primeras columnas son la misma F6 con y sin foto, para que la decidas mirándola.</p>
</header>
<div class="rejilla">
  <div class="caso"><h2><span>F6</span>La mezcla · CON foto</h2>
    <p>Barra de coste bajo cada línea y borde de color por tipo. La sobra además va desaturada.</p>
    <span class="medida">1.073 px · 1,4 pantallas</span>
    <div class="movil">${f6(true)}</div></div>
  <div class="caso"><h2><span>F6</span>La mezcla · SIN foto</h2>
    <p>Lo mismo sin miniatura. El tipo se sostiene solo con el color de la barra.</p>
    <span class="medida">997 px · 1,3 pantallas · la foto cuesta 76 px, un 8%</span>
    <div class="movil">${f6(false)}</div></div>
  <div class="caso"><h2><span>F1</span>Original, de referencia</h2>
    <p>Sin barra y sin señal de tipo: el «recalientas» queda en el subtítulo gris.</p>
    <span class="medida">1.073 px · 1,4 pantallas</span>
    <div class="movil">${f1}</div></div>
  <div class="caso"><h2><span>F5</span>Original, de referencia</h2>
    <p>La barra manda, pero se apila bajo la foto en vez de al lado.</p>
    <span class="medida">1.370 px · 1,8 pantallas · la foto cuesta 299 px, un 28%</span>
    <div class="movil">${f5}</div></div>
</div>
<div class="ver">
  <p><strong>Lo que hay que mirar para decidir la foto.</strong> En F6 cuesta 76 px de 997, un 8%: es prácticamente gratis porque la miniatura va al lado de un bloque que ya mide lo mismo. Compara las dos primeras columnas y decide si esos 76 px compran suficiente.</p>
  <p><strong>Y mira el miércoles y el sábado.</strong> Son los huecos de sobras: barra al mínimo, 0,00 €, nombre en gris y foto desaturada. Ahí se ve de un golpe que ese día no cuesta nada — que es lo que vende el producto y hoy se dice con una palabra pequeña.</p>
  <p><strong>Un aviso honesto sobre las fotos:</strong> es la misma imagen catorce veces porque solo hay una receta fotografiada de 112. Con fotos distintas, la columna sin foto pierde y la columna con foto gana más de lo que se ve aquí — pero también aparecerá el problema de que una sobra repite la imagen de su plato de origen dos veces en la misma semana.</p>
</div>
</div>
`;

fs.writeFileSync('docs/capturas/f6-mezcla.html', html);
console.log(`${(fs.statSync('docs/capturas/f6-mezcla.html').size / 1024).toFixed(0)} KB`);
