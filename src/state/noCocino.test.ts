/**
 * «No cocino este día» por el camino de la app: reducer, lista de la compra,
 * postres y lo que queda al recargar (el plan guardado se rehidrata y el
 * carrito se vuelve a calcular desde él). Las reglas del motor se prueban en
 * src/motor/noCocino.test.ts; aquí, que la app las respeta de punta a punta.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { reducer, estadoParaTests } from './AppStateContext';
import { generarParaApp, hidratar } from '../data/motor';
import { totalLista } from '../lib/derive';
import type { AppState } from './types';

function conSemana(postre: boolean): AppState {
  window.localStorage.clear();
  const base = estadoParaTests();
  const perfil = { ...base.perfil, fechaInicioSemana: '2026-10-12', codigoPostal: '28001', comensales: '3' as const, presupuestoSemanal: 80 };
  const preferencias = { ...base.preferencias, variedadElegida: true, postre };
  const semana = generarParaApp(perfil, preferencias);
  return {
    ...base, perfil, preferencias, onboardingCompletado: true,
    semana: { plan: semana.plan, dias: semana.dias, generadaEn: Date.now(), fechaInicio: '2026-10-12' },
    lista: semana.lista,
  };
}

const retocar = (e: AppState, i: number, retoque: 'libre' | 'cocinar') => {
  const h = e.semana.plan.huecos[i];
  return reducer(e, { type: 'RETOCAR_HUECO', dia: h.dia, ranura: h.ranura, retoque });
};

beforeEach(() => window.localStorage.clear());

describe('no cocino en la app', () => {
  it.each([false, true])('con postre=%s: ningún hueco sube la lista, y al recargar sale lo mismo', (postre) => {
    const antes = conSemana(postre);
    for (let i = 0; i < antes.semana.plan.huecos.length; i++) {
      const e = retocar(antes, i, 'libre');
      expect(totalLista(e.lista), `hueco ${i}`).toBeLessThanOrEqual(totalLista(antes.lista) + 0.005);
      expect(e.semana.plan.huecos[i].tipo).toBe('libre');
      // Recargar: el carrito sale del plan guardado y tiene que coincidir.
      const recargado = hidratar(e.semana.plan, 3, e.preferencias.exclusiones, e.preferencias.proteina, e.despensa, postre);
      expect(recargado.carrito.totalCarrito, `hueco ${i}`).toBeCloseTo(totalLista(e.lista), 2);
    }
  });

  it('el día libre no enseña postre y su postre no se compra', () => {
    const antes = conSemana(true);
    const e = retocar(antes, 2, 'libre');
    const dia = e.semana.dias.find((d) => d.dia === e.semana.plan.huecos[2].dia)!;
    expect(dia[e.semana.plan.huecos[2].ranura]).toBeNull();
    const unidades = (s: AppState) => s.lista.filter((it) => it.paraPlato === 'el postre').reduce((a, it) => a + it.precio, 0);
    expect(unidades(e)).toBeLessThanOrEqual(unidades(antes));
  });

  it('«Cocino» devuelve una comida a ese hueco sin tocar los demás', () => {
    const antes = conSemana(false);
    const libre = retocar(antes, 6, 'libre');
    const vuelta = retocar(libre, 6, 'cocinar');
    expect(vuelta.semana.plan.huecos[6].tipo).toBe('cocinado');
    vuelta.semana.plan.huecos.forEach((h, k) => {
      if (k !== 6) expect(`${h.tipo}:${h.recetaId}`).toBe(`${libre.semana.plan.huecos[k].tipo}:${libre.semana.plan.huecos[k].recetaId}`);
    });
  });
});
