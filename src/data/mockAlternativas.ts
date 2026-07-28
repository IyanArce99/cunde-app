import type { Plato } from '../state/types';

/**
 * Pool de platos candidatos para "Cambiar plato" y "Bájame el precio".
 * `dia` va vacío: se rellena con el día que se está sustituyendo.
 */
export const platosAlternativos: Omit<Plato, 'dia'>[] = [
  { nombre: 'Garbanzos con espinacas', minutos: 30, precioRacion: 3.60 },
  { nombre: 'Salmón al vapor con patata', minutos: 25, precioRacion: 6.20 },
  { nombre: 'Wok de verduras y pollo', minutos: 25, precioRacion: 4.40 },
  { nombre: 'Sopa de fideos', minutos: 15, precioRacion: 2.10 },
  { nombre: 'Ensalada de pasta', minutos: 15, precioRacion: 2.90 },
  { nombre: 'Judías verdes con patata', minutos: 35, precioRacion: 2.60 },
  { nombre: 'Pisto con huevo', minutos: 30, precioRacion: 3.10 },
  { nombre: 'Albóndigas con tomate', minutos: 40, precioRacion: 4.75 },
  { nombre: 'Puré de patata y puerro', minutos: 25, precioRacion: 2.30 },
  { nombre: 'Revuelto de champiñones', minutos: 15, precioRacion: 2.55 },
];
