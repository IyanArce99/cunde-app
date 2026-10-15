/**
 * ═══ ENVASE COMPARTIDO · DOS RECETAS, UNA BANDEJA, DENTRO DE PLAZO ═══
 *
 * Ver ENVASE COMPARTIDO en construir(). Comprueba que:
 *   · dos recetas distintas pueden repartirse una bandeja fresca, y lo hacen
 *     dentro de su plazo (incluido el de «una vez abierto» de la ficha);
 *   · quitar una de las dos con «No cocino» no sube la compra y el sobrante
 *     sale igual que si se calculara de cero;
 *   · con presupuesto justo, la búsqueda no se dispara.
 */
import { describe, expect, it } from 'vitest';
import datosJson from '../data/motor-datos.json';
import granCanaria from '../data/zonas/gran-canaria.json';
import { calcularCarrito, esCongelado } from './carrito.ts';
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

/** Para cada producto fresco de carne o pescado: los días (posición) en que lo cocina cada receta. */
function usosFrescos(s: SemanaGenerada, datos: DatosMotor) {
  const m = new Map<string, { recetas: Set<string>; dias: number[] }>();
  for (const t of s.tandas) {
    const h = s.huecos.find((x) => x.receta?.id === t.receta.id && x.tipo === 'cocinado');
    if (!h) continue;
    for (const ing of t.receta.ingredientes) {
      const meta = datos.ingredientes[ing.canonico];
      const sku = datos.skus[ing.canonico];
      if (!sku || esCongelado(sku) || !['carne', 'pescado', 'marisco'].includes(meta.origen)) continue;
      const x = m.get(ing.canonico) ?? { recetas: new Set<string>(), dias: [] };
      x.recetas.add(t.receta.id);
      x.dias.push(DIAS.indexOf(h.dia));
      m.set(ing.canonico, x);
    }
  }
  return m;
}

describe('envase compartido', () => {
  it('Gran Canaria 60 €: la pechuga la reparten dos recetas distintas, dentro de las 24 h de abierta', () => {
    const s = generarSemana(pet(gc, 60));
    const p = usosFrescos(s, gc).get('pechuga_pollo');
    expect(p?.recetas.size).toBeGreaterThanOrEqual(2);
    const horas = gc.ingredientes.pechuga_pollo.horas_abierto!;
    expect(Math.max(...p!.dias) - Math.min(...p!.dias)).toBeLessThanOrEqual(Math.floor(horas / 24));
    expect(Math.max(...p!.dias)).toBeLessThanOrEqual(gc.ingredientes.pechuga_pollo.dias_conservacion - 1);
  }, 30000);

  it('ninguna carne o pescado fresco se reutiliza fuera de plazo (60, 80 y 100 €, GC y Madrid)', () => {
    for (const datos of [gc, madrid]) {
      for (const tope of [60, 80, 100]) {
        for (const [canonico, x] of usosFrescos(generarSemana(pet(datos, tope)), datos)) {
          if (x.recetas.size < 2) continue;
          const meta = datos.ingredientes[canonico];
          const abierto = meta.horas_abierto ? Math.floor(meta.horas_abierto / 24) : Infinity;
          expect(Math.max(...x.dias), `${canonico} ${tope} €`).toBeLessThanOrEqual(Math.min(meta.dias_conservacion - 1, Math.min(...x.dias) + abierto));
        }
      }
    }
  }, 60000);

  it('«No cocino» en una de las dos: la compra no sube y el sobrante es el de calcularlo de cero', () => {
    const p = pet(gc, 60);
    const s = generarSemana(p);
    const pareja = [...usosFrescos(s, gc).values()].find((x) => x.recetas.size >= 2)!;
    const id = [...pareja.recetas][1];
    const i = s.huecos.findIndex((h) => h.receta?.id === id && h.tipo === 'cocinado');
    const r = liberarHueco(p, s, i);
    expect(r.carrito.totalCarrito).toBeLessThanOrEqual(s.carrito.totalCarrito + 0.005);
    expect(r.carrito.totalPerecedero).toBeCloseTo(calcularCarrito(r.tandas, gc, 2, {}, r.postres).totalPerecedero, 2);
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
