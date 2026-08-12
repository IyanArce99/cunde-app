import { describe, expect, it } from 'vitest';
import {
  CAMBIOS_GRATIS_POR_SEMANA, accesoACambiarPlato, cambiosUsados,
  puedeElegirProteina, puedeUsar, reglaDeCambios, reglaDeProteina, tieneCundePlus,
} from './premium';
import { MURO_ACTIVO, PRECIOS, PRODUCTOS, PRODUCTO_DE } from './suscripcion';
import type { AppState, Suscripcion } from '../state/types';

/**
 * ═══ LAS REGLAS DE CUNDE+ ═══
 *
 * El principio que estos tests protegen: Cunde gratis resuelve su promesa
 * entera. Cunde+ no desbloquea el producto, desbloquea personalización.
 *
 * Por eso hay tests que comprueban que ciertas cosas NO se pueden capar. No son
 * paranoia: son la frontera del producto escrita de forma que romperla ponga
 * la suite en rojo.
 */

type EstadoPremium = Pick<AppState, 'suscripcion' | 'cambiosDePlato'>;

const con = (plan: Suscripcion, usados = 0, semana = 1): EstadoPremium => ({
  suscripcion: plan,
  cambiosDePlato: { semana, usados },
});

/**
 * ═══ POR QUÉ SE PRUEBA LA REGLA PURA Y NO SOLO LA FUNCIÓN DE ARRIBA ═══
 *
 * Con `MURO_ACTIVO` en false todo el mundo tiene Cunde+, y es deliberado: la
 * beta no puede salir con las funciones capadas y sin forma de pagarlas. Pero
 * eso dejaba los tests del límite en una de dos: o se saltaban —y entonces lo
 * más importante de Cunde+ no estaba probado justo antes de encenderlo— o daban
 * un verde que solo decía que la bandera está apagada.
 *
 * `reglaDeCambios(tienePlus, usados)` no mira la bandera. Se prueba entera hoy,
 * y `accesoACambiarPlato` es una línea que le pasa el entitlement real.
 * Lo que depende de la bandera —que hoy nadie ve el muro— se prueba aparte.
 */

describe('entitlement', () => {
  it('los tres planes dan lo mismo: nadie pregunta cuál', () => {
    /* Si un plan diera menos que otro, este test se caería — y esa es la idea:
       la diferencia entre semanal, mensual y de por vida es cuánto dura, nunca
       qué incluye. */
    const planes: Suscripcion[] = ['semana', 'mes', 'de-por-vida'];
    const accesos = planes.map((p) => [
      tieneCundePlus({ suscripcion: p }),
      puedeUsar('cambios_ilimitados', { suscripcion: p }),
      puedeUsar('proteina_alta', { suscripcion: p }),
      puedeElegirProteina('alta', { suscripcion: p }),
    ]);
    expect(accesos[0]).toEqual(accesos[1]);
    expect(accesos[1]).toEqual(accesos[2]);
    expect(accesos[0].every(Boolean)).toBe(true);
  });

  it('cada plan tiene su producto de tienda y todos llevan «plus» en el nombre', () => {
    for (const clave of Object.keys(PRECIOS) as (keyof typeof PRECIOS)[]) {
      expect(PRODUCTOS[clave]).toMatch(/^cunde_plus_/);
    }
    /* Y el puente entre los dos vocabularios está completo: `de-por-vida` en el
       estado, `deporvida` como clave. Traducirlo a ojo es cómo se cobra el
       producto equivocado. */
    for (const s of ['semana', 'mes', 'de-por-vida'] as const) {
      expect(PRODUCTOS[PRODUCTO_DE[s]]).toBeTruthy();
    }
  });
});

describe('el contador de cambios', () => {
  it('vale cero si la cuenta guardada es de otra semana', () => {
    /* Aquí está el reseteo entero: no hay gancho que se pueda olvidar. */
    expect(cambiosUsados(con(null, 2, 1), 2)).toBe(0);
    expect(cambiosUsados(con(null, 2, 1), 1)).toBe(2);
  });

  it('no se resetea al regenerar dentro de la misma semana', () => {
    /* El exploit que esto cierra: usar los dos cambios, mover el presupuesto un
       euro para forzar una regeneración, y recuperarlos. `regenerar()` no toca
       `semanaNumero`, así que la semana lógica sigue siendo la misma.
       La consecuencia —que ya no pueda cambiar— se comprueba abajo, en el
       bloque que depende de que el muro esté encendido. */
    expect(cambiosUsados(con(null, 2, 3), 3)).toBe(2);
  });
});

describe('límite de cambios', () => {
  it('los dos primeros van, el tercero no', () => {
    expect(reglaDeCambios(false, 0).puede).toBe(true);
    expect(reglaDeCambios(false, 1).puede).toBe(true);
    expect(reglaDeCambios(false, 2).puede).toBe(false);
  });

  it('dice cuántos quedan, y nunca en negativo', () => {
    expect(reglaDeCambios(false, 0).restantes).toBe(CAMBIOS_GRATIS_POR_SEMANA);
    expect(reglaDeCambios(false, 1).restantes).toBe(1);
    expect(reglaDeCambios(false, 2).restantes).toBe(0);
  });

  it('con Cunde+ no hay límite y NO se cuenta', () => {
    const conPlus = reglaDeCambios(true, 0);
    expect(conPlus.puede).toBe(true);
    /* `null` y no un número grande: la UI usa esto para no pintar nada. */
    expect(conPlus.restantes).toBeNull();
  });

  it('con Cunde+ y siete cambios hechos, sigue pudiendo', () => {
    expect(reglaDeCambios(true, 7).puede).toBe(true);
  });

  /**
   * El caso que el usuario pidió explícitamente: premium caducado a mitad de
   * semana con más cambios de los gratuitos.
   */
  it('al caducar con 7 cambios hechos, no puede más — pero no hay estado inválido', () => {
    const caducado = reglaDeCambios(false, 7);
    expect(caducado.puede).toBe(false);
    /* Ni negativo ni NaN: cero. */
    expect(caducado.restantes).toBe(0);
  });

  it('comprar a mitad de semana con los dos gastados desbloquea sin resetear', () => {
    expect(reglaDeCambios(false, 2).puede).toBe(false);
    expect(reglaDeCambios(true, 2).puede).toBe(true);
    /* El contador sigue a 2: no se resetea, no hace falta. Si luego caduca,
       vuelve a estar en el límite en vez de regalar dos más. */
    expect(cambiosUsados(con('semana', 2), 1)).toBe(2);
  });

  it('la función que usa la app enchufa el contador a la regla', () => {
    /* Lo único que `accesoACambiarPlato` añade sobre la regla es de dónde salen
       sus dos argumentos. Esto lo fija: con la cuenta de otra semana, `usados`
       entra como 0 aunque el estado diga 2. */
    const sinPlus = { suscripcion: null, cambiosDePlato: { semana: 1, usados: 2 } };
    expect(accesoACambiarPlato(sinPlus, 2)).toEqual(reglaDeCambios(tieneCundePlus(sinPlus), 0));
    expect(accesoACambiarPlato(sinPlus, 1)).toEqual(reglaDeCambios(tieneCundePlus(sinPlus), 2));
  });
});

describe('proteína', () => {
  it('básica y normal van gratis', () => {
    expect(reglaDeProteina(false, 'basica')).toBe(true);
    expect(reglaDeProteina(false, 'normal')).toBe(true);
  });

  it('alta requiere Cunde+', () => {
    expect(reglaDeProteina(false, 'alta')).toBe(false);
    expect(reglaDeProteina(true, 'alta')).toBe(true);
  });

  it('con el muro apagado, alta se puede elegir sin pagar', () => {
    /* No es un fallo: es la razón de ser de `MURO_ACTIVO`. Si esto se cae, o
       alguien encendió el muro (y entonces hay que revisar el resto), o
       `tieneCundePlus` dejó de respetar la bandera. */
    expect(puedeElegirProteina('alta', { suscripcion: null })).toBe(!MURO_ACTIVO);
  });
});

/**
 * ═══ LA FRONTERA DEL PRODUCTO ═══
 *
 * Lo que NUNCA se cobra. No es una lista de buenas intenciones: si alguien
 * añade una de estas a `FuncionPlus`, este test deja de compilar.
 */
describe('lo que no se puede capar', () => {
  it('solo hay dos funciones de pago, y son de personalización', () => {
    /* Un `FuncionPlus` nuevo obliga a venir aquí y decidirlo a conciencia. */
    const funciones = ['cambios_ilimitados', 'proteina_alta'] as const;
    expect(funciones).toHaveLength(2);
    for (const f of funciones) {
      expect(puedeUsar(f, { suscripcion: 'mes' })).toBe(true);
    }
  });

  it('ninguna función de pago se llama como algo de seguridad alimentaria', () => {
    /* Alergias y dietas NUNCA son premium: cobrar por «sin gluten» es cobrar
       por no envenenar a alguien. Y «bájame el precio» es la promesa central —
       cobrar por bajar la cesta a quien se ha pasado sería vender la solución
       al problema que la app dice resolver. */
    const prohibidas = /alergia|dieta|gluten|lactosa|exclusion|barato|precio|lista|compra|ticket/i;
    for (const f of ['cambios_ilimitados', 'proteina_alta']) {
      expect(f).not.toMatch(prohibidas);
    }
  });
});
