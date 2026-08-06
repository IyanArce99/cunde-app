import fs from 'node:fs';

const img = (f) => `data:image/png;base64,${fs.readFileSync(`docs/capturas/${f}`).toString('base64')}`;
const MURO = img('muro-01-semana2.png');
const COMPRA = img('muro-02-compra.png');

const html = `<title>Cunde · El muro de pago</title>
<style>
  :root{
    --papel:#EFEDE6;--crema:#F6F4EE;--papel2:#E5E2D8;--tinta:#1A1917;
    --azulete:#2B4C7E;--oferta:#C9A800;--roja:#C8341F;--gris:#6E6A5F;--pauta:#A9A498;
    --linea:#D6D2C6;
    --mono:ui-monospace,'SF Mono',Menlo,Consolas,'Liberation Mono',monospace;
    --cuerpo:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
  }
  @media (prefers-color-scheme:dark){:root{
    --papel:#161513;--crema:#1E1D1A;--papel2:#242219;--tinta:#EDEBE4;
    --azulete:#8FB3E0;--oferta:#E3C233;--roja:#F07C68;--gris:#A8A39A;--pauta:#5C584F;--linea:#302E29;}}
  :root[data-theme='dark']{--papel:#161513;--crema:#1E1D1A;--papel2:#242219;--tinta:#EDEBE4;
    --azulete:#8FB3E0;--oferta:#E3C233;--roja:#F07C68;--gris:#A8A39A;--pauta:#5C584F;--linea:#302E29;}
  :root[data-theme='light']{--papel:#EFEDE6;--crema:#F6F4EE;--papel2:#E5E2D8;--tinta:#1A1917;
    --azulete:#2B4C7E;--oferta:#C9A800;--roja:#C8341F;--gris:#6E6A5F;--pauta:#A9A498;--linea:#D6D2C6;}

  *{box-sizing:border-box}
  body{margin:0;background:var(--papel);color:var(--tinta);font-family:var(--cuerpo);
    font-size:16px;line-height:1.6;-webkit-font-smoothing:antialiased}
  .env{max-width:940px;margin:0 auto;padding:44px 22px 100px}

  .sello{font:500 12px/1 var(--mono);letter-spacing:.12em;color:var(--gris);text-transform:uppercase}
  h1{font:700 clamp(30px,6vw,46px)/1.02 var(--cuerpo);letter-spacing:-.035em;margin:10px 0 0;text-wrap:balance}
  .entradilla{font-size:18px;line-height:1.6;color:var(--gris);max-width:60ch;margin:16px 0 0}
  header{border-bottom:2px solid var(--tinta);padding-bottom:26px}

  h2{font:700 clamp(21px,3.4vw,27px)/1.15 var(--cuerpo);letter-spacing:-.025em;
    margin:56px 0 0;text-wrap:balance}
  h2 .n{font:500 13px/1 var(--mono);color:var(--gris);display:block;margin-bottom:8px;letter-spacing:.12em}
  h3{font:600 17px/1.3 var(--cuerpo);letter-spacing:-.01em;margin:30px 0 6px}
  p{max-width:66ch;margin:12px 0}
  strong{font-weight:600}
  code{font:500 13.5px/1 var(--mono);background:var(--papel2);padding:2px 5px;border-radius:3px;
    word-break:break-word}
  a{color:var(--azulete)}

  /* ── el ticket: filas con guía de puntos ── */
  .ticket{background:var(--crema);border:1px solid var(--linea);padding:20px 22px;margin:22px 0}
  .ticket-t{font:500 12px/1 var(--mono);letter-spacing:.14em;color:var(--gris);
    display:block;margin-bottom:14px}
  .fila{display:flex;align-items:baseline;gap:8px;padding:7px 0;border-top:1px solid var(--linea)}
  .fila:first-of-type{border-top:0}
  .fila b{font-weight:500;font-size:15px;min-width:0}
  .guia{flex:1;border-bottom:1px dotted var(--pauta);transform:translateY(-4px);min-width:14px}
  .val{font:500 15px/1.3 var(--mono);font-variant-numeric:tabular-nums;white-space:nowrap;text-align:right}
  .val--mal{color:var(--roja)}
  .val--ok{color:var(--azulete)}

  /* ── hallazgos ── */
  .hallazgo{border-left:3px solid var(--roja);padding:2px 0 2px 18px;margin:26px 0}
  .hallazgo .et{font:500 12px/1 var(--mono);letter-spacing:.12em;color:var(--roja);
    text-transform:uppercase;display:block;margin-bottom:6px}
  .hallazgo p:first-of-type{margin-top:0}
  .bien{border-left-color:var(--azulete)}
  .bien .et{color:var(--azulete)}

  /* ── pantallas ── */
  .pantallas{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:28px;margin:26px 0 8px}
  figure{margin:0}
  figure img{width:100%;height:auto;display:block;border:1px solid var(--linea)}
  figcaption{font:400 13.5px/1.5 var(--cuerpo);color:var(--gris);margin-top:10px}
  figcaption b{color:var(--tinta);font-weight:600}

  /* ── tabla de opciones ── */
  .tabla-env{overflow-x:auto;margin:22px 0;border:1px solid var(--linea)}
  table{border-collapse:collapse;width:100%;min-width:560px;background:var(--crema)}
  th,td{text-align:left;padding:11px 14px;border-bottom:1px solid var(--linea);vertical-align:top;
    font-size:14.5px;line-height:1.5}
  th{font:500 12px/1.3 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--gris);
    background:var(--papel2);white-space:nowrap}
  tbody tr:last-child td{border-bottom:0}
  td.v{white-space:nowrap;font:500 13.5px/1.4 var(--mono)}
  .no{color:var(--roja)}
  .si{color:var(--azulete)}
  .quiza{color:var(--gris)}

  .recuadro{background:var(--papel2);border:1px solid var(--linea);padding:20px 22px;margin:26px 0}
  .recuadro p:first-child{margin-top:0}
  .recuadro p:last-child{margin-bottom:0}

  ul{max-width:66ch;padding-left:20px}
  li{margin:8px 0}
  hr{border:0;border-top:1px dashed var(--pauta);margin:52px 0 0}
</style>
<div class="env">

<header>
  <span class="sello">Auditoría · 30 jul 2026 · medido en la app en marcha</span>
  <h1>El muro de pago no capa nada</h1>
  <p class="entradilla">Está construido, se ve bien y respeta todas las reglas de trato honesto que nos pusimos. Pero como modelo de negocio hoy es una maqueta: el plan gratis y el de pago dan exactamente lo mismo.</p>
</header>

<h2><span class="n">1 · CÓMO ESTÁ HOY</span>Un aviso semanal que se quita con un toque</h2>

<p>La condición está en <code>Semana.tsx:108</code> y es de una línea:</p>
<div class="ticket">
  <span class="ticket-t">CUÁNDO SALE EL MURO</span>
  <div class="fila"><b>Estás en la semana 2 o posterior</b><span class="guia"></span><span class="val">y</span></div>
  <div class="fila"><b>No has elegido plan</b><span class="guia"></span><span class="val">y</span></div>
  <div class="fila"><b>No has pulsado «seguir gratis» esta semana</b><span class="guia"></span><span class="val">entonces sale</span></div>
</div>

<div class="pantallas">
  <figure>
    <img src="${MURO}" alt="Pantalla Semana en la semana 2 con el muro de pago cubriéndola: cuentas de la semana pasada, dos planes y salida gratis.">
    <figcaption><b>El muro, semana 2.</b> Cubre la pantalla Semana entera. Detrás, donde iba la cifra, queda un guion largo a 56 px que se lee como una barra de censura.</figcaption>
  </figure>
  <figure>
    <img src="${COMPRA}" alt="Pantalla Compra con la lista completa de productos y precios, accesible con el muro sin resolver.">
    <figcaption><b>La pestaña Compra, en ese mismo momento.</b> Sin resolver el muro. Lista entera, precios, subtotales por pasillo y el botón de cerrar la compra. Intacta.</figcaption>
  </figure>
</div>

<h2><span class="n">2 · LOS TRES AGUJEROS</span>Lo que descubrí al conducirlo, no al leerlo</h2>

<div class="hallazgo">
  <span class="et">Agujero 1 · el muro solo tapa una ruta</span>
  <p>Con el muro sin resolver, entré por URL a <code>/compra</code> y a <code>/semana/variante</code>. Las dos cargan enteras: la lista con sus 24 productos y sus precios, y la vista de <em>4,56 € por persona y día</em> con el total de 63,89 €. El muro es un <code>return</code> temprano dentro del componente Semana, no una condición sobre el estado. <strong>Todo lo que se supone que estás pagando ya está a un toque de distancia en la otra pestaña.</strong></p>
</div>

<div class="hallazgo">
  <span class="et">Agujero 2 · la salida gratis lo da todo</span>
  <p>«Seguir con el plan gratis» pone <code>semanaVistaGratis = 2</code> y abre la semana completa. Recargué y el muro no volvió. La semana que viene reaparece, se toca otra vez y vuelve a abrirse. <strong>El plan gratis es el plan de pago menos un toque a la semana.</strong> Un usuario racional no paga nunca, y tiene razón.</p>
</div>

<div class="hallazgo">
  <span class="et">Agujero 3 · el muro promete algo que no existe</span>
  <p>El texto dice: «con precios actualizados y <em>ajustes sin límite</em>, van en el plan de pago». Busqué el límite. <code>ajustesEstaSemana</code> se incrementa en dos sitios de <code>AppStateContext</code> y <strong>no se lee en ningún lado.</strong> No hay tope para nadie. Estamos cobrando por quitar una restricción que no hemos puesto — que es exactamente el tipo de letra pequeña del que queríamos ser lo contrario.</p>
</div>

<div class="hallazgo bien">
  <span class="et">Lo que sí está bien y hay que conservar</span>
  <p>Ningún plan viene preseleccionado. La salida gratis va a 17 px, en color tinta y subrayada — no escondida en gris pequeño. Y el pie dice <em>«Se cobra hoy. Cancelas cuando quieras»</em>, sin prueba trampa ni cargo diferido. Eso es justo lo contrario del competidor de 9,99 € a la semana. <strong>Cuando rehagamos el muro, esto no se toca.</strong></p>
</div>

<div class="hallazgo">
  <span class="et">Y un error de argumento</span>
  <p>El muro abre con <em>«LA SEMANA PASADA · Presupuesto 65,00 € · Pagaste 68,40 € · Te pasaste 3,40 €»</em>, resaltado en amarillo. <strong>Le estamos enseñando al usuario que fracasó justo antes de pedirle dinero.</strong> Si la semana salió bien, el número vende solo. Si salió mal, no es el momento de cobrar.</p>
</div>

<h2><span class="n">3 · QUÉ CAPAR</span>Cobrar por el registro, no por la semana</h2>

<p>La pregunta correcta no es «qué le quito al gratis» sino <strong>qué producimos nosotros que ChatGPT no puede falsificar y que cuesta dinero real mantener</strong>. Con eso se ordenan solas las opciones:</p>

<div class="tabla-env"><table>
  <thead><tr><th>Opción</th><th>Qué pasa</th><th>Veredicto</th></tr></thead>
  <tbody>
    <tr><td class="v">Por semanas<br>(lo de hoy)</td><td>Semana 1 gratis, 2+ de pago. Pides dinero antes de que el usuario haya podido medir si ahorra, y te quedas sin ver la métrica que decide el negocio: el retorno en la semana 4.</td><td class="v no">Descartada</td></tr>
    <tr><td class="v">Precios frescos</td><td>El gratis se queda con precios congelados. Es lo que de verdad nos cuesta dinero, pero degrada en silencio: el usuario no piensa «esto es la versión gratis», piensa «esta app miente». Ataca justo la confianza que es nuestra posición.</td><td class="v no">Descartada</td></tr>
    <tr><td class="v">Nº de ajustes</td><td>Es lo que promete el muro hoy. Pero el plan se rompe el martes por diseño, y los retoques son cómo la app absorbe ese fallo. Cobrar por rehacer el martes es cobrar por cumplir nuestra propia promesa.</td><td class="v no">Descartada</td></tr>
    <tr><td class="v">El historial</td><td>Lo que presupuestaste contra lo que pagaste, semana tras semana. Cuesta cero producirlo, no lo puede tener nadie más porque son tus datos, y no toca el bucle de esta semana.</td><td class="v si">Sí</td></tr>
    <tr><td class="v">Ejes del motor</td><td>Cuadrar la semana además por calorías, por proteína mínima o por tiempo máximo de cocina. Son añadidos puros: su ausencia no empeora nada.</td><td class="v si">Sí</td></tr>
    <tr><td class="v">Escáner de ticket</td><td>Rellenar «pagaste» con una foto en vez de a mano. Ya era el plan de continuidad legal; de paso es la mejor función de pago que vamos a tener.</td><td class="v quiza">Sí, mes 3</td></tr>
  </tbody>
</table></div>

<div class="recuadro">
  <p><strong>La regla, en una frase: el bucle de esta semana es gratis para siempre; se paga por lo que se acumula.</strong></p>
  <p>Generar la semana, ver el total, ver la lista, comprar con ella y cerrarla no se capa nunca. Eso protege las reglas 2 y 5 y las tres primeras métricas. Lo de pago es el registro que crece —<em>«llevas 6 semanas: presupuestaste 390 €, pagaste 371 €»</em>— y los ejes extra del motor.</p>
</div>

<h3>Un aviso sobre el historial</h3>
<p>Ojo con una trampa que casi caigo: el motor <em>ya</em> usa <code>historial</code> y <code>SEMANAS_DE_MEMORIA</code> para no repetirte platos. Eso es calidad del producto, no una función. Si lo capamos, el gratis empieza a repetir recetas y volvemos a la degradación silenciosa de la opción 2. <strong>Se capa el libro de cuentas que se ve, nunca la memoria del motor.</strong></p>

<h3>Cuándo preguntar</h3>
<p>No en la semana 2 por calendario. <strong>La primera vez que cierras una compra y la app puede enseñarte un número real tuyo.</strong> Ahí el muro ya no argumenta, informa: «Presupuestaste 65 €. Pagaste 61,20 €.» Y si la semana salió mal, no se pregunta. Se espera a la siguiente.</p>

<h3>Sobre el precio</h3>
<p>4,99 € al mes y 34,99 € al año siguen bien: son 2,92 € al mes en el anual, quince veces más barato que los 519 €/año del competidor. Lo que falla no es la cifra, es que <strong>el muro nunca dice cuánto ahorras</strong>. Con la despensa medimos entre 2 y 8 € por semana, o sea entre 104 y 416 € al año. Ese es el argumento y no está escrito en ningún sitio de la pantalla.</p>

<hr>

<h2><span class="n">4 · CALORÍAS</span>Se puede, y no viene del súper</h2>

<p>Fui a comprobarlo antes de opinar. Tres datos:</p>

<div class="ticket">
  <span class="ticket-t">DE DÓNDE SALDRÍAN LAS CALORÍAS</span>
  <div class="fila"><b>La API de Mercadona</b><span class="guia"></span><span class="val val--mal">no las trae</span></div>
  <div class="fila"><b>Open Food Facts por EAN</b><span class="guia"></span><span class="val val--mal">9 de 93 · 10 %</span></div>
  <div class="fila"><b>Tabla de composición por ingrediente</b><span class="guia"></span><span class="val val--ok">108 números</span></div>
</div>

<p>El detalle de producto de Mercadona sí devuelve <code>nutrition_information</code>, pero dentro solo hay <code>allergens</code> e <code>ingredients</code> — el texto legal, que es justo lo que usamos para los alérgenos. <strong>La tabla nutricional no está.</strong> Y Open Food Facts, que ya consultamos por EAN como contraste, solo encontró 9 de nuestros 93 productos: la marca blanca está mal cubierta.</p>

<p>La buena noticia es que <strong>las calorías no deben venir del súper.</strong> Deben venir de una tabla de composición de alimentos, y colgar del ingrediente canónico, no del SKU. Y ahí ya tenemos el camino hecho: el canónico lleva <code>proteina_g_por_100</code> y <code>rendimiento_comestible</code>, y <code>carrito.ts:390</code> ya convierte un «por 100 g» en un «por ración» descontando hueso, espina y piel. <strong>Añadir <code>kcal_por_100</code> es exactamente la misma forma, en el mismo sitio, con las mismas pruebas.</strong> Son 108 números, se meten una vez, los revisa un humano y no vuelven a tocarse.</p>

<div class="hallazgo">
  <span class="et">Dónde está el peligro</span>
  <p>«Macros detallados» está en nuestra propia lista de lo que no se construye, y no por capricho: en cuanto aparece una kcal en pantalla, el siguiente paso es el objetivo diario, luego el anillo de progreso, luego el registro de comidas — y ahí compites con MyFitnessPal en un mercado donde tu precio real no vale nada. <strong>La app pasa de ser de dinero a ser de salud y pierde lo único que la diferencia.</strong></p>
</div>

<div class="recuadro">
  <p><strong>La regla que lo hace seguro: las calorías son una entrada, nunca un cuadro de mandos.</strong></p>
  <p>Van en Ajustes como un techo —«cuádrame la semana con 65 € <em>y</em> menos de 600 kcal por ración»— y como mucho aparecen en una línea de la hoja de receta, al lado de la proteína que ya enseñamos. Sin total diario, sin anillo, sin «te quedan 340». Si algún día alguien pide el registro de lo que ha comido, la respuesta es que no.</p>
</div>

<p>Y con esa forma, el techo de calorías es <strong>la mejor función de pago que tenemos a mano</strong>: es un añadido puro (no empeora nada por no estar), cuesta trabajo real producirlo, y es lo único que ni ChatGPT ni las apps de calorías pueden hacer — cuadrar comidas por kcal <em>y</em> por el precio real del SKU a la vez.</p>

<h2><span class="n">5 · LO SIGUIENTE</span>Otras tres, por orden de lo que aportan</h2>

<ul>
  <li><strong>Elegir el día de arranque.</strong> Hoy la semana empieza en lunes siempre, te bajes la app el martes o el sábado. Es el arreglo más barato con más efecto de todos los pendientes, y no tiene nada que ver con el pago: es que ahora mismo está mal.</li>
  <li><strong>El resumen del cierre como pantalla, no como hoja.</strong> Ya pides el importe real del ticket y ya calculas previsto contra pagado. Ese dato hoy se guarda y no se enseña nunca más. Es la materia prima del historial de pago y de la tarjeta que se comparte (métrica 5).</li>
  <li><strong>Proteína mínima por ración como segundo eje.</strong> El dato ya está en el motor y ya se usa internamente. Sacarlo a Ajustes es casi gratis y cubre a quien entrena sin meternos en el discurso de la salud.</li>
</ul>

<hr>
<p style="color:var(--gris);font-size:14px;margin-top:26px">Medido conduciendo la app en el navegador a 390×844: onboarding real, estado forzado a semana 2 sin suscripción, y navegación directa a <code>/compra</code> y <code>/semana/variante</code>. Consola limpia en las cuatro pasadas.</p>

</div>
`;

fs.writeFileSync('docs/capturas/muro-de-pago.html', html);
console.log(`${(fs.statSync('docs/capturas/muro-de-pago.html').size / 1024).toFixed(0)} KB`);
