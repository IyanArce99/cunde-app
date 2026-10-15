/**
 * ═══ VARIEDAD: SIEMPRE ELEGIBLE, ALTA POR DEFECTO, Y SIN PROMETER DE MÁS ═══
 *
 * 1. El selector enseña los tres niveles siempre. Antes desaparecía cuando las
 *    tres semanas caían en el mismo grupo, y la hoja dejaba el rótulo
 *    «Variedad» sin nada debajo.
 * 2. Lo que dice cada botón sale de la semana: si hay comidas de sobras, se
 *    dice, y «nunca repites plato» no aparece nunca.
 * 3. Quien no ha elegido recibe la alta si cabe; si no cabe, la de antes. Lo
 *    que alguien eligió no se toca.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import SelectorVariedad, { porQueNoAlta, queTrae } from '../components/SelectorVariedad';
import type { CosteOpcion } from '../motor/seleccionar.ts';
import type { Contexto } from '../lib/derive';
import type { Variedad } from './types';

const opcion = (o: Partial<CosteOpcion>): CosteOpcion => ({
  carrito: 60, consumo: 50, disponible: true, proteina: 70, perecedero: 10,
  platos: 12, repeticiones: 2, platosRepetidos: 0, ...o,
});
const ctx = (variedad: Variedad, presupuesto = 100) => ({
  comensales: 2, comidas: 'ambas', esfuerzo: 'libre', exclusiones: [], presupuesto, variedad, proteina: 'normal', postre: false,
}) as unknown as Contexto;

afterEach(cleanup);

describe('el selector', () => {
  it('enseña los tres niveles aunque ninguno repita plato (antes devolvía null)', () => {
    const costes = { mucha: opcion({}), normal: opcion({ carrito: 58, platos: 9 }), poca: opcion({ carrito: 50, platos: 8 }) };
    const elegir = vi.fn();
    render(<SelectorVariedad ctx={ctx('normal')} costes={costes} onCambiar={elegir} />);
    for (const n of ['Alta', 'Normal', 'Baja']) expect(screen.getByText(n)).toBeTruthy();
    fireEvent.click(screen.getByText('Alta'));
    expect(elegir).toHaveBeenCalledWith('mucha');
    expect(screen.getByText('Normal').closest('button')!.getAttribute('aria-pressed')).toBe('true');
  });

  it('mientras calcula, también se ve', () => {
    render(<SelectorVariedad ctx={ctx('mucha')} costes={null} onCambiar={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('si la alta no cabe, lo dice con la cifra', () => {
    const costes = { mucha: opcion({ carrito: 72.4, disponible: false, porque: 'presupuesto' }), normal: opcion({}), poca: opcion({}) };
    render(<SelectorVariedad ctx={ctx('normal', 65)} costes={costes} onCambiar={() => {}} />);
    expect(screen.getByText('La variedad alta sale por 72,40 € y tu tope es 65,00 €.')).toBeTruthy();
    expect(screen.getByText('Alta').closest('button')!.hasAttribute('disabled')).toBe(true);
  });
});

describe('lo que dice cada botón', () => {
  it('las sobras se cuentan, y «nunca repites plato» no sale', () => {
    expect(queTrae(opcion({ platos: 12, repeticiones: 2, platosRepetidos: 0 }))).toEqual(['12 platos', '2 de sobras']);
    expect(queTrae(opcion({ platos: 5, repeticiones: 5, platosRepetidos: 4 }))).toEqual(['5 platos', '5 de sobras', 'cocinas 4 otra vez']);
    expect(queTrae(opcion({ repeticiones: 0 }))).toContain('sin sobras');
    for (const c of [opcion({}), opcion({ repeticiones: 0 })]) expect(queTrae(c).join(' ')).not.toMatch(/nunca/);
  });

  it('cada motivo tiene su frase', () => {
    expect(porQueNoAlta(opcion({ disponible: false, porque: 'proteina' }), 50)).toMatch(/proteína/);
    expect(porQueNoAlta(opcion({ disponible: false, porque: 'recetario', carrito: Number.NaN }), 50)).toMatch(/filtros/);
  });
});

describe('la variedad por defecto', () => {
  async function app(codigoPostal = '28001') {
    window.localStorage.clear();
    window.localStorage.setItem('cunde:estado:v16', JSON.stringify({ perfil: { codigoPostal } }));
    vi.resetModules();
    const c = await import('./AppStateContext');
    const m = await import('../data/motor');
    const s = await import('../motor/seleccionar.ts');
    return { ...c, ...m, ...s };
  }

  it('es la alta cuando cabe, en Madrid y en Gran Canaria', async () => {
    for (const cp of ['28001', '35007']) {
      const { estadoParaTests, variedadPorDefecto } = await app(cp);
      const e = estadoParaTests();
      const perfil = { ...e.perfil, comensales: '2' as const, presupuestoSemanal: 100, fechaInicioSemana: '2026-10-14' };
      expect(variedadPorDefecto(perfil, e.preferencias), cp).toBe('mucha');
    }
  });

  it('si la alta no cabe en el tope, vuelve a la que menos desperdicia, sin forzar gasto', async () => {
    const { estadoParaTests, variedadPorDefecto, variedadQueMenosDesperdicia, peticionDe, costeDeUnaVariedad } = await app();
    const e = estadoParaTests();
    // El tope más alto en el que la alta ya no cabe y otra sí: el motor
    // abarata cada nivel según el tope, así que se busca, no se supone.
    const perfilCon = (tope: number) => ({ ...e.perfil, comensales: '2' as const, presupuestoSemanal: tope, fechaInicioSemana: '2026-10-14' });
    let tope = 0;
    for (let t = 70; t >= 25; t -= 1) {
      const p = peticionDe(perfilCon(t), e.preferencias);
      if (!costeDeUnaVariedad(p, 'mucha').disponible && costeDeUnaVariedad(p, 'poca').disponible) { tope = t; break; }
    }
    expect(tope, 'algún tope deja fuera la alta y no la baja').toBeGreaterThan(0);
    const v = variedadPorDefecto(perfilCon(tope), e.preferencias);
    expect(v).not.toBe('mucha');
    expect(v).toBe(variedadQueMenosDesperdicia(perfilCon(tope), e.preferencias));
  });

  it('una variedad elegida no se sobrescribe al regenerar', async () => {
    const { estadoParaTests, reducer } = await app();
    const e = { ...estadoParaTests(), onboardingCompletado: true };
    const elegida = reducer(e, { type: 'SET_PREFERENCIAS', preferencias: { ...e.preferencias, variedad: 'poca', variedadElegida: true } });
    expect(elegida.preferencias.variedad).toBe('poca');
    const otra = reducer(elegida, { type: 'SET_PREFERENCIAS', preferencias: { ...elegida.preferencias, postre: true } });
    expect(otra.preferencias.variedad).toBe('poca');
  });

  it('sin elegir, al regenerar se pone la alta', async () => {
    const { estadoParaTests, reducer } = await app();
    const e = { ...estadoParaTests(), onboardingCompletado: true };
    const s = reducer(e, { type: 'SET_PREFERENCIAS', preferencias: { ...e.preferencias, variedad: 'poca', variedadElegida: false, postre: true } });
    expect(s.preferencias.variedad).toBe('mucha');
    expect(s.preferencias.variedadElegida).toBe(false);
  });
});
