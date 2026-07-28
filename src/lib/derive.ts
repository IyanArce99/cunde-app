import { numComensales } from '../state/types';
import type { Comensales, ItemLista, Plato } from '../state/types';

export function totalPrevisto(platos: Plato[], comensales: Comensales): number {
  const n = numComensales(comensales);
  return platos.reduce((sum, p) => sum + p.precioRacion * n, 0);
}

export function costePersonaDia(total: number, comensales: Comensales): number {
  return total / 7 / numComensales(comensales);
}

export function costePorPlato(presupuesto: number, comensales: Comensales): number {
  return presupuesto / 14 / numComensales(comensales);
}

/**
 * Suelo defendible para una dieta básica en España (legumbre, pasta, arroz,
 * huevo). Por debajo de esto no hay semana que cuadre, sea cual sea el menú:
 * hay que detectarlo al soltar el deslizador, no dejar que se genere una
 * semana imposible y mentir en la pantalla de después.
 */
const COSTE_MINIMO_PERSONA_DIA = 3;

export function presupuestoMinimoViable(comensales: Comensales): number {
  return Math.ceil(7 * numComensales(comensales) * COSTE_MINIMO_PERSONA_DIA);
}

export function totalLista(lista: ItemLista[]): number {
  return lista.reduce((sum, it) => sum + it.precio, 0);
}

export function totalLlevas(lista: ItemLista[]): number {
  return lista.reduce((sum, it) => (it.marcado ? sum + it.precio : sum), 0);
}

export function subtotalPasillo(lista: ItemLista[], pasillo: string): number {
  return lista.filter((it) => it.pasillo === pasillo).reduce((sum, it) => sum + it.precio, 0);
}

export function pasillosOrdenados(lista: ItemLista[]): string[] {
  const vistos = new Set<string>();
  const orden: string[] = [];
  for (const it of lista) {
    if (!vistos.has(it.pasillo)) {
      vistos.add(it.pasillo);
      orden.push(it.pasillo);
    }
  }
  return orden;
}

const SIETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Nº de semana real, sin depender solo de que el usuario cierre la compra
 * (paso que el propio producto marca como saltable). Si han pasado 7+ días
 * desde que se generó la semana en curso, se considera semana 2+ igualmente.
 */
export function semanaEfectiva(semanaNumero: number, generadaEn: number): number {
  if (!generadaEn) return semanaNumero;
  const semanasPorTiempo = 1 + Math.floor((Date.now() - generadaEn) / SIETE_DIAS_MS);
  return Math.max(semanaNumero, semanasPorTiempo);
}
