import type { Plato } from '../state/types';
import { platosAlternativos } from '../data/mockAlternativas';

function disponibles(semanaActual: Plato[]): Omit<Plato, 'dia'>[] {
  const usados = new Set(semanaActual.map((p) => p.nombre));
  return platosAlternativos.filter((p) => !usados.has(p.nombre));
}

/** Otra opción de esfuerzo parecido (± 10 min), al azar. */
export function otroPlatoParecido(semanaActual: Plato[], actual: Plato): Omit<Plato, 'dia'> | null {
  const opciones = disponibles(semanaActual);
  const parecidos = opciones.filter((p) => Math.abs(p.minutos - actual.minutos) <= 10);
  const lista = parecidos.length > 0 ? parecidos : opciones;
  if (lista.length === 0) return null;
  return lista[Math.floor(Math.random() * lista.length)];
}

/** La opción más barata disponible que cueste menos que el plato actual. */
export function platoMasBarato(semanaActual: Plato[], actual: Plato): Omit<Plato, 'dia'> | null {
  const opciones = disponibles(semanaActual).filter((p) => p.precioRacion < actual.precioRacion);
  if (opciones.length === 0) return null;
  return opciones.reduce((min, p) => (p.precioRacion < min.precioRacion ? p : min), opciones[0]);
}

/** Elige otro día de la semana (no el de origen) para darle un plato nuevo. */
export function elegirDiaParaReorganizar(
  platos: Plato[],
  diaOrigen: string,
): { diaDestino: Plato; nuevoPlato: Omit<Plato, 'dia'> } | null {
  const candidatosDia = platos.filter((p) => p.dia !== diaOrigen && p.precioRacion > 0);
  if (candidatosDia.length === 0) return null;
  const diaDestino = candidatosDia[Math.floor(Math.random() * candidatosDia.length)];
  const opciones = disponibles(platos);
  if (opciones.length === 0) return null;
  const nuevoPlato = opciones[Math.floor(Math.random() * opciones.length)];
  return { diaDestino, nuevoPlato };
}

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
