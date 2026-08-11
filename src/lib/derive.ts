import { numComensales, numHuecos, platosDeSemana } from '../state/types';
import type {
  Comensales, ComidasPref, DiaSemana, Esfuerzo, ItemLista, NivelProteina, Variedad,
} from '../state/types';
import { datos } from '../data/motor';
import { costeDeUnaVariedad, costesPorProteina, costesPorVariedad } from '../motor/seleccionar.ts';
import type { CosteOpcion } from '../motor/seleccionar.ts';

/**
 * Coste de CONSUMO de la semana: lo que se come. NO es lo que se paga.
 * La cifra grande de Semana y el total de Compra van siempre con el carrito
 * (totalLista) — esto solo vale para estimaciones dentro de una hoja.
 */
export function totalPrevisto(dias: DiaSemana[], comensales: Comensales): number {
  const n = numComensales(comensales);
  return platosDeSemana(dias).reduce((sum, p) => sum + p.precioRacion * n, 0);
}

export function costePersonaDia(total: number, comensales: Comensales): number {
  return total / 7 / numComensales(comensales);
}

export function costePorHueco(presupuesto: number, comensales: Comensales, comidas: ComidasPref): number {
  return presupuesto / numHuecos(comidas) / numComensales(comensales);
}

/**
 * Suelo de presupuesto por debajo del cual no hay semana que cuadre: el
 * carrito de la semana más barata que el motor puede montar (poca variedad).
 * Lo calcula el propio motor con el catálogo real — no es una constante de
 * 3 €/persona/día, que se fijó cuando la semana eran 7 comidas.
 *
 * Con memo porque la pantalla de Presupuesto lo pide en cada movimiento del
 * deslizador y una generación completa son decenas de milisegundos.
 */
const cacheCostes = new Map<string, unknown>();

/** Lo que la pantalla necesita para pedirle una estimación al motor. */
export interface Contexto {
  comensales: Comensales;
  comidas: ComidasPref;
  esfuerzo: Esfuerzo;
  exclusiones: string[];
  presupuesto: number;
  variedad: Variedad;
  proteina: NivelProteina;
  postre: boolean;
}

function peticion(ctx: Contexto) {
  // El presupuesto entra en la petición porque forma parte de la función
  // objetivo: sin él, el motor no tiene techo y monta semanas más caras que
  // las que luego genera de verdad. Sin este parámetro, la pantalla prometía
  // 56,72 € y la semana salía por 49,52 €.
  return {
    datos,
    N: numComensales(ctx.comensales),
    numHuecos: numHuecos(ctx.comidas),
    esfuerzo: ctx.esfuerzo,
    exclusiones: ctx.exclusiones,
    presupuesto: ctx.presupuesto,
    variedad: ctx.variedad,
    proteina: ctx.proteina,
    postre: ctx.postre,
  };
}

/**
 * La clave lleva el eje que el cálculo NO recorre, y solo ese.
 *
 * `costesPorVariedad` pisa `variedad` en cada vuelta —devuelve las tres— así
 * que su resultado no depende de la variedad puesta; sí depende de la
 * proteína. Con `variedad` dentro de la clave, elegir "Mucha" invalidaba la
 * entrada y el motor montaba tres semanas enteras para devolver exactamente lo
 * mismo que ya tenía guardado. Medido en el navegador: 7,8 s de hilo bloqueado
 * por toque dentro de la hoja de ajustes. Simétrico para la proteína.
 */
const clave = (ctx: Contexto, que: string, ejeVariable: 'variedad' | 'proteina') =>
  `${que}|${ctx.comensales}|${ctx.comidas}|${ctx.esfuerzo}|${ctx.exclusiones.join(',')}`
  + `|${ctx.presupuesto}|${ctx.postre}`
  + `|${ejeVariable === 'variedad' ? ctx.proteina : ctx.variedad}`;

function conCache<T>(k: string, calcular: () => T): T {
  if (!cacheCostes.has(k)) cacheCostes.set(k, calcular());
  return cacheCostes.get(k) as T;
}

export function costesDeVariedad(ctx: Contexto): Record<Variedad, CosteOpcion> {
  return conCache(clave(ctx, 'variedad', 'variedad'), () => costesPorVariedad(peticion(ctx)));
}

export function costesDeProteina(ctx: Contexto): Record<NivelProteina, CosteOpcion> {
  return conCache(clave(ctx, 'proteina', 'proteina'), () => costesPorProteina(peticion(ctx)));
}

export function presupuestoMinimoViable(
  comensales: Comensales,
  comidas: ComidasPref,
  esfuerzo: Esfuerzo = 'libre',
  exclusiones: string[] = [],
  proteina: NivelProteina = 'normal',
  /**
   * El postre CUENTA en el suelo, y no es una decisión menor.
   *
   * Estuvo fuera mientras el interruptor vivía solo en los ajustes: meterlo
   * habría subido el mínimo que ve todo el mundo en el paso 2/3 por algo que
   * la mayoría no había pedido.
   *
   * Ahora el interruptor está en esa misma pantalla, treinta píxeles debajo de
   * la línea del suelo. Si el suelo no se moviera al encenderlo, el usuario
   * vería un interruptor que no hace nada — y esta app se sostiene justo sobre
   * lo contrario: que los números se muevan al tocar.
   */
  postre = false,
): number {
  // Sin techo: es el suelo de lo que puede costar la semana más barata.
  const ctx: Contexto = {
    comensales, comidas, esfuerzo, exclusiones, presupuesto: Infinity, variedad: 'poca', proteina,
    postre,
  };
  /**
   * Solo "poca", no las tres. Esto lo pide la línea viva del paso 2/3 en cada
   * cambio de comensales, y pedir el juego completo construía tres semanas
   * para quedarse con una: 448 ms de hilo bloqueado donde bastan 150.
   */
  const k = clave(ctx, 'suelo', 'variedad') + '|poca';
  return Math.ceil(conCache(k, () => costeDeUnaVariedad(peticion(ctx), 'poca')).carrito);
}

/**
 * Un producto entra en las cuentas salvo que ya lo tengas en casa — sea de
 * despensa (aceite, sal) o sobrante de una semana anterior. Ver
 * ItemLista.loTengo: es un estado independiente de enElCarro.
 */
function cuentaEnElTotal(it: ItemLista): boolean {
  if (it.esDespensa || it.yaEnCasa) return it.loTengo === false;
  return true;
}

export function totalLista(lista: ItemLista[]): number {
  return lista.reduce((sum, it) => (cuentaEnElTotal(it) ? sum + it.precio : sum), 0);
}

export function totalLlevas(lista: ItemLista[]): number {
  return lista.reduce((sum, it) => (cuentaEnElTotal(it) && it.enElCarro ? sum + it.precio : sum), 0);
}

export function subtotalPasillo(lista: ItemLista[], pasillo: string): number {
  return lista.filter((it) => it.pasillo === pasillo).reduce((sum, it) => sum + it.precio, 0);
}

export function pasillosOrdenados(lista: ItemLista[]): string[] {
  const vistos = new Set<string>();
  const orden: string[] = [];
  for (const it of lista) {
    if (!vistos.has(it.pasillo)) {
      vistos.add(it.pasillo);
      orden.push(it.pasillo);
    }
  }
  return orden;
}

const SIETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Nº de semana real, sin depender solo de que el usuario cierre la compra
 * (paso que el propio producto marca como saltable). Si han pasado 7+ días
 * desde que se generó la semana en curso, se considera semana 2+ igualmente.
 */
export function semanaEfectiva(semanaNumero: number, generadaEn: number): number {
  if (!generadaEn) return semanaNumero;
  const semanasPorTiempo = 1 + Math.floor((Date.now() - generadaEn) / SIETE_DIAS_MS);
  return Math.max(semanaNumero, semanasPorTiempo);
}
