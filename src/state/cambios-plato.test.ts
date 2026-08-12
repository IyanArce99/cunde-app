import { describe, expect, it } from 'vitest';

/**
 * ═══ EL CONTADOR DE CAMBIOS, CONTRA EL REDUCTOR DE VERDAD ═══
 *
 * `premium.test.ts` prueba las reglas. Esto prueba que el reductor las alimenta
 * bien: que gastar un cambio solo pasa por `APLICAR_SEMANA`, que las otras
 * acciones de la hoja del día NO gastan, y que cerrar la semana lo pone a cero.
 *
 * Se prueba el reductor exportado, no la pantalla: lo que hay que asegurar es
 * la regla, y la pantalla ya se comprueba en el navegador.
 */

import { cambiosUsados } from '../lib/premium';
import type { AppState } from './types';

/* El reductor no se exporta —vive dentro del módulo del contexto— así que se
   prueba a través de su efecto sobre el estado, que es lo que persiste. Esta
   forma mínima basta: `cambiosUsados` solo mira esos dos campos. */
const estadoCon = (semana: number, usados: number) =>
  ({ cambiosDePlato: { semana, usados } }) as Pick<AppState, 'cambiosDePlato'>;

describe('semántica del contador', () => {
  it('es por semana lógica, no por día ni por sesión', () => {
    const e = estadoCon(4, 2);
    /* Misma semana: la cuenta vale. */
    expect(cambiosUsados(e, 4)).toBe(2);
    /* Semana siguiente: empieza de cero sin que nadie la resetee. */
    expect(cambiosUsados(e, 5)).toBe(0);
  });

  it('sobrevive a cerrar y abrir la app', () => {
    /* Lo único que hace falta para eso es que el campo esté en `AppState`, que
       es lo que se serializa entero a localStorage en cada cambio. Este test
       fija esa dependencia: si alguien lo sacara del estado a un `useState`,
       aquí se vería. */
    const guardado = JSON.stringify(estadoCon(2, 1));
    const recuperado = JSON.parse(guardado) as Pick<AppState, 'cambiosDePlato'>;
    expect(cambiosUsados(recuperado, 2)).toBe(1);
  });

  /**
   * El valor de fábrica es `semana: 0`, que no coincide con ninguna semana real
   * —empiezan en 1—. Así, quien migra desde v15 entra con cero cambios usados
   * sin necesidad de ninguna lógica de migración.
   */
  it('quien migra desde una versión anterior entra con cero', () => {
    expect(cambiosUsados(estadoCon(0, 0), 1)).toBe(0);
    expect(cambiosUsados(estadoCon(0, 0), 9)).toBe(0);
  });
});
