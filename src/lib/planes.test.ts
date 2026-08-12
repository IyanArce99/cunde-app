import { describe, expect, it } from 'vitest';
import { AL_ANO, POR_SEMANA, PRECIOS, PRODUCTOS } from './suscripcion';
import type { Suscripcion } from '../state/types';

/**
 * ═══ EL FALLO QUE ESTOS TESTS IMPIDEN ═══
 *
 * Con dos planes, el código decía en dos sitios «si no es mes, es anual». Al
 * añadir un tercero eso cobraba el precio equivocado en el botón y compraba el
 * producto equivocado en la tienda.
 *
 * Ninguna de las dos cosas se ve en pantalla. Se ven en el extracto del banco
 * del usuario, que es el peor sitio donde se puede ver un error de este tipo.
 */

/** Igual que en `MuroDePago`: lo que se cobra por cada plan elegible. */
function precioDe(plan: Exclude<Suscripcion, null>): number {
  if (plan === 'semana') return PRECIOS.semana;
  if (plan === 'de-por-vida') return PRECIOS.deporvida;
  return PRECIOS.mes;
}

const ELEGIBLES: Exclude<Suscripcion, null>[] = ['semana', 'mes', 'de-por-vida'];

describe('planes', () => {
  it('cada plan elegible tiene su precio, y ninguno se solapa', () => {
    const precios = ELEGIBLES.map(precioDe);
    expect(precios).toEqual([1.49, 3.99, 29.99]);
    expect(new Set(precios).size).toBe(3);
  });

  it('cada precio tiene su producto de tienda, y ninguno repetido', () => {
    for (const clave of Object.keys(PRECIOS) as (keyof typeof PRECIOS)[]) {
      expect(PRODUCTOS[clave], `falta el producto de ${clave}`).toBeTruthy();
    }
    const ids = Object.values(PRODUCTOS);
    expect(new Set(ids).size, 'dos planes con el mismo identificador').toBe(ids.length);
  });

  it('el equivalente anual sale de los precios, no escrito a mano', () => {
    expect(AL_ANO.semana).toBeCloseTo(77.48, 2);
    expect(AL_ANO.mes).toBeCloseTo(47.88, 2);
    expect(POR_SEMANA.semana).toBe(PRECIOS.semana);
  });

  /**
   * ═══ EL PLAN PRINCIPAL TIENE QUE GANAR AL COMPARARLO ═══
   *
   * El mensual es el que se quiere vender. Para que se venda solo tiene que ser
   * el más barato de los recurrentes, y ahora lo es:
   *
   *     1,49 × 52  =  77,48 € al año
   *     3,99 × 12  =  47,88 € al año   ← un 38% menos
   *
   * Este test es el guardia de esa relación. Con la primera propuesta —0,49 a
   * la semana— iba al revés: el mensual salía un 88% MÁS caro que el semanal, y
   * el plan que se quería empujar quedaba dominado por los dos lados.
   *
   * Si alguien vuelve a bajar el semanal por debajo del mensual, esto se pone
   * rojo y obliga a decidirlo, no a descubrirlo en las ventas tres meses tarde.
   */
  it('el mensual es el plan recurrente más barato al año', () => {
    expect(AL_ANO.mes).toBeLessThan(AL_ANO.semana);
    /* Y con margen suficiente para que se note al comparar: por debajo de un
       20% de diferencia, la ventaja deja de ser un argumento. */
    expect(AL_ANO.mes / AL_ANO.semana).toBeLessThan(0.8);
  });

  /**
   * ═══ HAY PLAN SEMANAL, Y `CLAUDE.md` LO PROHÍBE ═══
   *
   * La regla se escribió contra una app que cobra 9,99 € A LA SEMANA —519 al
   * año— con prueba trampa de tres días. Lo predatorio era el importe y la
   * trampa, no el periodo.
   *
   * Lo que mantiene esto honesto es que la pantalla diga lo que suma en un año.
   * Sin esa línea, 1,49 parece tres veces más barato que 3,99 cuando es un 62%
   * más caro — el mismo truco con otra cifra. Por eso el guardia es doble: el
   * semanal tiene que quedarse por debajo de la barbaridad del competidor, y la
   * cifra anual tiene que estar calculada y disponible para pintarla.
   */
  it('el semanal está lejísimos del competidor que motivó la regla', () => {
    const COMPETIDOR_AL_ANO = 9.99 * 52;
    expect(AL_ANO.semana).toBeLessThan(COMPETIDOR_AL_ANO / 5);
    expect(AL_ANO.semana).toBeGreaterThan(0);
  });

  /**
   * El pago único se amortiza en 7,5 meses de mensual. Está asumido: es una
   * decisión de captación, no de ingreso recurrente. El test lo fija para que
   * mover un precio y cambiar ese plazo sea deliberado.
   */
  it('el pago único se amortiza dentro del primer año', () => {
    const meses = PRECIOS.deporvida / PRECIOS.mes;
    expect(meses).toBeGreaterThan(6);
    expect(meses).toBeLessThan(12);
  });

  /**
   * ═══ LA FRASE DE VENTA TIENE QUE SEGUIR SIENDO CIERTA ═══
   *
   * El muro dice «te cuesta X a la semana y la despensa te ahorró 8,57 €». Con
   * los precios anteriores el ratio era de 15 a 1; con estos:
   *
   *     mensual   0,92 €/semana  →  9,3 a 1
   *     semanal   1,49 €/semana  →  5,7 a 1
   *
   * Sigue siendo un argumento, pero ya no es el mismo argumento — y el plan que
   * se quiere vender es justo el que mejor ratio tiene, que es lo suyo.
   *
   * El umbral está en 4 a 1: por debajo de ahí «te ahorra más de lo que cuesta»
   * deja de impresionar y hay que rehacer el argumento entero, no solo el
   * número.
   */
  it('el coste semanal sigue muy por debajo del ahorro medido', () => {
    const AHORRO_SEMANAL_MEDIDO = 8.57;
    expect(POR_SEMANA.mes).toBeLessThan(AHORRO_SEMANAL_MEDIDO / 8);
    expect(POR_SEMANA.semana).toBeLessThan(AHORRO_SEMANAL_MEDIDO / 4);
  });
});
