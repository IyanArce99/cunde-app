import type { Ranura } from '../state/types';

/**
 * La elección de platos ya no vive aquí: la hace el motor
 * (src/motor/seleccionar.ts) por coste marginal, con el catálogo real
 * delante. Lo que queda es el vocabulario que necesita la pantalla.
 */

export const PLATO_LIBRE_NOMBRE = 'No cocinas: aprovecha lo que tengas';

const NOMBRES_DIA: Record<string, string> = {
  LUN: 'Lunes',
  MAR: 'Martes',
  MIÉ: 'Miércoles',
  JUE: 'Jueves',
  VIE: 'Viernes',
  SÁB: 'Sábado',
  DOM: 'Domingo',
};

export function nombreDiaCompleto(abreviatura: string): string {
  return NOMBRES_DIA[abreviatura] ?? abreviatura;
}

/**
 * La inicial de cada día como se escribe en España: L M X J V S D.
 *
 * La X del miércoles no es un capricho ni una errata: martes y miércoles
 * empiezan igual, y el calendario español lleva un siglo resolviéndolo con la
 * X. Cogiendo la primera letra salían dos "M" seguidas en la gráfica de la
 * semana y no había forma de saber cuál era cuál.
 */
const INICIALES_DIA: Record<string, string> = {
  LUN: 'L', MAR: 'M', 'MIÉ': 'X', JUE: 'J', VIE: 'V', 'SÁB': 'S', DOM: 'D',
};

export function inicialDeDia(abreviatura: string): string {
  return INICIALES_DIA[abreviatura] ?? abreviatura.charAt(0);
}

export function nombreRanura(ranura: Ranura): string {
  return ranura === 'comida' ? 'comida' : 'cena';
}
