/**
 * ═══ FECHAS · LOS INVARIANTES ═══
 *
 * El grueso de estos tests es contra UN fallo concreto: `new Date('2026-08-07')`
 * se interpreta en UTC, y al oeste de Greenwich eso es el 6 por la tarde. Una
 * app de calendario que caiga ahí enseña el día anterior y el único síntoma es
 * que "las etiquetas no cuadran".
 *
 * Por eso hay tests de zona horaria, de cambio de mes, de cambio de año y de
 * bisiesto: son los cuatro sitios donde la aritmética de días se rompe.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import {
  aFechaDia, deFechaDia, esFechaDia, hoy, sumarDias, diasEntre, nombreDeDia,
  diasDesde, proximoLunes, fechaDePosicion,
} from './fechas';
import { diaConFecha, diaCortoConNumero, fechaParaLeer } from './format';
import { generarSemana } from '../motor/seleccionar.ts';
import datosJson from '../data/motor-datos.json';
import type { DatosMotor } from '../motor/tipos.ts';
import TarjetaDia from '../components/TarjetaDia';
import HojaInicioSemana from '../components/HojaInicioSemana';
import type { DiaSemana } from '../state/types';

const datos = datosJson as unknown as DatosMotor;
afterEach(() => { cleanup(); vi.useRealTimers(); });

// ---------------------------------------------------------------------------
// 11 · UTC
// ---------------------------------------------------------------------------

describe('nada de UTC', () => {
  it('leer y volver a escribir una fecha da la MISMA fecha', () => {
    /* El caso que mata: `new Date('2026-08-07').getDate()` da 6 en España en
       invierno y en toda América siempre. Aquí tiene que dar 7 nos pongamos
       donde nos pongamos. */
    for (const f of ['2026-01-01', '2026-08-07', '2026-12-31', '2024-02-29']) {
      expect(aFechaDia(deFechaDia(f))).toBe(f);
      expect(deFechaDia(f).getDate()).toBe(Number(f.split('-')[2]));
      expect(deFechaDia(f).getMonth()).toBe(Number(f.split('-')[1]) - 1);
    }
  });

  it('el módulo no usa `toISOString` ni `Date.parse`: son las dos puertas a UTC', async () => {
    const fuente = await import('node:fs').then((fs) => fs.readFileSync('src/lib/fechas.ts', 'utf8'));
    const codigo = fuente.split('\n').filter((l) => !l.trimStart().startsWith('*')).join('\n');
    expect(codigo).not.toContain('toISOString');
    expect(codigo).not.toContain('Date.parse');
    expect(codigo).not.toContain('new Date(`');
  });

  it('la fecha se construye a mediodía: el cambio de hora no puede moverla', () => {
    // Los días de cambio de horario tienen 23 o 25 horas. A las 00:00, sumar un
    // día con aritmética de milisegundos cae en el mismo día o se salta uno.
    expect(deFechaDia('2026-03-29').getHours()).toBe(12);
    expect(sumarDias('2026-03-28', 1)).toBe('2026-03-29');
    expect(sumarDias('2026-03-29', 1)).toBe('2026-03-30');
    expect(sumarDias('2026-10-24', 1)).toBe('2026-10-25');
    expect(sumarDias('2026-10-25', 1)).toBe('2026-10-26');
  });

  it('«hoy» es el hoy del usuario, no el de Greenwich', () => {
    // A las 23:30 del 7 en España, en UTC ya es el 7 a las 21:30 — pero a las
    // 00:30 del 8 en España, en UTC sigue siendo el 7. Lo que vale es el local.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 8, 0, 30));
    expect(hoy()).toBe('2026-08-08');
    vi.setSystemTime(new Date(2026, 7, 7, 23, 30));
    expect(hoy()).toBe('2026-08-07');
  });
});

// ---------------------------------------------------------------------------
// 6, 7, 8, 9, 10, 12 · Aritmética
// ---------------------------------------------------------------------------

describe('sumar días', () => {
  it('cruza el mes', () => {
    const dias = Array.from({ length: 7 }, (_, i) => sumarDias('2026-08-28', i));
    expect(dias).toEqual([
      '2026-08-28', '2026-08-29', '2026-08-30', '2026-08-31',
      '2026-09-01', '2026-09-02', '2026-09-03',
    ]);
  });

  it('cruza el año', () => {
    const dias = Array.from({ length: 7 }, (_, i) => sumarDias('2026-12-29', i));
    expect(dias).toEqual([
      '2026-12-29', '2026-12-30', '2026-12-31',
      '2027-01-01', '2027-01-02', '2027-01-03', '2027-01-04',
    ]);
  });

  it('febrero de un año normal salta del 28 al 1 de marzo', () => {
    expect(sumarDias('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('y en bisiesto pasa por el 29', () => {
    expect(sumarDias('2024-02-28', 1)).toBe('2024-02-29');
    expect(sumarDias('2024-02-29', 1)).toBe('2024-03-01');
    // 2100 NO es bisiesto aunque sea divisible por 4: la regla de los siglos.
    expect(sumarDias('2100-02-28', 1)).toBe('2100-03-01');
  });

  it('siete días son SIEMPRE siete días consecutivos y distintos', () => {
    for (const inicio of ['2026-08-07', '2026-08-28', '2026-12-29', '2024-02-26', '2026-03-28']) {
      const semana = Array.from({ length: 7 }, (_, i) => fechaDePosicion(inicio, i)!);
      expect(new Set(semana).size).toBe(7);
      for (let i = 1; i < 7; i++) expect(diasEntre(semana[i - 1], semana[i])).toBe(1);
    }
  });

  it('una semana sin fecha no inventa ninguna', () => {
    expect(fechaDePosicion(null, 0)).toBeNull();
    expect(fechaDePosicion(null, 3)).toBeNull();
  });
});

describe('validar', () => {
  it('acepta lo que existe y rechaza lo que no', () => {
    expect(esFechaDia('2026-08-07')).toBe(true);
    expect(esFechaDia('2024-02-29')).toBe(true);
    // Pasa el patrón y no es un día del calendario.
    expect(esFechaDia('2026-02-30')).toBe(false);
    expect(esFechaDia('2026-13-01')).toBe(false);
    for (const malo of ['07/08/2026', '2026-8-7', '', null, undefined, 20260807]) {
      expect(esFechaDia(malo)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// 1, 2, 3, 5 · Los atajos y el puente con el motor
// ---------------------------------------------------------------------------

describe('el día de la semana', () => {
  it('lo dice bien: el 7 de agosto de 2026 es viernes', () => {
    expect(nombreDeDia('2026-08-07')).toBe('VIE');
    expect(nombreDeDia('2026-08-09')).toBe('DOM');
    expect(nombreDeDia('2026-08-10')).toBe('LUN');
  });

  it('«próximo lunes» nunca devuelve hoy, ni siendo lunes', () => {
    expect(proximoLunes('2026-08-07')).toBe('2026-08-10'); // viernes → lunes
    expect(proximoLunes('2026-08-09')).toBe('2026-08-10'); // domingo → mañana
    // Lunes: el de la semana QUE VIENE. Devolver hoy haría que el atajo no
    // hiciera nada y pareciera roto.
    expect(proximoLunes('2026-08-10')).toBe('2026-08-17');
  });
});

describe('el orden de días que recibe el motor', () => {
  it('empieza por el día real y son los siete', () => {
    expect(diasDesde('2026-08-07')).toEqual(['VIE', 'SÁB', 'DOM', 'LUN', 'MAR', 'MIÉ', 'JUE']);
    expect(diasDesde('2026-08-09')).toEqual(['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']);
  });

  it('empezando en lunes es EXACTAMENTE el de siempre', () => {
    // De esto depende que las semanas de todos los usuarios actuales no cambien.
    expect(diasDesde('2026-08-10')).toEqual(['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM']);
  });

  it('el nombre de cada posición coincide con su fecha', () => {
    /* La propiedad que hace que todo esto funcione: el motor recibe nombres de
       día y la interfaz calcula fechas, por caminos distintos. Si se separaran,
       la tarjeta diría VIE y el motor habría planificado un lunes. */
    for (const inicio of ['2026-08-07', '2026-12-30', '2024-02-27']) {
      const orden = diasDesde(inicio);
      orden.forEach((nombre, i) => {
        expect(nombreDeDia(fechaDePosicion(inicio, i)!)).toBe(nombre);
      });
    }
  });
});

// ---------------------------------------------------------------------------
// El motor
// ---------------------------------------------------------------------------

describe('el motor con la semana empezando otro día', () => {
  const BASE = {
    datos, N: 2, numHuecos: 14, presupuesto: 65, variedad: 'normal' as const, proteina: 'normal' as const,
    esfuerzo: 'libre' as const, exclusiones: [] as string[], postre: false, semanaNumero: 1,
    recetasRecientes: [] as string[][], existencias: {},
  };

  it('sin orden, la semana es la de siempre', () => {
    const conLunes = generarSemana({ ...BASE, ordenDias: diasDesde('2026-08-10') });
    const sinOrden = generarSemana(BASE);
    expect(conLunes.huecos.map((h) => h.receta?.id)).toEqual(sinOrden.huecos.map((h) => h.receta?.id));
    expect(conLunes.carrito.totalCarrito).toBe(sinOrden.carrito.totalCarrito);
  });

  it('empezando en viernes, los huecos llevan los días reales y en orden', () => {
    const s = generarSemana({ ...BASE, ordenDias: diasDesde('2026-08-07') });
    const dias = [...new Set(s.huecos.map((h) => h.dia))];
    expect(dias).toEqual(['VIE', 'SÁB', 'DOM', 'LUN', 'MAR', 'MIÉ', 'JUE']);
  });

  it('═══ LA REGLA DEL FIN DE SEMANA SIGUE CAYENDO EN EL FIN DE SEMANA ═══', () => {
    /* Es el motivo de rotar los nombres en vez de dejarlos fijos. Sábado cena y
       domingo comida se cocinan, no se comen sobras — y con nombres fijos eso
       le habría caído en miércoles y jueves a quien empieza en viernes. */
    for (const inicio of ['2026-08-07', '2026-08-09', '2026-08-12']) {
      const s = generarSemana({ ...BASE, ordenDias: diasDesde(inicio) });
      const sabadoCena = s.huecos.find((h) => h.dia === 'SÁB' && h.ranura === 'cena');
      const domingoComida = s.huecos.find((h) => h.dia === 'DOM' && h.ranura === 'comida');
      for (const h of [sabadoCena, domingoComida]) {
        if (h?.receta) expect(h.tipo, `${inicio} · ${h.dia} ${h.ranura}`).toBe('cocinado');
      }
    }
  });

  it('el PRIMER día nunca lleva sobras, empiece en el día que empiece', () => {
    // No hay nada cocinado antes que aprovechar. Era «el lunes» y ahora es «el
    // primero», que es lo que la regla siempre quiso decir.
    for (const inicio of ['2026-08-07', '2026-08-09', '2026-08-11']) {
      const orden = diasDesde(inicio);
      const s = generarSemana({ ...BASE, ordenDias: orden });
      for (const h of s.huecos.filter((x) => x.dia === orden[0])) {
        expect(h.tipo, `${inicio} · ${h.dia} ${h.ranura}`).not.toBe('sobras');
        expect(h.tipo).not.toBe('ensamblaje');
      }
    }
  });

  it('sigue siendo determinista', () => {
    const p = { ...BASE, ordenDias: diasDesde('2026-08-07') };
    expect(generarSemana(p).huecos.map((h) => h.receta?.id))
      .toEqual(generarSemana(p).huecos.map((h) => h.receta?.id));
  });
});

// ---------------------------------------------------------------------------
// 13, 22 · Presentación
// ---------------------------------------------------------------------------

describe('cómo se enseña una fecha', () => {
  it('«VIE · 7 AGO», sin año', () => {
    expect(diaConFecha('2026-08-07')).toBe('VIE · 7 AGO');
    expect(diaConFecha('2026-09-01')).toBe('MAR · 1 SEP');
    expect(diaConFecha('2027-01-01')).toBe('VIE · 1 ENE');
  });

  it('«VIE 7» donde no cabe el mes', () => {
    expect(diaCortoConNumero('2026-08-07')).toBe('VIE 7');
  });

  it('y entero para quien lo escucha: «vie punto siete ago» no dice nada', () => {
    expect(fechaParaLeer('2026-08-07')).toBe('viernes, 7 de agosto de 2026');
  });

  it('la tarjeta del día enseña la fecha, y sin ella el nombre de siempre', () => {
    const dia: DiaSemana = { dia: 'LUN', comida: null, cena: null };
    const ranuras = [{ clave: 'comida' as const, etiqueta: 'comida' }];

    const { rerender } = render(
      <TarjetaDia dia={dia} fecha="2026-08-07" ranuras={ranuras} onAbrirHueco={() => {}} />,
    );
    expect(screen.getByText('VIE · 7 AGO')).toBeTruthy();

    // Semana anterior a las fechas: NO se inventa una. Se enseña lo que esa
    // semana significaba cuando se generó.
    rerender(<TarjetaDia dia={dia} fecha={null} ranuras={ranuras} onAbrirHueco={() => {}} />);
    expect(screen.getByText('LUN')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 1, 2, 3, 4 · El selector
// ---------------------------------------------------------------------------

describe('el selector de inicio', () => {
  const abrir = (valor = '2026-08-07') => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 7, 10, 0));
    const onElegir = vi.fn();
    render(<HojaInicioSemana valor={valor} onElegir={onElegir} onCerrar={() => {}} />);
    return onElegir;
  };

  it('cada atajo enseña SU fecha: elegir a ciegas sería elegir mal', () => {
    abrir();
    expect(screen.getByText('VIE · 7 AGO')).toBeTruthy(); // hoy
    expect(screen.getByText('SÁB · 8 AGO')).toBeTruthy(); // mañana
    expect(screen.getByText('LUN · 10 AGO')).toBeTruthy(); // próximo lunes
  });

  it('hoy, mañana y el próximo lunes devuelven su fecha y su origen', () => {
    const onElegir = abrir();
    fireEvent.click(screen.getByRole('button', { name: /^Hoy,/ }));
    expect(onElegir).toHaveBeenCalledWith('2026-08-07', 'hoy');
    fireEvent.click(screen.getByRole('button', { name: /^Mañana,/ }));
    expect(onElegir).toHaveBeenCalledWith('2026-08-08', 'manana');
    fireEvent.click(screen.getByRole('button', { name: /^Próximo lunes,/ }));
    expect(onElegir).toHaveBeenCalledWith('2026-08-10', 'lunes');
  });

  it('marca con aria-pressed la que está puesta, y solo esa', () => {
    abrir('2026-08-08');
    const pulsados = screen.getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true');
    expect(pulsados).toHaveLength(1);
    expect(pulsados[0].getAttribute('aria-label')).toContain('Mañana');
  });

  it('los atajos se anuncian con la fecha entera, no con «VIE · 7 AGO»', () => {
    abrir();
    expect(screen.getByRole('button', { name: 'Hoy, viernes, 7 de agosto de 2026' })).toBeTruthy();
  });

  it('una fecha libre se elige con el campo del sistema', () => {
    const onElegir = abrir();
    const campo = screen.getByLabelText('Elegir otra fecha de inicio');
    expect(campo.getAttribute('type')).toBe('date');
    fireEvent.change(campo, { target: { value: '2026-09-15' } });
    fireEvent.click(screen.getByRole('button', { name: /Empezar el/ }));
    expect(onElegir).toHaveBeenCalledWith('2026-09-15', 'elegida');
  });

  it('el botón no promete un cambio que no va a pasar', () => {
    abrir('2026-08-07');
    expect((screen.getByRole('button', { name: /Empezar el/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});
