/**
 * ═══ ENVASES ABIERTOS · SESIÓN A SESIÓN ═══
 *
 * Ver ENVASES ABIERTOS en carrito.ts. Comprueba que el carrito, con los
 * huecos de la semana:
 *   · no da por aprovechable lo que queda de un envase sin plazo de abierto
 *     (queso rallado: la ficha no lo dice) y compra otro;
 *   · reutiliza lo abierto dentro de las horas de la ficha (champiñón, 120 h)
 *     y no fuera de ellas;
 *   · abre un pack de tres briks brik a brik;
 *   · no pasa lo abierto a la despensa de la semana siguiente;
 *   · y que el plazo de una ficha no se aplica a otro producto de la zona.
 *
 * Los plazos son los de las fichas de Mercadona consultadas el 16 oct 2026
 * (ver docs/ingredientes-canonicos.json). Estos tests comprueban que el
 * software los aplica, no que los plazos sean seguros.
 */
import { describe, expect, it } from 'vitest';
import datosJson from '../data/motor-datos.json';
import granCanaria from '../data/zonas/gran-canaria.json';
import { calcularCarrito, existenciasTrasLaSemana, horasAbiertoDe } from './carrito.ts';
import { datosDeZona } from './zona.ts';
import type { CatalogoZona } from './zona.ts';
import { DIAS } from './tipos.ts';
import type { DatosMotor, Hueco, Receta, Tanda } from './tipos.ts';

const madrid = datosJson as unknown as DatosMotor;
const gc = datosDeZona(madrid, granCanaria as unknown as CatalogoZona, '3120');

const receta = (id: string, canonico: string, gramos: number): Receta => ({
  id, nombre: id, minutos: 10, tags: [], proteina: 'x', tecnica: 'x', dias_nevera: 3,
  rinde_huecos: { principal: 1, acompanamiento: 1 }, pasos: [],
  ingredientes: [{ canonico, parte: 'principal', cantidad: gramos, unidad: 'g', escalado: 'lineal' }],
} as unknown as Receta);

/** Una semana con cada receta cocinada en el hueco dado (0 = lunes comida, 1 = lunes cena…). */
function semana(usos: [Receta, number][]): { tandas: Tanda[]; huecos: Hueco[] } {
  const huecos: Hueco[] = DIAS.flatMap((dia) => (['comida', 'cena'] as const).map((ranura) => ({ dia, ranura, receta: null, tipo: 'libre' } as Hueco)));
  for (const [r, k] of usos) huecos[k] = { ...huecos[k], receta: r, tipo: 'cocinado' };
  return { tandas: usos.map(([r]) => ({ receta: r, huecosPrincipal: 1, huecosAcompanamiento: 1 })), huecos };
}
const linea = (c: ReturnType<typeof calcularCarrito>, nombre: RegExp) => c.lineas.find((l) => nombre.test(l.nombre))!;

describe('envases abiertos', () => {
  it('sin plazo de abierto en la ficha, cada sesión abre su envase', () => {
    const s = semana([[receta('a', 'queso_rallado', 40), 0], [receta('b', 'queso_rallado', 40), 1]]);
    expect(linea(calcularCarrito(s.tandas, gc, 1), /Queso rallado/).compras).toBe(2);
    const l = linea(calcularCarrito(s.tandas, gc, 1, {}, undefined, s.huecos), /Queso rallado/);
    expect(l.compras).toBe(2);
    expect(l.sobranteAbierto).toBeCloseTo(0.32, 3);
    // Lo abierto no pasa a la semana siguiente.
    expect(existenciasTrasLaSemana(calcularCarrito(s.tandas, gc, 1, {}, undefined, s.huecos))['23621']).toBeUndefined();
  });

  it('con plazo, se reutiliza dentro de las horas y no fuera', () => {
    const dentro = semana([[receta('a', 'champinon', 60), 0], [receta('b', 'champinon', 60), 4]]); // lunes 14:00 → miércoles 14:00, 48 h
    expect(linea(calcularCarrito(dentro.tandas, gc, 1, {}, undefined, dentro.huecos), /Champiñones/).compras).toBe(1);
    const fuera = semana([[receta('a', 'champinon', 60), 0], [receta('b', 'champinon', 60), 12]]); // domingo 14:00, 144 h
    const l = linea(calcularCarrito(fuera.tandas, gc, 1, {}, undefined, fuera.huecos), /Champiñones/);
    expect(l.compras).toBe(2);
    expect(l.perecederoCoste).toBeGreaterThan(0);
  });

  it('un pack de tres briks se abre brik a brik', () => {
    const s = semana([[receta('a', 'tomate_frito', 200), 0], [receta('b', 'tomate_frito', 200), 13]]);
    const c = calcularCarrito(s.tandas, gc, 1, {}, undefined, s.huecos);
    const l = linea(c, /Tomate frito/);
    expect(l.compras).toBe(1);
    expect(l.sobranteAbierto).toBeCloseTo(0.02, 3);
    // El tercer brik, cerrado, sí sigue en casa.
    expect(existenciasTrasLaSemana(c)['17151']?.cantidad).toBeCloseTo(0.21, 3);
  });

  it('el plazo es del SKU de la ficha: otro producto para el mismo ingrediente no lo hereda', () => {
    const lomo = gc.ingredientes.lomo_cerdo;
    expect(horasAbiertoDe(lomo, gc.skus.lomo_cerdo)).toBe(48);
    expect(madrid.skus.lomo_cerdo.sku).not.toBe(gc.skus.lomo_cerdo.sku);
    expect(horasAbiertoDe(madrid.ingredientes.lomo_cerdo, madrid.skus.lomo_cerdo)).toBeUndefined();
  });
});
