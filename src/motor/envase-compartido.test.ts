/**
 * ═══ ENVASE COMPARTIDO · DOS RECETAS, UNA BANDEJA, DENTRO DE PLAZO ═══
 *
 * Ver ENVASE COMPARTIDO en construir(). Comprueba que:
 *   · dos recetas distintas pueden repartirse una bandeja, y lo hacen dentro de
 *     las horas «una vez abierto» de su ficha, contadas por huecos (14:00 y
 *     21:00), y si sobra algo el carrito final lo cobra;
 *   · quitar una de las dos con «No cocino» no sube la compra y el sobrante
 *     sale igual que si se calculara de cero;
 *   · con presupuesto justo, la búsqueda no se dispara.
 */
import { describe, expect, it } from 'vitest';
import datosJson from '../data/motor-datos.json';
import granCanaria from '../data/zonas/gran-canaria.json';
import { calcularCarrito, esCongelado, horasAbiertoDe } from './carrito.ts';
import { activarTelemetria, desactivarTelemetria, generarSemana, liberarHueco } from './seleccionar.ts';
import type { PeticionSemana, SemanaGenerada } from './seleccionar.ts';
import { datosDeZona } from './zona.ts';
import type { CatalogoZona } from './zona.ts';
import { DIAS } from './tipos.ts';
import type { DatosMotor } from './tipos.ts';

const madrid = datosJson as unknown as DatosMotor;
const gc = datosDeZona(madrid, granCanaria as unknown as CatalogoZona, '3120');
const pet = (datos: DatosMotor, presupuesto: number, extra: Partial<PeticionSemana> = {}): PeticionSemana => ({
  datos, N: 2, numHuecos: 14, variedad: 'mucha', proteina: 'normal', esfuerzo: 'libre', exclusiones: [],
  presupuesto, semanaNumero: 1, recetasRecientes: [], existencias: {}, ordenDias: DIAS, ...extra,
});

/** Ver PLAZOS en construir(): comida a las 14:00, cena a las 21:00. */
const HORA: Record<string, number> = { comida: 14, cena: 21 };
const FAVORITOS = [
  'pollo_limon', 'pollo_guisado_patata', 'jamoncitos_ajillo_champinones', 'pollo_puerro_crema',
  'jamoncitos_horno_patata_zanahoria', 'pollo_judias_almendra', 'ensalada_pollo_maiz',
  'lomo_pimientos_horno', 'lomo_ajillo_champinones', 'lomo_champinones_crema', 'lomo_almendra_alcachofas',
];

/**
 * Para cada producto con crédito de envase compartido —carne, pescado o
 * marisco con horas de abierto en la ficha de SU SKU—: las horas (desde el
 * lunes 0:00) en que lo cocina cada receta. Los botes y briks con ficha no
 * entran aquí: no tienen crédito, y si se reparten fuera de plazo el carrito
 * compra otro (ver envases-abiertos.test.ts).
 */
function usosConFicha(s: SemanaGenerada, datos: DatosMotor) {
  const m = new Map<string, { recetas: Set<string>; horas: number[] }>();
  for (const t of s.tandas) {
    const h = s.huecos.find((x) => x.receta?.id === t.receta.id && x.tipo === 'cocinado');
    if (!h) continue;
    for (const ing of t.receta.ingredientes) {
      const meta = datos.ingredientes[ing.canonico];
      const sku = datos.skus[ing.canonico];
      if (!sku || esCongelado(sku) || !horasAbiertoDe(meta, sku) || !['carne', 'pescado', 'marisco'].includes(meta.origen ?? '')) continue;
      const x = m.get(ing.canonico) ?? { recetas: new Set<string>(), horas: [] };
      x.recetas.add(t.receta.id);
      x.horas.push(DIAS.indexOf(h.dia) * 24 + HORA[h.ranura]);
      m.set(ing.canonico, x);
    }
  }
  return m;
}

describe('envase compartido', () => {
  it('100 € con favoritos de carne: pechuga y lomo los reparten dos recetas distintas dentro de las horas de la ficha', () => {
    const s = generarSemana(pet(gc, 100, { platosFavoritos: FAVORITOS }));
    for (const c of ['pechuga_pollo', 'lomo_cerdo']) {
      const x = usosConFicha(s, gc).get(c);
      expect(x?.recetas.size, c).toBeGreaterThanOrEqual(2);
      expect(Math.max(...x!.horas) - Math.min(...x!.horas), c).toBeLessThan(gc.ingredientes[c].horas_abierto!);
    }
  }, 30000);

  it('ningún producto con ficha de abierto se reparte fuera de sus horas (60, 80 y 100 €, GC y Madrid, con y sin favoritos)', () => {
    for (const datos of [gc, madrid]) {
      for (const tope of [60, 80, 100]) {
        for (const extra of [{}, { platosFavoritos: FAVORITOS }]) {
          const s = generarSemana(pet(datos, tope, extra));
          for (const [canonico, x] of usosConFicha(s, datos)) {
            if (x.recetas.size < 2) continue;
            expect(Math.max(...x.horas) - Math.min(...x.horas), `${canonico} ${tope} €`).toBeLessThan(datos.ingredientes[canonico].horas_abierto!);
          }
          // Y si sobra algo de esos productos, el carrito final lo cobra.
          for (const l of s.carrito.lineas) {
            if (!usosConFicha(s, datos).has(l.canonicos[0]) || l.sobranteCantidad <= 0.001) continue;
            expect(l.perecederoCoste, `${l.nombre} ${tope} €`).toBeGreaterThan(0);
          }
        }
      }
    }
  }, 120000);

  it('rehacer la semana con favoritos nuevos no devuelve la semana anterior sin ellos', () => {
    const general = generarSemana(pet(gc, 100));
    const rehecha = generarSemana(pet(gc, 100, { platosFavoritos: FAVORITOS, semanaPrevia: { huecos: general.huecos, tandas: general.tandas } }));
    const n = (s: SemanaGenerada) => new Set(s.tandas.map((t) => t.receta.id).filter((id) => FAVORITOS.includes(id))).size;
    expect(n(rehecha)).toBeGreaterThan(n(general));
    expect(rehecha.carrito.totalCarrito).toBeLessThanOrEqual(100);
  }, 30000);

  it('«No cocino» en una de las dos: la compra no sube y el sobrante es el de calcularlo de cero', () => {
    const p = pet(gc, 100, { platosFavoritos: FAVORITOS });
    const s = generarSemana(p);
    const pareja = usosConFicha(s, gc).get('pechuga_pollo')!;
    const id = [...pareja.recetas][1];
    const i = s.huecos.findIndex((h) => h.receta?.id === id && h.tipo === 'cocinado');
    const r = liberarHueco(p, s, i);
    expect(r.carrito.totalCarrito).toBeLessThanOrEqual(s.carrito.totalCarrito + 0.005);
    expect(r.carrito.totalPerecedero).toBeGreaterThan(s.carrito.totalPerecedero);
    expect(r.carrito.totalPerecedero).toBeCloseTo(calcularCarrito(r.tandas, gc, 2, {}, r.postres, r.huecos).totalPerecedero, 2);
  }, 30000);

  it('con presupuesto justo no se dispara la búsqueda (como mucho el doble de candidatos que sin el envase compartido)', () => {
    const contar = (extra: Partial<PeticionSemana>) => {
      const t = activarTelemetria();
      generarSemana({ ...pet(madrid, 45), variedad: 'normal', ...extra });
      desactivarTelemetria();
      return t.candidato_evaluado ?? 0;
    };
    expect(contar({})).toBeLessThanOrEqual(2 * contar({ sinEnvaseCompartido: true }) + 100);
  }, 60000);
});
