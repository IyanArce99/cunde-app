import { eur, eurConSigno, fechaCorta } from './format';
import { sumarDias } from './fechas';
import type { FechaDia } from './fechas';

/**
 * ═══ LO QUE SE COMPARTE ═══
 *
 * Un objeto plano, construido por una función pura, que NO conoce `AppState`.
 *
 * Eso no es limpieza por gusto: es lo que garantiza que la tarjeta no pueda
 * enseñar nada que el usuario no haya decidido compartir. Si el componente
 * recibiera el estado entero, bastaría con que alguien escribiera
 * `{estado.perfil.codigoPostal}` para que un código postal saliera en una
 * imagen que se manda por WhatsApp. Con esta forma, para filtrar un dato
 * privado hay que añadirlo aquí a propósito.
 *
 * ═══ LO QUE NO ENTRA, Y ESTÁ DECIDIDO ═══
 *
 * Código postal, almacén, exclusiones y alergias, nombres de platos, ids de
 * receta o de SKU, historial, despensa, contadores. Nada de eso está en esta
 * interfaz y hay un test que lo comprueba sobre las claves del objeto.
 */
export type TipoCompartible = 'semana' | 'resultado';

export interface DatosCompartibles {
  tipo: TipoCompartible;
  /** La cadena, que es pública: sale en la portada de la app. */
  supermercado: string;
  personas: number;
  comidas: number;
  /** «7–13 AGO». `null` en semanas anteriores a las fechas: no se inventa. */
  rango: string | null;

  /** El tope de la semana. Solo en la tarjeta de semana. */
  presupuesto?: number;
  /**
   * EL CARRITO, no el consumo.
   *
   * Es lo que pasa por caja, que es lo que el usuario compara con su ticket y
   * con lo que gastó la semana pasada. El «€ ración» de la pantalla Semana es
   * consumo y NO vale aquí: son dos cifras parecidas con nombres parecidos, y
   * mezclarlas es el error que este proyecto lleva evitando desde el principio.
   */
  menu: number;

  /** Solo si hay extras CON precio. `undefined` si no hay ninguno. */
  extras?: number;
  /** Cuántos extras no tienen precio. Invalida la comparación. */
  extrasSinPrecio?: number;

  /** Lo que marcó el ticket. Solo en la tarjeta de resultado. */
  ticket?: number;
}

/** Cuánto sale cada comida de cada persona. El carrito, repartido. */
export function porPersonaYComida(d: DatosCompartibles): number | null {
  if (d.personas <= 0 || d.comidas <= 0) return null;
  const total = d.menu + (d.extras ?? 0);
  if (!Number.isFinite(total) || total <= 0) return null;
  return total / d.personas / d.comidas;
}

/** Lo que se contaba antes de ir al súper: menú más los extras que tenían precio. */
export function totalPrevisto(d: DatosCompartibles): number {
  return d.menu + (d.extras ?? 0);
}

/**
 * ═══ CUÁNDO SE PUEDE COMPARAR, Y CUÁNDO NO ═══
 *
 * Con extras sin precio NO se puede. Si el ticket marca 4,70 € más y hay dos
 * cosas cuyo precio nadie conoce, no hay forma de saber si Cunde falló, si el
 * champú costaba 4,70 € o las dos cosas a medias.
 *
 * Enseñar «DIFERENCIA +4,70 €» ahí sería atribuirle a Cunde un error que nadie
 * ha medido — y encima en una imagen que el usuario va a mandar a otra gente.
 * La misma regla que ya gobierna el cierre de semana.
 */
export function sePuedeComparar(d: DatosCompartibles): boolean {
  return d.tipo === 'resultado'
    && typeof d.ticket === 'number'
    && Number.isFinite(d.ticket)
    && (d.extrasSinPrecio ?? 0) === 0
    && totalPrevisto(d) > 0;
}

/** Ticket menos previsto. Positivo: el ticket fue mayor. */
export function diferencia(d: DatosCompartibles): number | null {
  if (!sePuedeComparar(d)) return null;
  return d.ticket! - totalPrevisto(d);
}

/**
 * El porcentaje, en absoluto: el signo ya lo lleva la fila de la diferencia y
 * repetirlo lo convierte en dos afirmaciones sobre lo mismo.
 *
 * `null` cuando no se puede comparar y también cuando el previsto es 0 — sin
 * eso sería una división entre cero disfrazada de `Infinity` y saldría un
 * «Infinity% DE DIFERENCIA» en una imagen pública.
 */
export function porcentajeDiferencia(d: DatosCompartibles): number | null {
  const dif = diferencia(d);
  if (dif === null) return null;
  const previsto = totalPrevisto(d);
  if (previsto <= 0) return null;
  return Math.abs(dif) / previsto * 100;
}

/**
 * ═══ EL RANGO DE FECHAS ═══
 *
 *     7–13 AGO        dentro del mismo mes
 *     28 AGO – 3 SEP  cruzando de mes
 *     29 DIC – 4 ENE  cruzando de año
 *
 * Sin año NUNCA, ni siquiera al cruzarlo: son siete días consecutivos y el año
 * no distingue nada que el usuario no sepa. Poner «29 DIC 2026 – 4 ENE 2027»
 * en una tarjeta que se mira dos segundos es gastar la línea en lo único que
 * sobra.
 *
 * `null` si la semana no sabe qué días representa — las generadas antes de que
 * la app tuviera fechas. No se inventa un rango.
 */
export function rangoDeSemana(inicio: FechaDia | null, dias = 7): string | null {
  if (!inicio) return null;
  const fin = sumarDias(inicio, dias - 1);
  const [, mesA] = inicio.split('-');
  const [, mesB] = fin.split('-');
  // Mismo mes: el mes se dice una vez. «7–13 AGO».
  if (mesA === mesB) return `${Number(inicio.split('-')[2])}–${fechaCorta(fin)}`;
  return `${fechaCorta(inicio)} – ${fechaCorta(fin)}`;
}

/**
 * ═══ EL TICKET, EN FILAS ═══
 *
 * Una sola descripción que consumen los DOS renderizadores: el preview en HTML
 * —que es accesible y vive dentro de la app— y el canvas que produce el PNG.
 *
 * Sin esto habría dos sitios donde decidir qué filas salen y en qué orden, y el
 * día que alguien tocara uno la imagen compartida diría algo distinto de lo que
 * el usuario acaba de ver en la previsualización. Eso es exactamente el fallo
 * que este proyecto no se puede permitir: aquí los dos leen de la misma lista.
 */
export type FilaTicket =
  | { clase: 'dato'; etiqueta: string; valor: string; fuerte?: boolean }
  | { clase: 'total'; etiqueta: string; valor: string; color?: 'roja' }
  | { clase: 'nota'; texto: string }
  | { clase: 'hueco' };

export function filasDelTicket(d: DatosCompartibles): FilaTicket[] {
  const filas: FilaTicket[] = [];
  const money = (n: number) => eur(n);

  if (d.tipo === 'semana') {
    if (typeof d.presupuesto === 'number') {
      filas.push({ clase: 'dato', etiqueta: 'PRESUPUESTO', valor: money(d.presupuesto) });
    }
    filas.push({ clase: 'dato', etiqueta: 'CESTA', valor: money(d.menu) });
    if (typeof d.presupuesto === 'number') {
      const sobra = d.presupuesto - d.menu;
      /* «TE PASAS» sin dramatismo y sin rojo por defecto: pasarse del tope no
         es un fracaso del usuario y esta imagen se va a compartir. El rojo se
         reserva a que además sea una cantidad que importe. */
      filas.push({
        clase: 'total',
        etiqueta: sobra >= 0 ? 'TE SOBRAN' : 'TE PASAS',
        valor: money(Math.abs(sobra)),
        ...(sobra < 0 ? { color: 'roja' as const } : {}),
      });
    }
    return filas;
  }

  // Resultado. Con extras, las tres filas separadas; sin ellos, la versión
  // simple. Nunca «EXTRAS 0,00 €»: una fila que dice que no pasa nada.
  const hayExtras = (d.extras ?? 0) > 0 || (d.extrasSinPrecio ?? 0) > 0;
  filas.push({ clase: 'dato', etiqueta: hayExtras ? 'MENÚ' : 'PREVISTO', valor: money(d.menu) });
  if (hayExtras) {
    filas.push({
      clase: 'dato',
      etiqueta: (d.extrasSinPrecio ?? 0) > 0 ? 'EXTRAS CON PRECIO' : 'EXTRAS',
      valor: money(d.extras ?? 0),
    });
    filas.push({ clase: 'dato', etiqueta: 'TOTAL PREVISTO', valor: money(totalPrevisto(d)), fuerte: true });
  }
  if (typeof d.ticket === 'number') {
    filas.push({ clase: 'dato', etiqueta: 'TICKET', valor: money(d.ticket) });
  }

  const dif = diferencia(d);
  if (dif !== null) {
    filas.push({ clase: 'total', etiqueta: 'DIFERENCIA', valor: eurConSigno(dif) });
  } else if ((d.extrasSinPrecio ?? 0) > 0) {
    /* Sin diferencia y dicho por qué. Callarlo dejaría al que mira la imagen
       sumando por su cuenta y concluyendo que Cunde falló esa cantidad. */
    const n = d.extrasSinPrecio ?? 0;
    filas.push({ clase: 'hueco' });
    filas.push({
      clase: 'nota',
      texto: `${n} ${n === 1 ? 'extra' : 'extras'} sin precio, así que no comparo`,
    });
  }
  return filas;
}

/**
 * A qué distancia quedó el ticket, en tramos.
 *
 * Para la analítica, y en tramos y no en euros a propósito: para saber si Cunde
 * acierta no hace falta saber cuánto gastó nadie, y un importe exacto junto a
 * un número de semana empieza a parecerse a un dato personal.
 */
export function tramoDeDiferencia(d: DatosCompartibles): string | null {
  const pct = porcentajeDiferencia(d);
  if (pct === null) return null;
  if (pct < 2) return '0-2';
  if (pct < 5) return '2-5';
  if (pct < 10) return '5-10';
  return '10+';
}
