/**
 * ═══ LOS EXTRAS EN EL ESTADO ═══
 *
 * Persistencia, cierre de semana y deshacer. Lo que se prueba aquí es que un
 * extra pertenece a UNA compra y que deshacer lo devuelve entero — y, sobre
 * todo, que en ninguno de esos caminos se mueve la cifra del menú.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reducer, estadoParaTests } from './AppStateContext';
import { generarParaApp } from '../data/motor';
import { totalLista } from '../lib/derive';
import { totalExtras } from '../lib/extras';
import type { AppState } from './types';

const V13 = {
  onboardingCompletado: true,
  perfil: { comensales: '2', super: 'Mercadona', presupuestoSemanal: 65, codigoPostal: '28001', almacen: null },
  preferencias: {
    comidas: 'ambas', esfuerzo: 'libre', variedad: 'normal', variedadElegida: true,
    proteina: 'normal', exclusiones: [], postre: false,
  },
  semana: { plan: { tandas: [], huecos: [] }, dias: [], generadaEn: 1754000000000 },
  historial: [['lentejas']],
  preferenciasPlatos: { r1: { platoId: 'r1', valoracion: 'no_quiero', actualizadaEn: '2026-08-07T10:00:00.000Z' } },
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
    semana: { plan: semana.plan, dias: semana.dias, generadaEn: 1754000000000, fechaInicio: '2026-08-07' },
    lista: semana.lista,
  };
}

const conTres = (e: AppState): AppState => {
  let s = reducer(e, { type: 'ANADIR_EXTRA', nombre: 'Café', precio: null });
  s = reducer(s, { type: 'ANADIR_EXTRA', nombre: 'Papel higiénico', precio: 4.25 });
  return reducer(s, { type: 'ANADIR_EXTRA', nombre: 'Agua', precio: 2.1 });
};

beforeEach(() => window.localStorage.clear());

describe('las cuatro acciones', () => {
  it('añadir, marcar, cambiar precio y quitar', () => {
    let e = reducer(conSemana(), { type: 'ANADIR_EXTRA', nombre: 'Café', precio: null });
    const { id } = e.extrasCompra[0];
    expect(e.extrasCompra).toHaveLength(1);
    expect(e.extrasCompra[0]).toMatchObject({ nombre: 'Café', precio: null, marcado: false });

    e = reducer(e, { type: 'TOGGLE_EXTRA', id });
    expect(e.extrasCompra[0].marcado).toBe(true);
    e = reducer(e, { type: 'TOGGLE_EXTRA', id });
    expect(e.extrasCompra[0].marcado).toBe(false);

    e = reducer(e, { type: 'PRECIO_EXTRA', id, precio: 3.89 });
    expect(e.extrasCompra[0].precio).toBe(3.89);
    expect(totalExtras(e.extrasCompra)).toBe(3.89);

    e = reducer(e, { type: 'QUITAR_EXTRA', id });
    expect(e.extrasCompra).toEqual([]);
  });

  it('un nombre en blanco no crea nada', () => {
    const e = reducer(conSemana(), { type: 'ANADIR_EXTRA', nombre: '   ', precio: 3 });
    expect(e.extrasCompra).toEqual([]);
  });

  it('quitar algo que no existe no cambia el estado', () => {
    const antes = conTres(conSemana());
    expect(reducer(antes, { type: 'QUITAR_EXTRA', id: 'nada' })).toBe(antes);
  });

  it('dos con el mismo nombre conviven y se quitan por separado', () => {
    let e = reducer(conSemana(), { type: 'ANADIR_EXTRA', nombre: 'Leche', precio: 1.1 });
    e = reducer(e, { type: 'ANADIR_EXTRA', nombre: 'Leche', precio: 1.1 });
    expect(e.extrasCompra).toHaveLength(2);
    e = reducer(e, { type: 'QUITAR_EXTRA', id: e.extrasCompra[0].id });
    expect(e.extrasCompra).toHaveLength(1);
  });
});

describe('═══ LOS EXTRAS NO TOCAN EL MENÚ ═══', () => {
  it('ni la cifra, ni la lista, ni la despensa, ni el plan', () => {
    const antes = conSemana();
    const menu = totalLista(antes.lista);
    const despues = conTres(antes);

    expect(totalLista(despues.lista)).toBe(menu);
    // Identidad, no igualdad: la lista del motor ni siquiera se reconstruye.
    expect(despues.lista).toBe(antes.lista);
    expect(despues.semana.plan).toBe(antes.semana.plan);
    expect(despues.despensa).toBe(antes.despensa);
    expect(despues.preferencias).toBe(antes.preferencias);
    expect(despues.perfil).toBe(antes.perfil);
  });

  it('tampoco al marcarlos ni al cambiarles el precio', () => {
    const base = conTres(conSemana());
    const menu = totalLista(base.lista);
    let e = reducer(base, { type: 'TOGGLE_EXTRA', id: base.extrasCompra[0].id });
    e = reducer(e, { type: 'PRECIO_EXTRA', id: e.extrasCompra[0].id, precio: 99 });
    expect(totalLista(e.lista)).toBe(menu);
    expect(e.lista).toBe(base.lista);
  });
});

describe('cerrar la semana', () => {
  it('los extras se vacían: pertenecen a esa compra', () => {
    const e = reducer(conTres(conSemana()), { type: 'GUARDAR_CIERRE', importeRealTicket: 70.1 });
    expect(e.extrasCompra).toEqual([]);
  });

  it('pero quedan en la foto, para poder deshacer', () => {
    const antes = conTres(conSemana());
    const e = reducer(antes, { type: 'GUARDAR_CIERRE', importeRealTicket: 70.1 });
    expect(e.deshacerCierre?.extrasCompra).toEqual(antes.extrasCompra);
  });

  it('y deshacer los devuelve EXACTAMENTE como estaban, marcas incluidas', () => {
    let antes = conTres(conSemana());
    // Uno marcado y otro con precio corregido: el caso real, no la lista limpia.
    antes = reducer(antes, { type: 'TOGGLE_EXTRA', id: antes.extrasCompra[1].id });
    antes = reducer(antes, { type: 'PRECIO_EXTRA', id: antes.extrasCompra[0].id, precio: 3.89 });

    let e = reducer(antes, { type: 'GUARDAR_CIERRE', importeRealTicket: 70.1 });
    expect(e.extrasCompra).toEqual([]);
    e = reducer(e, { type: 'DESHACER_CIERRE' });

    expect(e.extrasCompra).toEqual(antes.extrasCompra);
    expect(e.extrasCompra[1].marcado).toBe(true);
    expect(e.extrasCompra[0].precio).toBe(3.89);
    // Y no se rompe lo que deshacer ya devolvía.
    expect(e.historial).toEqual(antes.historial);
    expect(e.despensa).toEqual(antes.despensa);
    expect(e.contadores).toEqual(antes.contadores);
  });

  it('cerrar sin extras sigue funcionando igual', () => {
    const e = reducer(conSemana(), { type: 'GUARDAR_CIERRE', importeRealTicket: 61.2 });
    expect(e.extrasCompra).toEqual([]);
    expect(e.deshacerCierre?.extrasCompra).toEqual([]);
    expect(e.cierre.guardada).toBe(true);
  });

  /**
   * ═══ CONTRA QUÉ SE COMPARABA · EL FALLO QUE SALIÓ MIRANDO LA TARJETA ═══
   *
   * `GUARDAR_CIERRE` vacía `extrasCompra` en la misma acción que guarda el
   * ticket. Cualquier pantalla que después quiera comparar «previsto contra
   * pagado» leyendo el estado vivo encuentra CERO extras y le atribuye a Cunde
   * la diferencia entera — incluido el detergente y las cosas cuyo precio nadie
   * llegó a saber.
   *
   * Salió de verdad: la tarjeta de compartir decía «DIFERENCIA +13,90 €» con
   * 6,80 € de detergente y un café sin precio dentro. Estos tres tests son lo
   * que impide que vuelva.
   */
  it('el cierre guarda contra qué se comparaba', () => {
    const antes = conTres(conSemana());
    const e = reducer(antes, { type: 'GUARDAR_CIERRE', importeRealTicket: 70.1 });
    expect(e.cierre.menuPrevisto).toBeCloseTo(totalLista(antes.lista), 6);
    expect(e.cierre.extras).toBeCloseTo(totalExtras(antes.extrasCompra), 6);
    // El café entró sin precio: uno, y hay que poder decirlo.
    expect(e.cierre.extrasSinPrecio).toBe(1);
  });

  it('la foto sobrevive a que se vacíen los extras', () => {
    const e = reducer(conTres(conSemana()), { type: 'GUARDAR_CIERRE', importeRealTicket: 70.1 });
    expect(e.extrasCompra).toEqual([]);
    // Lo que se vació es el estado vivo, no la foto: es toda la diferencia.
    expect(e.cierre.extras).toBeGreaterThan(0);
  });

  it('sin extras la foto lo dice, y no queda indefinida', () => {
    // `undefined` significa «no lo sé» y hace que la tarjeta no compare. Cero
    // significa «no había ninguno», que sí se puede afirmar. No son lo mismo.
    const e = reducer(conSemana(), { type: 'GUARDAR_CIERRE', importeRealTicket: 61.2 });
    expect(e.cierre.extras).toBe(0);
    expect(e.cierre.extrasSinPrecio).toBe(0);
    expect(e.cierre.menuPrevisto).toBeGreaterThan(0);
  });
});

describe('persistencia y migración', () => {
  async function cargarCon(clave: string, valor: unknown): Promise<AppState> {
    window.localStorage.clear();
    vi.resetModules();
    window.localStorage.setItem(clave, JSON.stringify(valor));
    const { estadoParaTests: cargar } = await import('./AppStateContext');
    return cargar();
  }

  it('un v13 conserva TODO y estrena la lista de extras vacía', async () => {
    const e = await cargarCon('cunde:estado:v13', V13);
    expect(e.extrasCompra).toEqual([]);
    // Lo que no se puede perder al subir de versión:
    expect(e.despensa).toEqual(V13.despensa);
    expect(e.historial).toEqual(V13.historial);
    expect(e.contadores.semanaNumero).toBe(4);
    expect(e.preferenciasPlatos).toEqual(V13.preferenciasPlatos);
    expect(e.perfil.presupuestoSemanal).toBe(65);
    expect(e.preferencias.variedadElegida).toBe(true);
  });

  it('los extras guardados se restauran tal cual', async () => {
    const extrasCompra = [
      { id: 'a', nombre: 'Café', precio: null, marcado: true, creadoEn: '2026-08-07T10:00:00.000Z' },
      { id: 'b', nombre: 'Agua', precio: 2.1, marcado: false, creadoEn: '2026-08-07T10:01:00.000Z' },
    ];
    const e = await cargarCon('cunde:estado:v14', { ...V13, extrasCompra });
    expect(e.extrasCompra).toEqual(extrasCompra);
    // Y `precio: null` sobrevive: es un valor, no un campo ausente.
    expect(e.extrasCompra[0].precio).toBeNull();
  });

  it('una lista con basura dentro se descarta ENTERA, sin tirar el resto', async () => {
    const e = await cargarCon('cunde:estado:v14', {
      ...V13,
      extrasCompra: [{ id: 'a', nombre: 'Café', precio: 'tres euros', marcado: true }],
    });
    expect(e.extrasCompra).toEqual([]);
    expect(e.despensa).toEqual(V13.despensa);
  });

  it('un v12 —dos versiones atrás— también llega entero', async () => {
    const { preferenciasPlatos, ...v12 } = V13;
    const e = await cargarCon('cunde:estado:v12', v12);
    expect(e.extrasCompra).toEqual([]);
    expect(e.preferenciasPlatos).toEqual({});
    expect(e.despensa).toEqual(V13.despensa);
    expect(e.historial).toEqual(V13.historial);
  });
});
