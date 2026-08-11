/**
 * ═══ CAMBIAR LA FECHA NO TOCA LA SEMANA ═══
 *
 * Es la promesa central de esta funcionalidad: lo único que cambia es qué días
 * son. Ni los platos, ni la lista, ni las marcas, ni la despensa, ni el total.
 * Si algo de eso se moviera, el usuario perdería una compra que a lo mejor ya
 * ha hecho por cambiar una etiqueta.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reducer, estadoParaTests } from './AppStateContext';
import { generarParaApp } from '../data/motor';
import { totalLista } from '../lib/derive';
import { hoy, sumarDias } from '../lib/fechas';
import type { AppState } from './types';

const V14 = {
  onboardingCompletado: true,
  perfil: { comensales: '2', super: 'Mercadona', presupuestoSemanal: 65, codigoPostal: '28001', almacen: null },
  preferencias: {
    comidas: 'ambas', esfuerzo: 'libre', variedad: 'normal', variedadElegida: true,
    proteina: 'normal', exclusiones: [], postre: false,
  },
  semana: { plan: { tandas: [], huecos: [] }, dias: [], generadaEn: 1754000000000 },
  historial: [['lentejas'], ['garbanzos']],
  preferenciasPlatos: { r1: { platoId: 'r1', valoracion: 'no_quiero', actualizadaEn: '2026-08-07T10:00:00.000Z' } },
  extrasCompra: [{ id: 'a', nombre: 'Café', precio: null, marcado: true, creadoEn: '2026-08-07T10:00:00.000Z' }],
  despensa: { '12345': { unidades: 2, semanas: 1 } },
  lista: [],
  sinCobertura: null,
  salidaPresupuesto: null,
  cierre: { importeRealTicket: null, guardada: false },
  suscripcion: null,
  huboSuscripcion: false,
  contadores: { semanaNumero: 4, ajustesEstaSemana: 1, semanaVistaGratis: 3, bajadoConRetoques: 2.5 },
  deshacerCierre: null,
};

function conSemana(): AppState {
  window.localStorage.clear();
  const base = estadoParaTests();
  const semana = generarParaApp(base.perfil, base.preferencias);
  return {
    ...base,
    onboardingCompletado: true,
    semana: { plan: semana.plan, dias: semana.dias, generadaEn: 1754000000000, fechaInicio: base.perfil.fechaInicioSemana },
    lista: semana.lista.map((it, i) => (i === 0 ? { ...it, enElCarro: true } : it)),
  };
}

beforeEach(() => window.localStorage.clear());
afterEach(() => { vi.useRealTimers(); });

describe('cambiar el día de inicio', () => {
  it('guarda la preferencia Y la fecha de la semana de delante', () => {
    const e = reducer(conSemana(), { type: 'SET_INICIO_SEMANA', fecha: '2026-09-15', origen: 'elegida' });
    expect(e.perfil.fechaInicioSemana).toBe('2026-09-15');
    expect(e.semana.fechaInicio).toBe('2026-09-15');
  });

  it('═══ NO REGENERA: los platos son los mismos, en el mismo orden ═══', () => {
    const antes = conSemana();
    const e = reducer(antes, { type: 'SET_INICIO_SEMANA', fecha: '2026-09-15', origen: 'elegida' });
    // Identidad, no igualdad: el plan ni siquiera se reconstruye.
    expect(e.semana.plan).toBe(antes.semana.plan);
    expect(e.semana.dias).toBe(antes.semana.dias);
  });

  it('no toca el total, ni la lista, ni las marcas', () => {
    const antes = conSemana();
    const menu = totalLista(antes.lista);
    const e = reducer(antes, { type: 'SET_INICIO_SEMANA', fecha: '2026-09-15', origen: 'elegida' });
    expect(totalLista(e.lista)).toBe(menu);
    expect(e.lista).toBe(antes.lista);
    expect(e.lista[0].enElCarro).toBe(true);
  });

  it('ni la despensa, ni el historial, ni las preferencias, ni los extras', () => {
    const antes = { ...conSemana(), historial: [['x']] };
    const e = reducer(antes, { type: 'SET_INICIO_SEMANA', fecha: '2026-09-15', origen: 'elegida' });
    expect(e.despensa).toBe(antes.despensa);
    expect(e.historial).toBe(antes.historial);
    expect(e.preferencias).toBe(antes.preferencias);
    expect(e.preferenciasPlatos).toBe(antes.preferenciasPlatos);
    expect(e.extrasCompra).toBe(antes.extrasCompra);
    expect(e.contadores).toBe(antes.contadores);
  });

  it('el presupuesto no se mueve', () => {
    const antes = conSemana();
    const e = reducer(antes, { type: 'SET_INICIO_SEMANA', fecha: '2026-09-15', origen: 'elegida' });
    expect(e.perfil.presupuestoSemanal).toBe(antes.perfil.presupuestoSemanal);
  });

  it('una fecha imposible no cambia nada', () => {
    const antes = conSemana();
    expect(reducer(antes, { type: 'SET_INICIO_SEMANA', fecha: '2026-02-30', origen: 'elegida' })).toBe(antes);
    expect(reducer(antes, { type: 'SET_INICIO_SEMANA', fecha: 'mañana', origen: 'elegida' })).toBe(antes);
  });

  it('poner la que ya estaba no cambia el estado', () => {
    const antes = conSemana();
    const igual = { type: 'SET_INICIO_SEMANA' as const, fecha: antes.perfil.fechaInicioSemana, origen: 'hoy' as const };
    expect(reducer(antes, igual)).toBe(antes);
  });
});

describe('la semana activa conserva SU fecha', () => {
  it('aunque la preferencia cambie después, al generar la siguiente', () => {
    /* Se cambia la fecha, se regenera con otra preferencia, y la semana nueva
       lleva la nueva. Lo que no puede pasar es que una semana ya generada
       cambie de días por detrás. */
    let e = reducer(conSemana(), { type: 'SET_INICIO_SEMANA', fecha: '2026-09-15', origen: 'elegida' });
    expect(e.semana.fechaInicio).toBe('2026-09-15');

    e = reducer(e, { type: 'SET_PREFERENCIAS', preferencias: { ...e.preferencias, postre: true } });
    // La semana recién generada lleva la fecha que había puesta al generarla.
    expect(e.semana.fechaInicio).toBe('2026-09-15');
  });
});

describe('al cerrar la semana', () => {
  it('en caliente, la siguiente empieza donde acababa la anterior', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 13, 10, 0)); // el último día de la semana
    let e: AppState = { ...conSemana(), semana: { ...conSemana().semana, fechaInicio: '2026-08-07' } };
    e = reducer(e, { type: 'GUARDAR_CIERRE', importeRealTicket: 61.2 });
    // Cerrar no regenera: la siguiente se monta al pasar el muro.
    e = reducer(e, { type: 'SEGUIR_GRATIS', numeroSemana: e.contadores.semanaNumero });
    expect(e.perfil.fechaInicioSemana).toBe('2026-08-14');
  });

  it('si vuelve días después, empieza HOY y no en una semana que ya pasó', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 22, 10, 0)); // vuelve el 22
    let e: AppState = { ...conSemana(), semana: { ...conSemana().semana, fechaInicio: '2026-08-07' } };
    e = reducer(e, { type: 'GUARDAR_CIERRE', importeRealTicket: 61.2 });
    e = reducer(e, { type: 'SEGUIR_GRATIS', numeroSemana: e.contadores.semanaNumero });
    // El 14 de agosto ya pasó: proponerlo sería planificar el pasado.
    expect(e.perfil.fechaInicioSemana).toBe('2026-08-22');
  });

  it('y la semana guardada conserva la suya para poder deshacer', () => {
    const antes: AppState = { ...conSemana(), semana: { ...conSemana().semana, fechaInicio: '2026-08-07' } };
    let e = reducer(antes, { type: 'GUARDAR_CIERRE', importeRealTicket: 61.2 });
    expect(e.deshacerCierre?.semana.fechaInicio).toBe('2026-08-07');
    e = reducer(e, { type: 'DESHACER_CIERRE' });
    expect(e.semana.fechaInicio).toBe('2026-08-07');
  });
});

describe('migración', () => {
  async function cargarCon(clave: string, valor: unknown): Promise<AppState> {
    window.localStorage.clear();
    vi.resetModules();
    window.localStorage.setItem(clave, JSON.stringify(valor));
    const { estadoParaTests: cargar } = await import('./AppStateContext');
    return cargar();
  }

  it('un v14 conserva TODO', async () => {
    const e = await cargarCon('cunde:estado:v14', V14);
    expect(e.despensa).toEqual(V14.despensa);
    expect(e.historial).toEqual(V14.historial);
    expect(e.contadores.semanaNumero).toBe(4);
    expect(e.preferenciasPlatos).toEqual(V14.preferenciasPlatos);
    expect(e.extrasCompra).toEqual(V14.extrasCompra);
    expect(e.perfil.presupuestoSemanal).toBe(65);
  });

  it('la PREFERENCIA de quien viene de antes entra como hoy', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 7, 10, 0));
    const e = await cargarCon('cunde:estado:v14', V14);
    expect(e.perfil.fechaInicioSemana).toBe('2026-08-07');
  });

  it('pero la SEMANA vieja se queda SIN fecha: no se inventa', async () => {
    /* Sus platos se generaron para otros siete días que no sabemos cuáles
       fueron. Ponerle hoy sería afirmar que empieza hoy, y es falso. Con `null`
       la interfaz enseña LUN, MAR… que es lo que significaba al generarse. */
    const e = await cargarCon('cunde:estado:v14', V14);
    expect(e.semana.fechaInicio).toBeNull();
  });

  it('una fecha guardada con basura se descarta sin tirar el estado', async () => {
    const e = await cargarCon('cunde:estado:v15', {
      ...V14,
      perfil: { ...V14.perfil, fechaInicioSemana: 'el jueves' },
      semana: { ...V14.semana, fechaInicio: '2026-02-30' },
    });
    expect(e.perfil.fechaInicioSemana).toBe(hoy());
    expect(e.semana.fechaInicio).toBeNull();
    expect(e.despensa).toEqual(V14.despensa);
  });

  it('una fecha buena se conserva tal cual', async () => {
    const e = await cargarCon('cunde:estado:v15', {
      ...V14,
      perfil: { ...V14.perfil, fechaInicioSemana: '2026-09-15' },
      semana: { ...V14.semana, fechaInicio: '2026-09-15' },
    });
    expect(e.perfil.fechaInicioSemana).toBe('2026-09-15');
    expect(e.semana.fechaInicio).toBe('2026-09-15');
  });

  it('un usuario nuevo empieza hoy, sin haber contestado nada', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 7, 10, 0));
    window.localStorage.clear();
    vi.resetModules();
    const { estadoParaTests: cargar } = await import('./AppStateContext');
    expect(cargar().perfil.fechaInicioSemana).toBe('2026-08-07');
    expect(sumarDias(cargar().perfil.fechaInicioSemana, 6)).toBe('2026-08-13');
  });
});
