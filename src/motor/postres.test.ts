/**
 * ═══ EL POSTRE ═══
 *
 * No había ni un test de postre, y el fallo que los motivó es de manual: el
 * interruptor subía el precio y no cambiaba nada de lo que el usuario ve.
 *
 * La causa era de forma, no de cálculo. El reparto era por RACIONES —«esta
 * semana entran 7 yogures y 7 plátanos»—, que sirve para comprar y para cobrar
 * pero no responde a «¿qué me como el martes?». Como ese dato no existía, la
 * pantalla no tenía nada que enseñar aunque alguien hubiera querido enseñarlo.
 *
 * Lo que se vigila aquí:
 *   1. Que el reparto por comida EXISTA y sea determinista.
 *   2. Que las raciones que se compran cuadren EXACTAMENTE con lo que el menú
 *      dice que se come. Son la misma cuenta vista dos veces y antes eran dos
 *      cuentas distintas que solo coincidían en el total.
 *   3. Que las restricciones se respeten en las dos.
 */

import { describe, expect, it } from 'vitest';
import datosJson from '../data/motor-datos.json';
import { cartaDePostres, costeDePostres, planDePostres, postrePorHueco } from './postres.ts';
import { generarSemana } from './seleccionar.ts';
import type { PeticionSemana } from './seleccionar.ts';
import type { DatosMotor } from './tipos.ts';

const datos = datosJson as unknown as DatosMotor;
/* `variedad` y `proteina` van explícitas porque `PeticionSemana` las exige. Sin
   ellas los tests pasaban igual —vitest no comprueba tipos— pero `tsc` cantaba
   cuatro errores, que es justo el tipo de fallo que se cuela si solo se mira la
   suite. */
const BASE: PeticionSemana = {
  datos, N: 2, numHuecos: 14, presupuesto: 65,
  variedad: 'normal', proteina: 'normal', esfuerzo: 'libre', exclusiones: [],
};

describe('la carta', () => {
  it('sale ordenada por precio de ración y sin azar', () => {
    const a = cartaDePostres(datos, []);
    const b = cartaDePostres(datos, []);
    expect(a.map((x) => x.ing.id)).toEqual(b.map((x) => x.ing.id));
    expect(a.length).toBeGreaterThan(0);
  });

  it('respeta las exclusiones', () => {
    // Sin lactosa no puede colarse un lácteo. Servirle a alguien lo que ha
    // dicho que no come es el peor fallo posible de esta app.
    const carta = cartaDePostres(datos, ['Lactosa']);
    for (const x of carta) expect(x.ing.alergenos).not.toContain('Lactosa');
  });

  it('un vegano no recibe gelatina', () => {
    const carta = cartaDePostres(datos, ['Vegano']);
    for (const x of carta) {
      expect((x.ing as { postre_no_vegetariano?: boolean }).postre_no_vegetariano).not.toBe(true);
      expect(x.ing.origen).not.toBe('lacteo');
    }
  });
});

describe('qué postre toca en cada comida', () => {
  it('hay uno por comida, ni más ni menos', () => {
    expect(postrePorHueco(datos, [], 14)).toHaveLength(14);
    expect(postrePorHueco(datos, [], 7)).toHaveLength(7);
  });

  it('es determinista: mismo hueco, mismo postre', () => {
    const a = postrePorHueco(datos, [], 14).map((x) => x.ing.id);
    const b = postrePorHueco(datos, [], 14).map((x) => x.ing.id);
    expect(a).toEqual(b);
  });

  it('rota en vez de repetir el mismo catorce veces', () => {
    // Lo que separa «hay postre» de «hay un postre repetido catorce veces».
    const ids = new Set(postrePorHueco(datos, [], 14).map((x) => x.ing.id));
    expect(ids.size).toBeGreaterThan(1);
  });

  it('sin postres permitidos no inventa ninguno', () => {
    // Con todos los filtros encendidos puede no quedar carta. Entonces no hay
    // postre y no hay línea: lo que no se puede es servir uno prohibido.
    const carta = cartaDePostres(datos, ['Vegano', 'Lactosa', 'Huevo', 'Frutos secos']);
    const porHueco = postrePorHueco(datos, ['Vegano', 'Lactosa', 'Huevo', 'Frutos secos'], 14);
    expect(porHueco).toHaveLength(carta.length ? 14 : 0);
  });
});

describe('lo que se compra es lo que se come', () => {
  /**
   * EL INVARIANTE QUE ANTES NO SE CUMPLÍA PLATO A PLATO.
   *
   * Con 2 comensales y 14 comidas, el reparto viejo daba 7 raciones a cada uno
   * de los 4 postres; el reparto por comida da 4 comidas a los dos primeros y 3
   * a los dos últimos, o sea 8, 8, 6 y 6 raciones. Los totales coincidían (28)
   * pero el desglose no, así que el carrito compraba una cosa y el menú decía
   * otra. Ahora una cuenta sale de la otra y no pueden separarse.
   */
  it('las raciones de cada postre son sus comidas por los comensales', () => {
    for (const N of [1, 2, 3, 4]) {
      for (const numHuecos of [7, 14]) {
        const porHueco = postrePorHueco(datos, [], numHuecos);
        const plan = planDePostres(datos, [], N, numHuecos);
        for (const p of plan) {
          const comidas = porHueco.filter((x) => x.ing.id === p.ingrediente.id).length;
          expect(p.raciones).toBe(comidas * N);
        }
      }
    }
  });

  it('el total sigue siendo comensales por comidas', () => {
    for (const N of [1, 2, 3, 4, 5]) {
      for (const numHuecos of [7, 14]) {
        const plan = planDePostres(datos, [], N, numHuecos);
        const total = plan.reduce((a, p) => a + p.raciones, 0);
        expect(total).toBe(N * numHuecos);
      }
    }
  });

  it('ningún postre del plan se queda a cero raciones', () => {
    // Un postre a cero saldría del plan y desalinearía la rotación que
    // `rotacionDePostres` reconstruye en data/motor.ts. Con 7 o 14 comidas
    // contra 4 postres como mucho, no puede pasar — y aquí queda comprobado.
    for (const numHuecos of [7, 14]) {
      for (const p of planDePostres(datos, [], 2, numHuecos)) {
        expect(p.raciones).toBeGreaterThan(0);
      }
    }
  });
});

describe('el dinero', () => {
  it('cuesta más con postre que sin él', () => {
    const sin = generarSemana({ ...BASE, postre: false });
    const con = generarSemana({ ...BASE, postre: true });
    expect(costeDePostres(sin.postres)).toBe(0);
    expect(costeDePostres(con.postres)).toBeGreaterThan(0);
  });

  it('el postre NO rompe el presupuesto: se descuenta antes de elegir', () => {
    /**
     * Es la regla que sostiene toda la funcionalidad. Si el coste se sumara al
     * final, encender el interruptor reventaría el tope y la app estaría
     * mintiendo con su propia cifra — la única que la sostiene.
     */
    for (const presupuesto of [55, 65, 80]) {
      const con = generarSemana({ ...BASE, presupuesto, postre: true });
      if (!con.cuadra) continue;
      expect(con.carrito.totalCarrito).toBeLessThanOrEqual(presupuesto + 0.005);
    }
  });

  it('la semana con postre lleva sus líneas en el carrito', () => {
    const con = generarSemana({ ...BASE, postre: true });
    const skus = new Set(con.carrito.lineas.map((l) => l.sku));
    for (const p of con.postres) expect(skus.has(p.sku.sku)).toBe(true);
  });
});

// Los alérgenos y trazas de los postres se prueban en postres-alergenos.test.ts.
