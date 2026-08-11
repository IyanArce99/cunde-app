import { eur } from './format';
import { filasDelTicket, porPersonaYComida, porcentajeDiferencia } from './compartible';
import type { DatosCompartibles, FilaTicket } from './compartible';

/**
 * ═══ CÓMO SE HACE EL PNG · Y POR QUÉ CANVAS Y NO SVG ═══
 *
 * En el análisis dije SVG. Al implementarlo se ve que es peor, y el motivo es
 * justo el riesgo que había señalado como principal: las fuentes.
 *
 * Un `<img>` con un SVG en `data:` URI se renderiza en un contexto AISLADO que
 * NO tiene acceso a las fuentes del documento. Da igual haber esperado a
 * `document.fonts.ready`: dentro de ese SVG, Instrument Sans no existe y el
 * texto sale en la fallback del sistema. Para arreglarlo hay que incrustar el
 * woff2 en base64 dentro del propio SVG — leerlo, convertirlo, meterlo en un
 * `<defs>` y cargar con ello 20-80 KB en cada generación.
 *
 * `canvas.fillText` no tiene ese problema: dibuja con las fuentes YA CARGADAS
 * del documento. Esperando a `document.fonts.ready` una vez, la fuente está y
 * punto. Cero dependencias, cero base64, cero fallback silenciosa.
 *
 * Lo que se pierde es que el layout está escrito dos veces —aquí y en el
 * preview HTML—. Se compensa haciendo que los dos lean las MISMAS filas de
 * `filasDelTicket`: lo que puede divergir es la separación entre líneas, no lo
 * que dice el ticket.
 *
 * ═══ 1080 × 1080 ═══
 *
 * Empezó en 4:5 (1080×1350) por la regla de Instagram. Mirando el PNG de
 * verdad: la tarjeta de semana son tres líneas de ticket y una cifra, y
 * quedaban 470 px de blanco al final. No es aire, es una imagen que parece que
 * no ha terminado de cargar.
 *
 * El cuadrado le viene a este contenido y no se recorta en ningún sitio: es
 * nativo en el muro de Instagram y WhatsApp lo enseña entero. En historias, ni
 * el 4:5 ni el 1:1 llenan la pantalla, así que ahí no se perdía nada.
 *
 * El límite real de canvas en WebView de Android está muy por encima (empieza a
 * dar problemas sobre los 4096 px de lado), así que no hay riesgo de lienzo en
 * blanco por tamaño.
 */
const ANCHO = 1080;
const ALTO = 1080;
const MARGEN = 96;

/* Los mismos valores que tokens.css. No se leen de CSS a propósito: en el
   canvas no hay cascada, y una variable que no resuelve deja el texto en
   negro puro —que el sistema visual prohíbe— sin avisar. */
const PAPEL = '#F5F5F3';
const TINTA = '#17181A';
const GRIS = '#6E7075';
const ROJA = '#D93A2B';
const LINEA = '#E3E3E0';

const FAMILIA = "'Instrument Sans', system-ui, sans-serif";

/**
 * Que la fuente esté antes de dibujar.
 *
 * Sin esto, la primera vez que alguien comparte —que es justo cuando la fuente
 * puede no haber terminado de cargar— el PNG sale en Times New Roman y el
 * usuario manda por WhatsApp una imagen que no se parece a la app.
 *
 * `document.fonts.load` además fuerza la carga de los pesos concretos que usa
 * el ticket: `fonts.ready` solo espera a lo que ya se estaba cargando, y si en
 * pantalla no se ha pintado todavía nada en 700, ese peso no está.
 */
async function fuentesListas(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  await Promise.all([
    document.fonts.load(`400 40px ${FAMILIA}`),
    document.fonts.load(`500 40px ${FAMILIA}`),
    document.fonts.load(`600 40px ${FAMILIA}`),
    document.fonts.load(`700 40px ${FAMILIA}`),
  ]).catch(() => undefined);
  await document.fonts.ready;
}

interface Lapiz {
  ctx: CanvasRenderingContext2D;
  y: number;
}

function texto(l: Lapiz, s: string, opciones: {
  x?: number; peso?: number; tam: number; color?: string; alinear?: CanvasTextAlign; espaciado?: number;
}): void {
  const { ctx } = l;
  ctx.font = `${opciones.peso ?? 400} ${opciones.tam}px ${FAMILIA}`;
  ctx.fillStyle = opciones.color ?? TINTA;
  ctx.textAlign = opciones.alinear ?? 'left';
  ctx.textBaseline = 'alphabetic';
  /* `letterSpacing` no está en todos los WebView; cuando falta, el texto sale
     junto pero legible, que es una degradación aceptable. */
  ctx.letterSpacing = `${opciones.espaciado ?? 0}px`;
  ctx.fillText(s, opciones.x ?? MARGEN, l.y);
  ctx.letterSpacing = '0px';
}

/** Una fila de ticket: concepto a la izquierda, importe a la derecha. */
function fila(l: Lapiz, f: FilaTicket): void {
  if (f.clase === 'hueco') { l.y += 28; return; }
  if (f.clase === 'nota') {
    l.y += 46;
    texto(l, f.texto, { tam: 26, color: GRIS });
    return;
  }

  const esTotal = f.clase === 'total';
  if (esTotal) {
    // El filete de total del ticket: separa lo sumado de la conclusión.
    l.y += 34;
    l.ctx.strokeStyle = TINTA;
    l.ctx.lineWidth = 2;
    l.ctx.beginPath();
    l.ctx.moveTo(MARGEN, l.y);
    l.ctx.lineTo(ANCHO - MARGEN, l.y);
    l.ctx.stroke();
    l.y += 52;
  } else {
    l.y += 54;
  }

  const color = f.clase === 'total' && f.color === 'roja' ? ROJA : TINTA;
  texto(l, f.etiqueta, { tam: 26, peso: esTotal ? 600 : 500, color: esTotal ? color : GRIS, espaciado: 1.6 });
  texto(l, f.valor, {
    x: ANCHO - MARGEN,
    alinear: 'right',
    tam: esTotal ? 40 : 32,
    peso: esTotal || ('fuerte' in f && f.fuerte) ? 700 : 500,
    color,
  });
}

/** Qué cifra manda en cada tarjeta. La semana, el precio; el cierre, el acierto. */
function cifraGrande(d: DatosCompartibles): { cifra: string; rotulo: string } | null {
  if (d.tipo === 'semana') {
    const unidad = porPersonaYComida(d);
    return unidad === null ? null : { cifra: eur(unidad), rotulo: 'POR PERSONA Y COMIDA' };
  }
  const pct = porcentajeDiferencia(d);
  // Una décima: con dos, «3,15%» sugiere una precisión que el dato no tiene.
  return pct === null ? null : { cifra: `${pct.toFixed(1).replace('.', ',')}%`, rotulo: 'DE DIFERENCIA' };
}

/** Dibuja el ticket en un canvas de 1080×1080 y devuelve el PNG en base64. */
export async function pngDelTicket(d: DatosCompartibles): Promise<string> {
  await fuentesListas();

  const canvas = document.createElement('canvas');
  canvas.width = ANCHO;
  canvas.height = ALTO;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('sin contexto de canvas');

  ctx.fillStyle = PAPEL;
  ctx.fillRect(0, 0, ANCHO, ALTO);

  const l: Lapiz = { ctx, y: MARGEN + 40 };

  // La marca arriba y pequeña: el contenido es el protagonista.
  texto(l, 'cunde', { tam: 44, peso: 700 });

  l.y += 96;
  texto(l, [d.supermercado.toUpperCase(), d.rango].filter(Boolean).join(' · '), {
    tam: 26, peso: 600, color: GRIS, espaciado: 2,
  });
  l.y += 40;
  texto(l, `${d.personas} ${d.personas === 1 ? 'PERSONA' : 'PERSONAS'} · ${d.comidas} COMIDAS`, {
    tam: 26, peso: 600, color: GRIS, espaciado: 2,
  });

  l.y += 40;
  for (const f of filasDelTicket(d)) fila(l, f);

  /**
   * ═══ LA CIFRA GRANDE VA DETRÁS DEL TICKET, NO ABAJO DEL TODO ═══
   *
   * La regla de la casa dice que el euro es el elemento mayor, y aquí además es
   * lo que hace que alguien entienda la imagen en dos segundos sin leerse el
   * ticket: cuánto le sale cada comida a cada persona.
   *
   * Iba clavada al borde inferior. Mirando el PNG de verdad: con una tarjeta de
   * semana —tres líneas— quedaban 450 px en blanco ENTRE el ticket y la cifra,
   * y eso no se lee como aire, se lee como una imagen rota a la que le faltan
   * cosas en medio.
   *
   * Ahora va pegada a lo que la precede, con un hueco fijo. Todo el blanco que
   * sobre se acumula al final, que es donde un ticket de papel también lo deja
   * —la máquina corta el rollo y ya— y donde nadie busca contenido.
   *
   * De paso, esto y la previsualización quedan en el mismo orden: allí la cifra
   * también sigue a la última fila. Antes eran dos composiciones distintas
   * diciendo lo mismo, que es la mitad de la promesa de una previsualización.
   */
  const grande = cifraGrande(d);
  if (grande) {
    l.y += 190;
    texto(l, grande.cifra, { tam: 128, peso: 700 });
    l.y += 46;
    texto(l, grande.rotulo, { tam: 26, peso: 600, color: GRIS, espaciado: 2 });
  }

  // El filete y la firma. Discreta: hace la imagen atribuible sin convertirla
  // en un anuncio, que es la diferencia entre que la compartan y que no.
  l.y = ALTO - MARGEN - 54;
  ctx.strokeStyle = LINEA;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(MARGEN, l.y);
  ctx.lineTo(ANCHO - MARGEN, l.y);
  ctx.stroke();
  l.y += 44;
  texto(l, 'Hecho con Cunde', { tam: 26, color: GRIS });

  // Sin la cabecera `data:`: es lo que quiere Filesystem de Capacitor.
  return canvas.toDataURL('image/png').split(',')[1];
}
