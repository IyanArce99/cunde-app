import { describe, expect, it } from 'vitest';
import { DIAS_PRECIOS_VIEJOS, diasDePrecios, preciosViejos } from './precios';

/**
 * ═══ QUE LA APP SEPA LA EDAD DE SUS PROPIOS PRECIOS ═══
 *
 * Esto existe por un agujero de operación, no de código. La cadena que trae
 * precios nuevos tiene tres eslabones —el cron que raspa, la publicación a mano
 * y que la app tenga configurada `VITE_PRECIOS_URL`— y ninguno avisa al usuario
 * cuando se rompe. De hecho los tres estaban parados a la vez y nos enteramos
 * leyendo una cabecera en una captura de pantalla.
 *
 * Que la app note su propia antigüedad es lo único que protege a quien está
 * delante del lineal pase lo que pase por detrás.
 */

describe('la edad de los precios', () => {
  it('cuenta los días entre la versión y hoy', () => {
    expect(diasDePrecios('2026-08-10', '2026-08-10')).toBe(0);
    expect(diasDePrecios('2026-08-10', '2026-08-12')).toBe(2);
    expect(diasDePrecios('2026-08-10', '2026-08-21')).toBe(11);
  });

  it('cruza meses y años sin descuadrarse', () => {
    expect(diasDePrecios('2026-08-28', '2026-09-04')).toBe(7);
    expect(diasDePrecios('2025-12-28', '2026-01-04')).toBe(7);
  });

  it('no se despeina con el cambio de hora', () => {
    /* Las fechas se construyen a mediodía justamente para esto: con medianoche,
       la noche en que se adelanta el reloj da 6,96 días y redondea distinto. El
       último domingo de marzo de 2026 es el 29. */
    expect(diasDePrecios('2026-03-25', '2026-04-01')).toBe(7);
    expect(diasDePrecios('2026-10-21', '2026-10-28')).toBe(7);
  });

  it('unos precios del futuro son cero, no una edad negativa', () => {
    /* Un móvil con el reloj mal puesto. «Precios de hace -3 días» es peor que
       no decir nada. */
    expect(diasDePrecios('2026-08-20', '2026-08-12')).toBe(0);
  });

  it('una versión ilegible no rompe la pantalla', () => {
    expect(diasDePrecios('', '2026-08-12')).toBe(0);
    expect(diasDePrecios('no es una fecha', '2026-08-12')).toBe(0);
  });
});

describe('cuándo se considera viejo', () => {
  /**
   * Siete días, y el número tiene motivo: la app vende semanas. Unos precios de
   * hace más de siete días son más viejos que la semana que están valorando.
   */
  it('el umbral es una semana', () => {
    expect(DIAS_PRECIOS_VIEJOS).toBe(7);
  });

  it('por debajo no se dice nada', () => {
    /* Publicar es una decisión humana y puede tardar unos días con toda
       normalidad. Avisar de eso sería gritar por costumbre, y enseñar al
       usuario a no hacer caso del aviso cuando de verdad importe. */
    for (const d of [0, 1, 3, 6]) {
      expect(preciosViejos('2026-08-10', sumar('2026-08-10', d)), `${d} días`).toBe(false);
    }
  });

  it('a partir del séptimo, sí', () => {
    for (const d of [7, 8, 30, 200]) {
      expect(preciosViejos('2026-08-10', sumar('2026-08-10', d)), `${d} días`).toBe(true);
    }
  });
});

function sumar(f: string, dias: number): string {
  const [a, m, d] = f.split('-').map(Number);
  const x = new Date(a, m - 1, d, 12);
  x.setDate(x.getDate() + dias);
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${dos(x.getMonth() + 1)}-${dos(x.getDate())}`;
}
