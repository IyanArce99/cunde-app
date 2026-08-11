import { nombreDeDia } from './fechas';
import { nombreDiaCompleto } from './menu';

export function eur(n: number, decimals = 2): string {
  /**
   * Espacio DURO entre la cifra y el símbolo (U+00A0), no uno normal.
   *
   * Con el normal, el euro se queda huérfano en la línea siguiente en cuanto
   * la columna se estrecha: en las tarjetas de proteína salía "tiras 1,45" y
   * debajo "€ · 50,42 €". Una app cuyo elemento principal es una cifra en
   * euros no se puede permitir partir la cifra del símbolo, y pasa en
   * cualquier caja estrecha, así que se arregla aquí y no caja por caja.
   *
   * Es además lo que manda la ortografía española: el símbolo va detrás, con
   * espacio, y ese espacio no se parte.
   */
  return n.toFixed(decimals).replace('.', ',') + ' €';
}

/**
 * La cifra SIN el símbolo, para cuando la pantalla pinta el € aparte.
 *
 * Existe porque hacerlo quitándoselo a `eur()` con un `replace(' €','')` no
 * funciona: el espacio de `eur()` es duro (U+00A0) y la sustitución falla en
 * silencio. En la portada eso salía como "63,89 €€" — la cifra más grande de
 * la app con el símbolo repetido.
 */
export function eurSinSimbolo(n: number, decimals = 2): string {
  return n.toFixed(decimals).replace('.', ',');
}

export function eurConSigno(n: number, decimals = 2): string {
  // Con umbral, no con `n < 0`: un -1e-9 de acumular flotantes se pintaba
  // como "−0,00 €", que le dice al usuario que ha ahorrado cero coma nada.
  const umbral = 0.5 * 10 ** -decimals;
  let signo = '';
  if (n > umbral) signo = '+';
  else if (n < -umbral) signo = '−';
  return signo + eur(Math.abs(n), decimals);
}

/**
 * Fecha corta, como en un ticket: "28 JUL". Con el mes entero la cabecera del
 * rollo se partía en dos líneas a 360 px, y una impresora térmica tampoco
 * escribe "julio".
 */
const MESES_CORTOS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

export function fechaCorta(iso: string): string {
  const [, mes, dia] = iso.split('-');
  return `${Number(dia)} ${MESES_CORTOS[Number(mes) - 1]}`;
}

/**
 * ═══ EL DÍA DE LA SEMANA CON SU FECHA ═══
 *
 *     VIE · 7 AGO
 *
 * Sin año, y no es un olvido: la semana son siete días consecutivos que el
 * usuario está mirando ahora, así que el año no distingue nada y ocupa cuatro
 * caracteres en una cabecera de tarjeta que ya va justa. Se recupera en el
 * `aria-label`, que sí lo dice entero para quien no ve la pantalla.
 *
 * Y no «Viernes, 7 de agosto de 2026»: en una tarjeta de 342 px eso parte en
 * dos líneas y deja de ser un rótulo de ticket para ser una frase.
 */
export function diaConFecha(iso: string): string {
  return `${nombreDeDia(iso)} · ${fechaCorta(iso)}`;
}

/** «VIE 7» — para donde no cabe el mes: la cabecera de la hoja del día. */
export function diaCortoConNumero(iso: string): string {
  return `${nombreDeDia(iso)} ${Number(iso.split('-')[2])}`;
}

const MESES_LARGOS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/**
 * «viernes, 7 de agosto de 2026». SOLO para lectores de pantalla.
 *
 * En pantalla no cabe y no hace falta; leído en voz alta, «VIE · 7 AGO» suena a
 * «vie punto siete ago» y no dice nada. Es la misma información dicha para el
 * medio en que se recibe, no una versión de repuesto.
 */
export function fechaParaLeer(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number);
  return `${nombreDiaCompleto(nombreDeDia(iso)).toLowerCase()}, ${d} de ${MESES_LARGOS[m - 1]} de ${a}`;
}
