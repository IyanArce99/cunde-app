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
