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

export function nombreRanura(ranura: Ranura): string {
  return ranura === 'comida' ? 'comida' : 'cena';
}
