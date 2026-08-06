import fs from 'node:fs';

/* ── Viñetas. Mismo idioma que las tres que ya existen: fragmento de ticket
   con el borde dentado, trazo 6, butt + miter, cero curvas. Las dos nuevas
   son de aquí; la de presupuesto no se dibuja, por indicación expresa. */
const TICKET = 'M20 16 H100 V94 L90 102 L80 94 L70 102 L60 94 L50 102 L40 94 L30 102 L20 94 Z';
const vineta = (partes) => `<svg viewBox="0 0 120 120" fill="none" stroke="currentColor"
  stroke-width="6" stroke-linecap="butt" stroke-linejoin="miter" class="vin">
  <path d="${TICKET}"/>${partes}</svg>`;
const V = {
  comensales: vineta(`<path d="M36 30 h14 v14 h-14 Z"/><path d="M34 52 L52 52 L56 76 L30 76 Z"/>
    <path d="M70 30 h14 v14 h-14 Z"/><path d="M68 52 L86 52 L90 76 L64 76 Z"/><path d="M30 86 H90"/>`),
  restricciones: vineta(`<path d="M32 38 H88"/><path d="M32 58 H88"/><path d="M32 78 H88"/>
    <path d="M26 70 L94 46" stroke-width="9"/>`),
  // Reloj de arena: dos triángulos que se tocan. Sin una sola curva.
  tiempo: vineta(`<path d="M40 30 H80 L60 54 Z"/><path d="M40 80 H80 L60 56 Z"/><path d="M34 30 H86"/><path d="M34 80 H86"/>`),
  // Postre de cuchara: tarrina troncocónica con su tapa. Es flan y es yogur.
  postre: vineta(`<path d="M34 42 H86"/><path d="M42 48 H78 L72 80 H48 Z"/><path d="M52 28 h16 v10 h-16 Z"/>`),
};

const eur = (n) => n.toFixed(2).replace('.', ',') + ' €';

/* ── Piezas de pantalla ─────────────────────────────────────────────── */
const cab = (paso) => `<div class="p__cab"><span class="p__marca">cunde</span>${paso ? `<span class="p__paso">${paso}</span>` : ''}</div>`;
const cta = (t) => `<button class="p__cta">${t}</button>`;
const grid = (sel) => `<div class="p__grid">${['1', '2', '3', '4', '5+']
  .map((o) => `<button class="p__gopt${o === sel ? ' on' : ''}">${o}</button>`).join('')}</div>`;
const ancla = (v, preg) => `<div class="p__ancla">${V[v]}<h2 class="p__preg">${preg}</h2></div>`;
const salida = (t, on) => `<button class="p__salida${on ? ' on' : ''}">${t}</button>`;
const bloques = (ops, sel) => `<div class="p__bloques">${ops.map(([l, s]) => `
  <button class="p__bloque${l === sel ? ' on' : ''}"><span class="p__bl">${l}</span><span class="p__bs">${s}</span></button>`).join('')}</div>`;
const selcoste = (ops, sel) => `<div class="sc">${ops.map((o) => `
  <button class="sc__op${o.v === sel ? ' on' : ''}"><span class="sc__l">${o.l}</span><span class="sc__n">${o.n}</span>
  <span class="sc__p">${o.p === 0 ? '0,00 €' : eur(o.p)}</span><span class="sc__e">${o.e}</span></button>`).join('')}</div>`;
const chips = (xs, sel) => `<div class="p__chips">${xs.map((c) => `<button class="p__chip${c === sel ? ' on' : ''}">${c}</button>`).join('')}</div>`;

const POSTRE = [
  { v: 'no', l: 'No', n: 'sin postre', p: 0, e: 'lo más barato' },
  { v: 'semana', l: 'Entre semana', n: '5 días', p: 2.84, e: '+2,84 €' },
  { v: 'todos', l: 'Todos', n: '7 días', p: 4.69, e: '+4,69 €' },
];
const TIEMPO = [['Lo mínimo', 'menos de 20 min'], ['Lo normal', '30 a 40 min'], ['Me gusta cocinar', 'sin límite']];

/* ── Pantallas completas ────────────────────────────────────────────── */
const P = {
  portada: `<div class="p p--portada">
    <div class="rollo"><span class="rollo__marca">cunde</span>
      <div class="rollo__meta">MERCADONA · 28 JUL · 2 PERSONAS</div>
      <div class="rollo__l"><span>Pechuga de pollo</span><i></i><span>4,45</span></div>
      <div class="rollo__l"><span>Lenteja pardina</span><i></i><span>1,27</span></div>
      <div class="rollo__l"><span>Tomate triturado</span><i></i><span>0,89</span></div>
      <div class="rollo__mas">y 24 productos más</div>
      <div class="rollo__tot"><span>TOTAL · 14 COMIDAS</span></div>
      <div class="rollo__cifra">61,92 €</div></div>
    ${cta('Empezar')}<span class="p__nota">Sin registro. Sin tarjeta.</span></div>`,

  comensales: (paso) => `<div class="p">${cab(paso)}<div class="p__cuerpo">
    ${ancla('comensales', '¿Cuántos sois?')}${grid('2')}</div>${cta('Seguir')}</div>`,

  restricciones: (paso) => `<div class="p">${cab(paso)}<div class="p__cuerpo">
    ${ancla('restricciones', '¿Hay algo que no podáis comer?')}
    ${salida('Nada, comemos de todo', true)}${salida('Sí, hay alergias o dietas')}</div>${cta('Seguir')}</div>`,

  datos: (paso, nota) => `<div class="p">${cab(paso)}<div class="p__cuerpo">
    ${ancla('comensales', '¿Cuántos sois?')}${grid('2')}
    ${ancla('restricciones', '¿Hay algo que no podáis comer?')}
    ${salida('Nada, comemos de todo', true)}${salida('Sí, hay alergias o dietas')}
    ${nota ? `<p class="p__pie-nota">${nota}</p>` : ''}</div>${cta('Seguir')}</div>`,

  tiempo: (paso) => `<div class="p">${cab(paso)}<div class="p__cuerpo">
    ${ancla('tiempo', '¿Cuánto quieres cocinar?')}${bloques(TIEMPO, 'Lo normal')}</div>${cta('Seguir')}</div>`,

  postre: (paso) => `<div class="p">${cab(paso)}<div class="p__cuerpo">
    ${ancla('postre', '¿Pones postre?')}${selcoste(POSTRE, 'no')}
    <span class="p__grupo">De qué</span>${chips(['fruta', 'yogur', 'de cuchara'], 'fruta')}
    <p class="p__pie-nota">Sale del presupuesto, no se suma encima.</p></div>${cta('Seguir')}</div>`,

  comoComes: (paso) => `<div class="p">${cab(paso)}<div class="p__cuerpo p__cuerpo--scroll">
    ${ancla('tiempo', '¿Cómo coméis?')}
    <span class="p__grupo">Cuánto quieres cocinar</span>${bloques(TIEMPO, 'Lo normal')}
    <span class="p__grupo">Postre</span>${selcoste(POSTRE, 'no')}
    ${chips(['fruta', 'yogur', 'de cuchara'], 'fruta')}</div>${cta('Seguir')}</div>`,

  presupuesto: (paso) => `<div class="p">${cab(paso)}
    <div class="p__ticket"><div class="p__tl"><span>Comensales</span><i></i><span>2 personas</span></div>
      <div class="p__tl"><span>Súper</span><i></i><span>Mercadona ›</span></div>
      <div class="p__tl"><span>No comemos</span><i></i><span>de todo</span></div></div>
    <div class="p__cuerpo p__cuerpo--centro">
      <h2 class="p__preg p__preg--sola">¿Cuánto quieres gastar<br>a la semana?</h2>
      <div class="p__cifra">65 €</div><div class="p__pordia">4,64 € por persona y día</div>
      <div class="p__slider"><span class="p__pista"></span><span class="p__pomo"></span></div>
      <div class="p__tl p__tl--gris"><span>14 comidas · 2 personas</span><i></i><span>2,32 €/ración</span></div>
    </div>${cta('Ver mi semana')}<span class="p__nota">Sin registro. Sin tarjeta.</span></div>`,

  semanaAfinar: `<div class="p">
    <div class="p__tabs"><span class="on">SEMANA</span><span>COMPRA</span></div>
    <div class="p__res"><div class="p__rot"><span>TU SEMANA</span><i></i><span class="az">ajustar ›</span></div>
      <div class="p__cifra p__cifra--sem">63,89 €</div>
      <div class="p__barra"><span style="width:98%"></span></div>
      <div class="p__ctx">65,00 € de presupuesto · 14 comidas · 2 personas</div></div>
    <button class="p__afinar"><span class="p__af-t">Afinar tu semana</span>
      <span class="p__af-s">tiempo de cocina · postre · variedad</span><span class="p__af-f">›</span></button>
    <div class="p__dias">
      <div class="p__dia"><span>LUN</span><i></i><span>2,17 €</span></div>
      <div class="p__h"><span>Quinoa con garbanzos</span><i></i><span>0,98 €</span></div>
      <div class="p__h"><span>Picadillo de cerdo</span><i></i><span>1,19 €</span></div>
      <div class="p__dia"><span>MAR</span><i></i><span>1,99 €</span></div>
      <div class="p__h"><span>Jamoncitos al ajillo</span><i></i><span>1,03 €</span></div>
      <div class="p__h"><span>Espaguetis con soja</span><i></i><span>0,96 €</span></div>
    </div>${cta('Ver la lista')}</div>`,
};

/* ── Las cuatro rutas ───────────────────────────────────────────────── */
const RUTAS = [
  {
    id: 'a', titulo: 'A · Como está hoy',
    baja: 'Dos pantallas. Solo se pregunta lo que, si falta, hace el primer menú inservible.',
    antes: 2, toques: 3, preguntasAntes: 2,
    pantallas: [['Portada', P.portada], ['1/2 · Datos', P.datos('1/2', 'Lo demás te lo pregunto sobre el menú.')],
      ['2/2 · Presupuesto', P.presupuesto('2/2')], ['El número', P.semanaAfinar.replace(/<button class="p__afinar">[\s\S]*?<\/button>/, '')]],
  },
  {
    id: 'b', titulo: 'B · Una pregunta por pantalla',
    baja: 'Lo que viste en esa app: viñeta grande, una decisión cada vez. Cinco pantallas antes del euro.',
    antes: 5, toques: 6, preguntasAntes: 5,
    pantallas: [['Portada', P.portada], ['1/5', P.comensales('1/5')], ['2/5', P.restricciones('2/5')],
      ['3/5', P.tiempo('3/5')], ['4/5', P.postre('4/5')], ['5/5', P.presupuesto('5/5')]],
  },
  {
    id: 'c', titulo: 'C · Una pantalla más, agrupada',
    baja: 'Tiempo y postre juntos en un paso intermedio. El término medio.',
    antes: 3, toques: 4, preguntasAntes: 4,
    pantallas: [['Portada', P.portada], ['1/3 · Datos', P.datos('1/3')], ['2/3 · Cómo coméis', P.comoComes('2/3')],
      ['3/3 · Presupuesto', P.presupuesto('3/3')]],
  },
  {
    id: 'd', titulo: 'D · Después del número',
    baja: 'La doctrina actual llevada a su final: el euro primero, y una fila sobre el menú que abre lo demás con el precio delante.',
    antes: 2, toques: 3, preguntasAntes: 2,
    pantallas: [['Portada', P.portada], ['1/2 · Datos', P.datos('1/2', 'Lo demás te lo pregunto sobre el menú.')],
      ['2/2 · Presupuesto', P.presupuesto('2/2')], ['El número + afinar', P.semanaAfinar]],
  },
];

const tira = (r) => `
<section class="ruta" id="r-${r.id}">
  <div class="ruta__cab">
    <h2>${r.titulo}</h2>
    <p>${r.baja}</p>
    <div class="ruta__cifras">
      <span class="cifra"><b>${r.antes}</b> pantallas antes del número</span>
      <span class="cifra"><b>${r.toques}</b> toques mínimos</span>
      <span class="cifra"><b>${r.preguntasAntes}</b> preguntas antes</span>
    </div>
  </div>
  <div class="tira">${r.pantallas.map(([t, html]) => `
    <figure class="marco"><div class="movil">${html}</div><figcaption>${t}</figcaption></figure>`).join('')}</div>
</section>`;

const html = `<title>Cunde · Cuatro onboardings</title>
<style>
  :root{--papel:#EFEDE6;--papel2:#E5E2D8;--crema:#F6F4EE;--tinta:#1A1917;
    --azulete:#2B4C7E;--azulete-fondo:rgba(43,76,126,.07);--pauta:#A9A498;--gris:#6E6A5F;--linea:#D6D2C6;
    --borde:1.5px solid rgba(169,164,152,.7);
    --mono:ui-monospace,'SF Mono',Menlo,Consolas,monospace;
    --cuerpo:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;}
  @media (prefers-color-scheme:dark){:root{--papel:#161513;--papel2:#242219;--crema:#1E1D1A;--tinta:#EDEBE4;
    --azulete:#8FB3E0;--azulete-fondo:rgba(143,179,224,.12);--pauta:#5C584F;--gris:#A8A39A;--linea:#302E29;
    --borde:1.5px solid rgba(92,88,79,.9);}}
  :root[data-theme='dark']{--papel:#161513;--papel2:#242219;--crema:#1E1D1A;--tinta:#EDEBE4;
    --azulete:#8FB3E0;--azulete-fondo:rgba(143,179,224,.12);--pauta:#5C584F;--gris:#A8A39A;--linea:#302E29;
    --borde:1.5px solid rgba(92,88,79,.9);}
  :root[data-theme='light']{--papel:#EFEDE6;--papel2:#E5E2D8;--crema:#F6F4EE;--tinta:#1A1917;
    --azulete:#2B4C7E;--azulete-fondo:rgba(43,76,126,.07);--pauta:#A9A498;--gris:#6E6A5F;--linea:#D6D2C6;
    --borde:1.5px solid rgba(169,164,152,.7);}
  *{box-sizing:border-box}
  body{margin:0;background:var(--papel);color:var(--tinta);font-family:var(--cuerpo);line-height:1.6;
    -webkit-font-smoothing:antialiased}
  .env{max-width:1240px;margin:0 auto;padding:42px 20px 100px}
  header{border-bottom:2px solid var(--tinta);padding-bottom:24px}
  .sello{font:500 12px/1 var(--mono);letter-spacing:.12em;color:var(--gris);text-transform:uppercase}
  h1{font:700 clamp(28px,5.5vw,44px)/1.02 var(--cuerpo);letter-spacing:-.035em;margin:10px 0 0;text-wrap:balance}
  .baja{font-size:17px;color:var(--gris);max-width:64ch;margin:14px 0 0}

  .ruta{margin-top:58px}
  .ruta__cab h2{font:700 24px/1.15 var(--cuerpo);letter-spacing:-.025em;margin:0}
  .ruta__cab p{font-size:15.5px;color:var(--gris);margin:6px 0 0;max-width:62ch}
  .ruta__cifras{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 16px}
  .cifra{font:500 12.5px/1 var(--mono);color:var(--gris);background:var(--papel2);
    border:1px solid var(--linea);padding:7px 11px;border-radius:3px}
  .cifra b{color:var(--tinta);font-weight:700;font-size:14px}

  .tira{display:flex;gap:16px;overflow-x:auto;padding:4px 0 14px;scrollbar-width:thin}
  .marco{margin:0;flex:none}
  .marco figcaption{font:500 12px/1.4 var(--mono);color:var(--gris);margin-top:8px;text-align:center}
  /* 390×844 reales, reducidos a 0,62 para que la ruta entera quepa de un vistazo */
  .movil{width:390px;height:844px;border:1px solid var(--pauta);overflow:hidden;background:var(--papel);
    transform:scale(.62);transform-origin:top left}
  .marco{width:243px;height:524px}

  /* ── dentro del móvil ── */
  .p{height:844px;display:flex;flex-direction:column;padding:26px 30px 30px;background:var(--papel)}
  .p__cab{display:flex;align-items:baseline;justify-content:space-between;flex:none}
  .p__marca{font:700 21px/1 var(--cuerpo);letter-spacing:-.03em}
  .p__paso{font:500 13px/1 var(--mono);color:var(--gris)}
  .p__cuerpo{flex:1;min-height:0;padding-top:22px}
  .p__cuerpo--scroll{overflow-y:auto}
  .p__cuerpo--centro{display:flex;flex-direction:column;justify-content:center;text-align:center}
  .p__ancla{display:flex;align-items:center;gap:14px;margin:26px 0 16px}
  .p__ancla:first-child{margin-top:0}
  .vin{width:52px;height:52px;flex:none;color:var(--tinta)}
  .p__preg{font:600 22px/1.2 var(--cuerpo);letter-spacing:-.02em;margin:0}
  .p__preg--sola{font-size:24px;margin-bottom:18px}
  .p__grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
  .p__gopt{min-height:56px;border:var(--borde);border-radius:4px;background:none;font:600 17px/1 var(--cuerpo);
    color:var(--tinta);font-family:inherit;cursor:pointer}
  .p__gopt.on{border-color:var(--azulete);background:var(--azulete-fondo);color:var(--azulete)}
  .p__salida{display:flex;align-items:center;width:100%;min-height:56px;padding:0 16px;margin-bottom:8px;
    border:var(--borde);border-radius:4px;background:none;font:500 17px/1 var(--cuerpo);color:var(--tinta);
    font-family:inherit;text-align:left;cursor:pointer}
  .p__salida.on{border-color:var(--azulete);background:var(--azulete-fondo);color:var(--azulete)}
  .p__bloques{display:flex;flex-direction:column;gap:8px}
  .p__bloque{display:flex;flex-direction:column;align-items:flex-start;gap:5px;padding:16px;border:var(--borde);
    border-radius:4px;background:none;font-family:inherit;text-align:left;cursor:pointer}
  .p__bloque.on{border-color:var(--azulete);background:var(--azulete-fondo)}
  .p__bl{font:500 17px/1.1 var(--cuerpo)}
  .p__bloque.on .p__bl{color:var(--azulete)}
  .p__bs{font:400 13px/1.2 var(--mono);color:var(--gris)}
  .p__grupo{display:block;margin:18px 0 8px;font:600 15px/1.3 var(--cuerpo)}
  .p__chips{display:flex;flex-wrap:wrap;gap:8px}
  .p__chip{min-height:56px;padding:0 16px;border:var(--borde);border-radius:999px;background:none;
    font:500 15px/1 var(--cuerpo);color:var(--tinta);font-family:inherit;cursor:pointer}
  .p__chip.on{border-color:var(--azulete);background:var(--azulete-fondo);color:var(--azulete)}
  .p__pie-nota{margin:16px 0 0;font:400 13px/1.6 var(--mono);color:var(--gris)}
  .p__cta{flex:none;width:100%;min-height:56px;margin-top:14px;border:0;border-radius:4px;
    background:var(--azulete);color:#fff;font:600 17px/1 var(--cuerpo);font-family:inherit;cursor:pointer}
  .p__nota{flex:none;margin-top:12px;text-align:center;font:400 13px/1.4 var(--mono);color:var(--gris)}

  .sc{display:flex;gap:8px}
  .sc__op{flex:1 1 0;min-width:0;display:flex;flex-direction:column;gap:2px;min-height:56px;padding:9px 8px;
    border:var(--borde);border-radius:4px;background:none;font-family:inherit;text-align:left;cursor:pointer}
  .sc__op.on{border-color:var(--azulete);background:var(--azulete-fondo)}
  .sc__l{font:600 15px/1.1 var(--cuerpo)}
  .sc__n{font:400 13px/1.1 var(--mono);color:var(--gris)}
  .sc__p{margin-top:4px;font:500 17px/1.1 var(--mono);font-variant-numeric:tabular-nums}
  .sc__e{font:400 13px/1.1 var(--mono);color:var(--gris);font-variant-numeric:tabular-nums}

  .p__ticket{flex:none;margin-top:18px}
  .p__tl{display:flex;align-items:baseline;gap:8px;padding:6px 0;font:400 15px/1.4 var(--cuerpo)}
  .p__tl i{flex:1;border-bottom:1px dotted var(--pauta);transform:translateY(-4px)}
  .p__tl span:last-child{font-family:var(--mono);font-size:14px;font-variant-numeric:tabular-nums}
  .p__tl--gris{color:var(--gris);justify-content:center;font-size:14px}
  .p__cifra{font:700 56px/1 var(--cuerpo);letter-spacing:-.03em;font-variant-numeric:tabular-nums}
  .p__pordia{margin-top:6px;font:400 15px/1.4 var(--mono);color:var(--gris)}
  .p__slider{position:relative;height:56px;display:flex;align-items:center;margin:18px 0 8px}
  .p__pista{flex:1;height:10px;background:var(--papel2);border-radius:5px}
  .p__pomo{position:absolute;left:33%;width:34px;height:34px;border-radius:50%;background:var(--azulete)}

  /* portada */
  .p--portada{justify-content:flex-end}
  .rollo{flex:1;display:flex;flex-direction:column;justify-content:center;background:var(--crema);
    border:1px solid var(--linea);padding:26px 22px;margin-bottom:18px}
  .rollo__marca{font:700 26px/1 var(--cuerpo);letter-spacing:-.03em}
  .rollo__meta{margin:14px 0 16px;font:500 12px/1 var(--mono);letter-spacing:.08em;color:var(--gris)}
  .rollo__l{display:flex;align-items:baseline;gap:8px;padding:5px 0;font:400 14px/1.4 var(--cuerpo)}
  .rollo__l i{flex:1;border-bottom:1px dotted var(--pauta);transform:translateY(-4px)}
  .rollo__l span:last-child{font-family:var(--mono);font-size:13px}
  .rollo__mas{margin:6px 0 14px;font:400 13px/1 var(--mono);color:var(--gris)}
  .rollo__tot{border-top:1.5px solid var(--tinta);padding-top:12px;font:500 12px/1 var(--mono);letter-spacing:.08em}
  .rollo__cifra{margin-top:8px;font:700 56px/1 var(--cuerpo);letter-spacing:-.03em;font-variant-numeric:tabular-nums}

  /* semana */
  .p__tabs{flex:none;display:flex;gap:22px;padding-bottom:12px;border-bottom:1px dashed var(--pauta);
    font:600 13px/1 var(--cuerpo);letter-spacing:.18em;color:var(--gris)}
  .p__tabs .on{color:var(--tinta)}
  .p__res{flex:none;padding:16px 0 12px}
  .p__rot{display:flex;align-items:baseline;gap:8px;font:500 13px/1.3 var(--mono);color:var(--gris);
    padding-bottom:10px}
  .p__rot i{flex:1;border-bottom:1px dotted var(--pauta);transform:translateY(-4px)}
  .p__rot .az{color:var(--azulete)}
  .p__cifra--sem{font-size:56px}
  .p__barra{height:10px;background:rgba(128,128,128,.22);margin-top:10px}
  .p__barra span{display:block;height:100%;background:var(--azulete)}
  .p__ctx{margin-top:8px;font:400 13px/1.5 var(--mono);color:var(--gris)}
  .p__afinar{flex:none;display:flex;align-items:center;gap:10px;width:100%;min-height:56px;padding:10px 14px;
    margin:6px 0 10px;border:var(--borde);border-radius:4px;background:none;font-family:inherit;
    text-align:left;cursor:pointer}
  .p__af-t{font:500 16px/1.2 var(--cuerpo)}
  .p__af-s{flex:1;font:400 12px/1.2 var(--mono);color:var(--gris)}
  .p__af-f{font-family:var(--mono);color:var(--azulete)}
  .p__dias{flex:1;min-height:0;overflow:hidden}
  .p__dia{display:flex;align-items:baseline;gap:8px;margin:12px 0 4px;font:500 13px/1 var(--mono);color:var(--gris)}
  .p__dia i{flex:1;border-bottom:1px dashed var(--pauta);transform:translateY(-4px)}
  .p__h{display:flex;align-items:baseline;gap:8px;padding:7px 0;font:600 16px/1.25 var(--cuerpo)}
  .p__h i{flex:1;border-bottom:1px dotted var(--pauta);transform:translateY(-5px)}
  .p__h span:last-child{font:400 15px/1.2 var(--mono);font-variant-numeric:tabular-nums}

  .ver{border-left:3px solid var(--azulete);padding:2px 0 2px 18px;margin:56px 0 0}
  .ver p{font-size:16px;margin:0 0 12px;max-width:66ch}
  .ver p:last-child{margin-bottom:0}
  .ver strong{font-weight:600}
  code{font:500 13.5px/1 var(--mono);background:var(--papel2);padding:2px 5px;border-radius:3px}
  .tabla-env{overflow-x:auto;margin:24px 0;border:1px solid var(--linea)}
  table{border-collapse:collapse;width:100%;min-width:600px;background:var(--crema)}
  th,td{text-align:left;padding:11px 14px;border-bottom:1px solid var(--linea);font-size:14.5px;vertical-align:top}
  th{font:500 12px/1.3 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--gris);
    background:var(--papel2);white-space:nowrap}
  tbody tr:last-child td{border-bottom:0}
  td.v{font:500 13.5px/1.4 var(--mono);white-space:nowrap;font-variant-numeric:tabular-nums}
</style>
<div class="env">
<header>
  <span class="sello">390 × 844 reales, reducidos al 62 % · las tiras se desplazan a lo ancho</span>
  <h1>Cuatro onboardings</h1>
  <p class="baja">Todas responden a lo mismo: meter tiempo y postre. Lo que cambia entre ellas es una sola cosa —cuántas puertas hay antes de que el usuario vea un euro— y eso es exactamente lo que decide la métrica 1.</p>
</header>

${RUTAS.map(tira).join('')}

<div class="ver">
  <p><strong>Lo que la app ya te promete por escrito.</strong> El paso 1/2 termina hoy con la línea <em>«Lo demás te lo pregunto sobre el menú.»</em> No es relleno: es el contrato del embudo, y las rutas B y C lo rompen. Si se elige una de ellas, esa frase hay que quitarla — y con ella se va el argumento de por qué el onboarding es corto.</p>
  <p><strong>Dónde está el gusto de verdad.</strong> Ninguna de las cuatro pregunta «¿te gusta más el pollo o el pescado?», y es a propósito: quien lo declara está adivinando, quien cambia dos platos de pescado el primer día te lo ha dicho de verdad. Ese dato ya lo genera el retoque y hoy se tira. Es la mejora grande, y no cuesta ni una pantalla.</p>
  <p><strong>Lo que sí hay que preguntar sí o sí.</strong> Fruta o dulce de cuchara: no se puede observar, y si fallamos la semana 1 no hay retoque que lo arregle porque el postre no es un hueco. Sale más barato el flan (0,18 €/ud) que el plátano (0,39 €), así que ofrecerlo no cuesta dinero — solo un sitio donde caber.</p>
</div>

<div class="tabla-env"><table>
  <thead><tr><th>Ruta</th><th>Antes del número</th><th>Qué gana</th><th>Qué arriesga</th></tr></thead>
  <tbody>
    <tr><td class="v">A · hoy</td><td class="v">2 pantallas · 3 toques</td><td>El embudo más corto posible. Cumple la promesa impresa.</td><td>Tiempo y postre quedan en Ajustes, donde mucha gente no entra nunca.</td></tr>
    <tr><td class="v">B · una por pantalla</td><td class="v">5 pantallas · 6 toques</td><td>Datos completos y ritmo claro. Es lo que viste y te gustó.</td><td>Triplica las puertas de salida antes del euro. Contra la métrica 1 de frente.</td></tr>
    <tr><td class="v">C · agrupada</td><td class="v">3 pantallas · 4 toques</td><td>Una sola pantalla más y cubre las dos preguntas nuevas.</td><td>Sigue rompiendo la promesa, y la pantalla lleva scroll.</td></tr>
    <tr><td class="v">D · después</td><td class="v">2 pantallas · 3 toques</td><td>Coste cero de embudo, y las preguntas se contestan con el precio delante.</td><td>Depende de que la fila «Afinar» se toque. Hay que medirlo.</td></tr>
  </tbody>
</table></div>
</div>
`;

fs.writeFileSync('docs/capturas/onboarding.html', html);
console.log(`${(fs.statSync('docs/capturas/onboarding.html').size / 1024).toFixed(0)} KB`);
