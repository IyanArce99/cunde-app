import { numComensales, numHuecos, platosDeSemana } from '../state/types';
import type {
  Comensales, ComidasPref, DiaSemana, Esfuerzo, ItemLista, NivelProteina,
  Perfil, Preferencias, Variedad,
} from '../state/types';
import { peticionDe } from '../data/motor';
import { costeDeUnaVariedad, costesPorProteina, costesPorVariedad } from '../motor/seleccionar.ts';
import type { CosteOpcion } from '../motor/seleccionar.ts';
import type { Existencias } from '../motor/carrito.ts';
import type { PreferenciasPlatos } from './preferencias';
import { hoy } from './fechas';
import type { FechaDia } from './fechas';

/**
 * Coste de CONSUMO de la semana: lo que se come. NO es lo que se paga.
 * La cifra grande de Semana y el total de Compra van siempre con el carrito
 * (totalLista) — esto solo vale para estimaciones dentro de una hoja.
 */
export function totalPrevisto(dias: DiaSemana[], comensales: Comensales): number {
  const n = numComensales(comensales);
  return platosDeSemana(dias).reduce((sum, p) => sum + p.precioRacion * n, 0);
}

/* `costePersonaDia` se fue con `/semana/variante`, que era su único consumidor y
   no tenía test. Ajustes y Presupuesto sí enseñan «por persona y día», pero
   calculan sobre el TOPE y no sobre el total, y lo hacen en línea. */

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
/**
 * ═══ EL CONTEXTO ES LA SEMANA ENTERA, NO SOLO LOS SELECTORES ═══
 *
 * Los cuatro últimos campos faltaban, y la hoja de ajustes mentía por eso.
 *
 * Medido: con dos semanas de historial, la hoja enseñaba 63,14 € para una
 * semana que la app monta por 47,29 €. **15,85 € de desfase**, y siempre la
 * misma cifra pasara lo que pasara en la cuenta del usuario — porque la
 * estimación no sabía qué había en casa ni qué se comió la semana anterior.
 *
 * El síntoma que lo destapó: abrir «Ajustar la semana» sin tocar nada enseñaba
 * un «sube 2,37 €» que el usuario no había provocado. Y una vez tocado el
 * primer selector parecía funcionar, porque a partir de ahí se comparan dos
 * estimaciones calculadas igual de mal: coherentes entre sí, incoherentes con
 * la semana de verdad.
 *
 * En una app cuya única defensa es que sus cifras no mienten, esta era la peor
 * pantalla posible para tener este fallo.
 *
 * `regenerar()` en el reductor pasa estos cuatro al motor. Aquí tienen que
 * entrar los mismos o no se está estimando el mismo problema.
 */
export interface Contexto {
  comensales: Comensales;
  comidas: ComidasPref;
  esfuerzo: Esfuerzo;
  exclusiones: string[];
  presupuesto: number;
  variedad: Variedad;
  proteina: NivelProteina;
  postre: boolean;

  /** De él sale la silueta: qué días llevan hueco aprovechado. */
  semanaNumero?: number;
  /** Lo cocinado en semanas cerradas. Penaliza repetir. */
  historial?: string[][];
  /** Lo que ya hay en casa. Es lo que más mueve la cifra. */
  despensa?: Existencias;
  /** Favoritos y bloqueados. */
  preferenciasPlatos?: PreferenciasPlatos;
  /**
   * Con qué día empieza la semana. De aquí sale `ordenDias`, y de ahí dónde cae
   * la regla de fin de semana: sin él, la estimación reparte los huecos
   * aprovechados en días distintos de los de la semana real.
   */
  fechaInicioSemana?: FechaDia | null;
}

/**
 * ═══ UN SOLO CONSTRUCTOR DE PETICIÓN, Y ES EL DE LA APP ═══
 *
 * Esto armaba a mano su propio objeto para el motor. Al lado de
 * `data/motor.ts:peticionDe()`, que arma el de verdad. Dos constructores del
 * mismo objeto, y por supuesto se separaron:
 *
 *   · faltaba `ordenDias`, así que la regla de fin de semana caía en otro sitio
 *   · el historial se pasaba como `historial` y el motor lo lee de
 *     `recetasRecientes`: llegaba `undefined` y no penalizaba nada
 *   · las preferencias de platos igual — el motor quiere `platosBloqueados` y
 *     `platosFavoritos` ya derivados
 *   · y no llegaba ni la despensa ni el número de semana
 *
 * Ninguno de esos cuatro da error: son campos opcionales que el motor rellena
 * con vacío. Simplemente estimaba OTRA semana. Medido: 63,14 € en la hoja
 * contra 47,29 € reales con dos semanas de historial.
 *
 * Añadir los campos que faltaban habría arreglado el síntoma y dejado la causa:
 * dos constructores que hay que acordarse de mantener iguales. Así que ahora
 * hay uno. `Contexto` es una vista plana de `Perfil` + `Preferencias`, se
 * rearman y se delega.
 */
function peticion(ctx: Contexto) {
  const perfil = {
    comensales: ctx.comensales,
    presupuestoSemanal: ctx.presupuesto,
    /**
     * `hoy()` y no `null`.
     *
     * `peticionDe` llama a `diasDesde(fecha)`, que hace `fecha.split('-')` sin
     * comprobar nada: con `null` revienta y la hoja de ajustes se queda en
     * blanco. Pasó en cuanto esta función empezó a delegar en `peticionDe` —
     * antes no calculaba `ordenDias` y el nulo daba igual.
     *
     * `hoy()` es además el valor correcto: `presupuestoMinimoViable` no recibe
     * fecha porque el suelo del presupuesto no depende de en qué día empiece la
     * semana, pero el motor necesita UN orden de días para repartir los huecos.
     */
    fechaInicioSemana: ctx.fechaInicioSemana ?? hoy(),
  } as Perfil;

  const preferencias = {
    comidas: ctx.comidas,
    esfuerzo: ctx.esfuerzo,
    variedad: ctx.variedad,
    proteina: ctx.proteina,
    exclusiones: ctx.exclusiones,
    postre: ctx.postre,
    variedadElegida: true,
  } as Preferencias;

  /* Los valores por defecto son los de una cuenta recién instalada, que es
     exactamente el caso en que la hoja ya acertaba antes del arreglo. */
  return peticionDe(
    perfil,
    preferencias,
    ctx.semanaNumero ?? 1,
    ctx.historial ?? [],
    ctx.despensa ?? {},
    ctx.preferenciasPlatos ?? {},
  );
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
/**
 * ═══ Y LA CLAVE TIENE QUE LLEVAR EL ESTADO, O LA CACHÉ MIENTE IGUAL ═══
 *
 * Añadir despensa e historial a la petición sin añadirlos aquí sería cambiar un
 * fallo por otro peor: la primera consulta se guardaría con la despensa de hoy
 * y se devolvería tal cual la semana que viene, cuando ya no queda nada en casa.
 *
 * De la despensa y el historial se guarda una HUELLA, no el contenido: son
 * objetos grandes y lo único que importa es si cambiaron. `JSON.stringify` de
 * la despensa entera en cada consulta sería el mismo coste que se intentaba
 * evitar con la caché.
 */
const huellaDespensa = (d?: Existencias) => {
  if (!d) return '0';
  const claves = Object.keys(d);
  if (claves.length === 0) return '0';
  /* Número de líneas y suma de cantidades: cambia si entra, sale o se gasta
     algo. Dos despensas distintas con la misma suma exacta son posibles pero
     irrelevantes — darían semanas equivalentes. */
  let total = 0;
  for (const k of claves) total += (d[k] as { cantidad?: number })?.cantidad ?? 0;
  return `${claves.length}:${Math.round(total)}`;
};

const clave = (ctx: Contexto, que: string, ejeVariable: 'variedad' | 'proteina') =>
  `${que}|${ctx.comensales}|${ctx.comidas}|${ctx.esfuerzo}|${ctx.exclusiones.join(',')}`
  + `|${ctx.presupuesto}|${ctx.postre}`
  + `|${ejeVariable === 'variedad' ? ctx.proteina : ctx.variedad}`
  + `|s${ctx.semanaNumero ?? 1}`
  + `|h${(ctx.historial ?? []).length}`
  + `|d${huellaDespensa(ctx.despensa)}`
  + `|p${Object.keys(ctx.preferenciasPlatos ?? {}).length}`
  + `|f${ctx.fechaInicioSemana ?? '-'}`;

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
  /**
   * Sin techo: es el suelo de lo que puede costar la semana más barata.
   *
   * Y SIN DESPENSA a propósito, aunque `Contexto` ya la admita. El suelo del
   * deslizador es «cuánto hace falta para comer una semana», no «cuánto hace
   * falta esta semana concreta». Si la despensa lo bajara, alguien con la
   * alacena llena pondría el tope en 38 €, y a la semana siguiente —con la
   * despensa gastada— la app no le cuadraría las cuentas con el tope que ella
   * misma le dejó poner.
   *
   * El suelo tiene que ser sostenible, no óptimo para hoy.
   */
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
