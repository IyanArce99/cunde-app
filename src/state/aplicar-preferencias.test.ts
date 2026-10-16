/**
 * ═══ «APLICAR AL MENÚ» ═══
 *
 * Valorar no regenera (ver valorar.test.ts). Esta es la otra mitad: los «me
 * gusta» quedan pendientes y entran cuando el usuario lo pide, sin tocar el
 * presupuesto y nunca con la compra empezada.
 */
import { describe, expect, it } from 'vitest';
import { compraEmpezada, estadoParaTests, preferenciasPendientes, reducer } from './AppStateContext';
import { datos, generarParaApp } from '../data/motor';
import type { AppState } from './types';

function conSemana(): AppState {
  window.localStorage.clear();
  const base = estadoParaTests();
  const semana = generarParaApp(base.perfil, base.preferencias);
  return {
    ...base,
    onboardingCompletado: true,
    semana: { plan: semana.plan, dias: semana.dias, generadaEn: 1754000000000, fechaInicio: '2026-08-07' },
    lista: semana.lista,
  };
}

/** Un plato que no está en la semana: marcarlo no puede cambiar nada hasta aplicar. */
function platoFuera(e: AppState): string {
  const dentro = new Set(e.semana.plan.huecos.map((h) => h.recetaId));
  return datos.recetas.find((r) => !dentro.has(r.id))!.id;
}

describe('aplicar las preferencias al menú', () => {
  it('marcar «me gusta» deja la semana igual y la marca como pendiente', () => {
    const antes = conSemana();
    expect(preferenciasPendientes(antes)).toBe(false);
    const despues = reducer(antes, { type: 'VALORAR_PLATO', platoId: platoFuera(antes), valoracion: 'me_gusta', tipo: 'receta' });
    expect(despues.semana).toBe(antes.semana);
    expect(despues.lista).toBe(antes.lista);
    expect(preferenciasPendientes(despues)).toBe(true);
  });

  it('desmarcarlo quita lo pendiente', () => {
    let e = conSemana();
    const id = platoFuera(e);
    e = reducer(e, { type: 'VALORAR_PLATO', platoId: id, valoracion: 'me_gusta', tipo: 'receta' });
    e = reducer(e, { type: 'VALORAR_PLATO', platoId: id, valoracion: 'neutral', tipo: 'receta' });
    expect(preferenciasPendientes(e)).toBe(false);
  });

  it('aplicar rehace la semana, deja de estar pendiente y no toca el presupuesto', () => {
    let e = conSemana();
    e = reducer(e, { type: 'VALORAR_PLATO', platoId: platoFuera(e), valoracion: 'me_gusta', tipo: 'receta' });
    const aplicada = reducer(e, { type: 'APLICAR_PREFERENCIAS_PLATOS' });
    expect(aplicada.semana).not.toBe(e.semana);
    expect(preferenciasPendientes(aplicada)).toBe(false);
    expect(aplicada.perfil.presupuestoSemanal).toBe(e.perfil.presupuestoSemanal);
    expect(aplicada.preferencias).toEqual(e.preferencias);
    expect(aplicada.cambiosDePlato).toEqual(e.cambiosDePlato);
  }, 60000);

  it('con la compra empezada no rehace nada', () => {
    let e = conSemana();
    e = reducer(e, { type: 'VALORAR_PLATO', platoId: platoFuera(e), valoracion: 'me_gusta', tipo: 'receta' });
    e = reducer(e, { type: 'TOGGLE_ITEM', id: e.lista[0].id });
    expect(compraEmpezada(e)).toBe(true);
    expect(reducer(e, { type: 'APLICAR_PREFERENCIAS_PLATOS' })).toBe(e);
  });

  it('sin nada pendiente, aplicar no hace nada', () => {
    const e = conSemana();
    expect(reducer(e, { type: 'APLICAR_PREFERENCIAS_PLATOS' })).toBe(e);
  });
});
