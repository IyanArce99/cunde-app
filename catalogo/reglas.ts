/**
 * LAS REGLAS DEL RECETARIO, EN UN SOLO SITIO.
 *
 * Esto existe por un fallo de proceso, no por uno de código. La regla de la
 * sal cambió de "1-1,2 g por 100 g de producto principal" a "1,5-2,5 g por
 * ración" y solo se aplicó a los lotes que se escribieron DESPUÉS. La mitad
 * del recetario se quedó con la regla vieja durante semanas, y ninguna
 * métrica lo iba a detectar porque la sal no mueve dinero.
 *
 * Por eso las reglas viven aquí y no dentro del validador de lotes:
 *   · catalogo/revisar-lote.ts  las aplica al lote que se está escribiendo
 *   · catalogo/coherencia.ts    las aplica a las 72, vengan del lote que
 *                               vengan, y corre en el build
 *
 * Cambiar una regla es cambiar una función de este fichero. A partir de ese
 * momento el build falla para TODA receta que no la cumpla, sea de hoy o del
 * piloto. Una regla no puede volver a aplicarse solo hacia delante.
 */

import { esConserva, SIN_SKU } from '../src/motor/carrito.ts';
import type { DatosMotor, IngredienteCanonico, IngredienteReceta, Receta, Sku } from '../src/motor/tipos.ts';

export interface Fallo {
  receta: string;
  regla: string;
  detalle: string;
  /** `error` rompe el build. `aviso` se reporta y no lo rompe. */
  nivel: 'error' | 'aviso';
}

/** Lo mínimo que necesita una regla: una receta y el vocabulario. */
export interface Contexto {
  datos: DatosMotor;
  /** Nombre para el informe: receta o ensamblaje. */
  nombre: string;
  ingredientes: IngredienteReceta[];
  /** Los ensamblajes no llevan sal propia ni ratios: se montan sobre otro. */
  esEnsamblaje: boolean;
  receta?: Receta;
}

const meta = (ctx: Contexto, canonico: string) => ctx.datos.ingredientes[canonico];
const sku = (ctx: Contexto, canonico: string): Sku | undefined => ctx.datos.skus[canonico];

// ---------------------------------------------------------------------------
// 1 · Sal
// ---------------------------------------------------------------------------

const SAL_MIN = 1.5;
const SAL_MAX = 2.5;

/**
 * Por RACIÓN, no por peso del plato. La regla anterior ponía 4-5 g en un
 * pisto: la ingesta diaria recomendada entera en un plato. Va en despensa,
 * fuera del total, así que no mueve el carrito y solo la caza esto.
 */
function reglaSal(ctx: Contexto): Fallo[] {
  const sal = ctx.ingredientes.find((i) => i.canonico === 'sal');
  if (!sal) {
    // Un plato sin sal es sospechoso salvo que sea un ensamblaje (se monta
    // sobre algo ya salado) o un plato en crudo.
    if (ctx.esEnsamblaje) return [];
    return [{ receta: ctx.nombre, regla: 'sal', detalle: 'no lleva sal', nivel: 'aviso' }];
  }
  if (sal.cantidad < SAL_MIN || sal.cantidad > SAL_MAX) {
    return [{
      receta: ctx.nombre,
      regla: 'sal',
      detalle: `${sal.cantidad} g por ración (la regla vigente es ${SAL_MIN}-${SAL_MAX})`,
      nivel: 'error',
    }];
  }
  return [];
}

// ---------------------------------------------------------------------------
// 2 · Marcas de escalado
// ---------------------------------------------------------------------------

/**
 * lineal    → proteína, verdura, legumbre, arroz, pasta. Multiplica por N.
 * sublineal → especias, ajo, aceite de sofreír, sal. N^0.7.
 * fijo      → hoja de laurel, chorro de vinagre, pastilla de caldo.
 *
 * La comprobación es estructural, no una lista de nombres: lo que va en
 * despensa se sofríe o se espolvorea, así que no puede escalar lineal — con
 * cuatro comensales saldrían cuatro veces el pimentón. La excepción es el
 * agua, que TIENE que escalar lineal para no romper el ratio del arroz.
 */
function reglaEscalado(ctx: Contexto): Fallo[] {
  const fallos: Fallo[] = [];
  for (const ing of ctx.ingredientes) {
    const m = meta(ctx, ing.canonico);
    if (!m) continue;
    if (m.es_despensa && ing.escalado === 'lineal' && !SIN_SKU.has(ing.canonico)) {
      fallos.push({
        receta: ctx.nombre,
        regla: 'escalado',
        detalle: `"${ing.canonico}" es despensa y escala lineal: con 4 comensales sale ×4`,
        nivel: 'error',
      });
    }
    if (!m.es_despensa && ing.escalado !== 'lineal') {
      // Solo el ajo y el limón se salvan: son aromáticos aunque se compren
      // en la sección de fresco.
      const aromatico = ['ajo', 'limon'].includes(ing.canonico);
      if (!aromatico) {
        fallos.push({
          receta: ctx.nombre,
          regla: 'escalado',
          detalle: `"${ing.canonico}" no es despensa y escala ${ing.escalado}: con 4 comensales falta comida`,
          nivel: 'error',
        });
      }
    }
  }
  return fallos;
}

/**
 * Y el mismo ingrediente no puede escalar de dos formas distintas en dos
 * recetas: o el chorro de vinagre es fijo o es sublineal, pero no las dos.
 * Es exactamente la forma que tuvo el fallo de la sal — una regla aplicada a
 * medias.
 */
export function reglaEscaladoConsistente(recetas: Contexto[]): Fallo[] {
  const escalados = new Map<string, Map<string, string[]>>();
  for (const ctx of recetas) {
    for (const ing of ctx.ingredientes) {
      if (!escalados.has(ing.canonico)) escalados.set(ing.canonico, new Map());
      const porEscalado = escalados.get(ing.canonico)!;
      if (!porEscalado.has(ing.escalado)) porEscalado.set(ing.escalado, []);
      porEscalado.get(ing.escalado)!.push(ctx.nombre);
    }
  }
  const fallos: Fallo[] = [];
  for (const [canonico, porEscalado] of escalados) {
    if (porEscalado.size <= 1) continue;
    const resumen = [...porEscalado].map(([e, rs]) => `${e} en ${rs.length} (${rs[0]})`).join(' · ');
    fallos.push({
      receta: '(varias)',
      regla: 'escalado consistente',
      detalle: `"${canonico}" escala de ${porEscalado.size} formas distintas: ${resumen}`,
      nivel: 'error',
    });
  }
  return fallos;
}

// ---------------------------------------------------------------------------
// 3 · Rendimiento comestible
// ---------------------------------------------------------------------------

/**
 * Hueso, espina, piel y cáscara se pagan pero no alimentan. Si el producto
 * elegido los lleva, `rendimiento_comestible` tiene que decirlo — si no, el
 * motor cuenta 155 g de costilla como 155 g de carne y la proteína de la
 * semana entera sale inflada. Se detecta por el NOMBRE DEL PRODUCTO REAL, que
 * es donde está la información, no por el nombre del canónico.
 */
// "Troceado" NO está aquí a propósito: significa cortado, no con hueso, y
// daba por malo el espárrago verde troceado ultracongelado, que se come
// entero. Las palabras de esta lista tienen que hablar de DESPERDICIO.
const DELATORAS_HUESO = [
  'con hueso', 'sin deshuesar', 'sin limpiar', 'entero', 'entera',
  'costilla', 'jamoncito', 'muslo', 'alita', 'chuleta', 'churrasco',
];
const DELATORAS_LIMPIO = ['deshuesad', 'filete', 'lomo', 'pechuga', 'limpio', 'pelad'];

export function reglaRendimiento(datos: DatosMotor): Fallo[] {
  const fallos: Fallo[] = [];
  const normalizar = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  for (const [canonico, s] of Object.entries(datos.skus)) {
    const m = datos.ingredientes[canonico];
    if (!m) continue;
    const nombre = normalizar(s.nombre);
    const rend = m.rendimiento_comestible ?? 1;
    const suenaAHueso = DELATORAS_HUESO.some((p) => nombre.includes(p));
    const suenaALimpio = DELATORAS_LIMPIO.some((p) => nombre.includes(p));

    if (suenaAHueso && !suenaALimpio && rend >= 1) {
      fallos.push({
        receta: canonico,
        regla: 'rendimiento',
        detalle: `"${s.nombre}" suena a producto con desperdicio y rendimiento_comestible es 1`,
        nivel: 'error',
      });
    }
    if (suenaALimpio && !suenaAHueso && rend < 1) {
      fallos.push({
        receta: canonico,
        regla: 'rendimiento',
        detalle: `"${s.nombre}" viene ya limpio y aun así rendimiento_comestible es ${rend}`,
        nivel: 'error',
      });
    }
    // Una conserva ya viene preparada: descontar merma otra vez es contarla
    // dos veces (el corazón de alcachofa en bote es 100% comestible). Salvo
    // que el propio nombre diga lo contrario — las aceitunas CON HUESO van en
    // tarro y el hueso sigue ahí. Sin esta salvedad, las dos reglas de este
    // fichero se contradecían y no había forma de dejar el build en verde.
    if (esConserva(s) && rend < 1 && !suenaAHueso) {
      fallos.push({
        receta: canonico,
        regla: 'rendimiento',
        detalle: `"${s.nombre}" es conserva (ya viene limpia) y descuenta un ${((1 - rend) * 100).toFixed(0)}% de merma`,
        nivel: 'error',
      });
    }
  }
  return fallos;
}

// ---------------------------------------------------------------------------
// 4 · Días de conservación según la presentación
// ---------------------------------------------------------------------------

/**
 * `dias_conservacion` describe el ingrediente FRESCO; el motor lo sube a 365
 * cuando el producto elegido es congelado o conserva (ver diasEfectivos).
 * El error posible es el contrario: darle 365 a un canónico que se compra
 * fresco, con lo que el optimizador cree que la merluza aguanta un año y
 * deja de penalizar el sobrante.
 */
const DIAS_LARGOS = 180;

/**
 * Solo se comprueba sobre producto ANIMAL. El arroz, la pasta y la legumbre
 * seca duran un año de verdad sin ser conserva ni congelado, así que una
 * primera versión de esta regla los daba por malos: 15 falsos positivos. Lo
 * que de verdad no puede pasar es que una carne o un pescado FRESCOS lleven
 * conservación larga, porque entonces el motor deja de penalizar su sobrante
 * y el perecedero sale a cero cuando en realidad se tira.
 */
const PERECEDEROS = new Set(['carne', 'pescado', 'marisco', 'lacteo', 'huevo']);

export function reglaConservacion(datos: DatosMotor): Fallo[] {
  const fallos: Fallo[] = [];
  for (const [canonico, s] of Object.entries(datos.skus)) {
    const m = datos.ingredientes[canonico];
    if (!m) continue;
    const largo = esConserva(s) || s.departamento === 'Congelados' || /congelad/i.test(s.nombre);
    if (!largo && PERECEDEROS.has(m.origen) && m.dias_conservacion >= DIAS_LARGOS) {
      fallos.push({
        receta: canonico,
        regla: 'conservacion',
        detalle: `${m.dias_conservacion} días pero "${s.nombre}" es ${m.origen} fresco: el motor no penalizará su sobrante`,
        nivel: 'error',
      });
    }
    if (m.es_despensa && m.dias_conservacion < DIAS_LARGOS) {
      fallos.push({
        receta: canonico,
        regla: 'conservacion',
        detalle: `es despensa pero solo aguanta ${m.dias_conservacion} días: la despensa se supone que ya la tienes`,
        nivel: 'error',
      });
    }
  }
  return fallos;
}

// ---------------------------------------------------------------------------
// 5 · es_despensa como dato
// ---------------------------------------------------------------------------

/**
 * La despensa queda FUERA del total y se le supone al usuario. Eso solo vale
 * para lo que se usa a cucharadas y se tiene en casa. Si un ingrediente de
 * despensa pesa de verdad en el plato, el total miente por abajo.
 */
const CENTIMOS_MAXIMOS_DESPENSA = 0.15;

export function reglaDespensa(datos: DatosMotor, contextos: Contexto[]): Fallo[] {
  const fallos: Fallo[] = [];
  const N = 2;
  for (const ctx of contextos) {
    for (const ing of ctx.ingredientes) {
      const m = meta(ctx, ing.canonico);
      const s = sku(ctx, ing.canonico);
      if (!m?.es_despensa || !s || SIN_SKU.has(ing.canonico)) continue;
      // Coste real de lo que se usa por ración, aunque no entre en el total.
      const enCatalogo = ing.unidad === 'g' && s.unidad === 'kg' ? ing.cantidad / 1000
        : ing.unidad === 'ml' && s.unidad === 'l' ? ing.cantidad / 1000
          : ing.cantidad;
      const coste = enCatalogo * s.precio_kg_l_ud;
      if (coste > CENTIMOS_MAXIMOS_DESPENSA) {
        fallos.push({
          receta: ctx.nombre,
          regla: 'despensa',
          detalle: `"${ing.canonico}" va en despensa pero cuesta ${coste.toFixed(2)} €/ración: sale del total y el precio miente`,
          nivel: 'error',
        });
      }
    }
  }
  void N;
  return fallos;
}

// ---------------------------------------------------------------------------
// 6 · Cantidades por ración plausibles para UNA persona
// ---------------------------------------------------------------------------

/**
 * Los topes van por CATEGORÍA deducida del propio vocabulario (origen, base,
 * unidad, despensa), no por una lista de ingredientes — una lista se queda
 * atrás en cuanto entra un canónico nuevo, que es el fallo que estamos
 * arreglando.
 */
interface Rango { min: number; max: number; que: string }

/**
 * El tope que importa es el ALTO: es el que caza la ración de 250 g de
 * jamoncito o los tres huevos por persona. El bajo solo está para pillar
 * disparates (un gramo de carne), no para opinar sobre la receta — 30 g de
 * chorizo en unas lentejas o 70 g de patata de guarnición son correctos, y
 * una primera versión de esta regla los daba por error en 67 sitios.
 *
 * La categoría sale de la MARCA DE ESCALADO antes que de nada: lo que escala
 * sublineal o fijo se usa a cucharadas por definición, sea despensa o no. El
 * ajo y el limón no van en despensa y son aromáticos igual.
 */
export function rangoDe(m: IngredienteCanonico, canonico: string, escalado?: string): Rango {
  if (SIN_SKU.has(canonico)) return { min: 20, max: 400, que: 'agua' };

  if (escalado === 'sublineal' || escalado === 'fijo' || m.es_despensa) {
    if (m.unidad_base === 'ml') return { min: 1, max: 30, que: 'aceite, vinagre o chorro' };
    if (m.unidad_base === 'ud') return { min: 0.1, max: 3, que: 'aromático por piezas' };
    return { min: 0.05, max: 15, que: 'especia, sal o ajo' };
  }

  if (m.unidad_base === 'ml') return { min: 20, max: 320, que: 'caldo o bebida' };
  if (m.unidad_base === 'ud') return { min: 0.2, max: 3, que: 'pieza (huevo, lata)' };
  if (['carne', 'pescado', 'marisco'].includes(m.origen)) return { min: 20, max: 260, que: 'proteína animal' };
  if (m.origen === 'lacteo') return { min: 10, max: 120, que: 'lácteo' };
  // Cereal y legumbre SECOS pesan un tercio de lo que pesan cocidos, y la
  // soja texturizada la mitad otra vez.
  const seco = m.base != null && m.dias_conservacion >= DIAS_LARGOS && !/cocid/.test(canonico);
  if (seco) return { min: 20, max: 120, que: 'cereal o legumbre seca' };
  if (m.base != null) return { min: 30, max: 300, que: 'legumbre cocida o fécula' };
  return { min: 15, max: 320, que: 'verdura o fresco' };
}

/** Lo que pesa el plato entero por ración: el aviso de "esto no se lo come nadie". */
const GRAMOS_PLATO_MIN = 250;
const GRAMOS_PLATO_MAX = 950;

function reglaCantidades(ctx: Contexto): Fallo[] {
  const fallos: Fallo[] = [];
  let gramosPlato = 0;
  for (const ing of ctx.ingredientes) {
    const m = meta(ctx, ing.canonico);
    if (!m) continue;
    const r = rangoDe(m, ing.canonico, ing.escalado);
    if (ing.cantidad < r.min || ing.cantidad > r.max) {
      fallos.push({
        receta: ctx.nombre,
        regla: 'cantidad',
        detalle: `"${ing.canonico}" ${ing.cantidad} ${ing.unidad}/ración, fuera de ${r.min}-${r.max} para ${r.que}`,
        nivel: 'error',
      });
    }
    if (!m.es_despensa) {
      gramosPlato += ing.unidad === 'ud' ? ing.cantidad * (m.gramos_por_unidad ?? 0) : ing.cantidad;
    }
  }
  if (!ctx.esEnsamblaje && (gramosPlato < GRAMOS_PLATO_MIN || gramosPlato > GRAMOS_PLATO_MAX)) {
    fallos.push({
      receta: ctx.nombre,
      regla: 'cantidad',
      detalle: `el plato pesa ${gramosPlato.toFixed(0)} g por ración (lo normal son ${GRAMOS_PLATO_MIN}-${GRAMOS_PLATO_MAX})`,
      nivel: 'aviso',
    });
  }
  return fallos;
}

// ---------------------------------------------------------------------------
// 7 · Ratios de cocina
// ---------------------------------------------------------------------------

const ARROCES = ['arroz_redondo', 'arroz_largo', 'arroz_integral', 'quinoa'];
/**
 * La lista es a mano, y por eso hay que acordarse de ella al dar de alta una
 * legumbre. `alubia_negra_seca` entró en el vocabulario sin pasar por aquí, y
 * durante un rato fue la única legumbre seca del catálogo que el guardián NO
 * vigilaba: se le podía poner cualquier cantidad de agua sin que saltara nada.
 *
 * No se deduce del id a propósito —«seca» en el nombre no es un dato, es una
 * convención— pero sí conviene mirarla cada vez que se añade una.
 */
const LEGUMBRE_SECA = ['lenteja_pardina', 'garbanzo_seco', 'alubia_blanca_seca', 'alubia_negra_seca'];
const LIQUIDOS = ['agua', 'caldo_verduras', 'caldo_pollo', 'bebida_soja', 'bebida_arroz', 'leche_semi'];

function reglaRatios(ctx: Contexto): Fallo[] {
  const suma = (ids: string[]) =>
    ctx.ingredientes.filter((i) => ids.includes(i.canonico)).reduce((a, i) => a + i.cantidad, 0);

  const arroz = suma(ARROCES);
  const seca = suma(LEGUMBRE_SECA);
  const liquido = suma(LIQUIDOS);
  const fallos: Fallo[] = [];

  if (arroz > 0 && liquido > 0 && Math.abs(liquido / arroz - 2) > 0.35) {
    fallos.push({
      receta: ctx.nombre,
      regla: 'ratio',
      detalle: `arroz ${arroz} g con ${liquido} ml = 1:${(liquido / arroz).toFixed(1)} (debe ser 1:2)`,
      nivel: 'error',
    });
  }
  if (seca > 0 && liquido > 0 && Math.abs(liquido / seca - 3) > 0.5) {
    fallos.push({
      receta: ctx.nombre,
      regla: 'ratio',
      detalle: `legumbre seca ${seca} g con ${liquido} ml = 1:${(liquido / seca).toFixed(1)} (debe ser 1:3)`,
      nivel: 'error',
    });
  }
  // Un arroz o una legumbre seca SIN líquido no es que incumpla el ratio: es
  // que le falta el líquido. Se cuece en algo.
  if ((arroz > 0 || seca > 0) && liquido === 0) {
    fallos.push({
      receta: ctx.nombre,
      regla: 'ratio',
      detalle: `lleva ${arroz > 0 ? 'arroz' : 'legumbre seca'} y ningún líquido en el que cocerlo`,
      nivel: 'aviso',
    });
  }
  return fallos;
}

// ---------------------------------------------------------------------------
// Esquema básico (lo que ya comprobaba revisar-lote, aquí para compartirlo)
// ---------------------------------------------------------------------------

const UNIDADES = new Set(['g', 'ml', 'ud']);
const ESCALADOS = new Set(['lineal', 'sublineal', 'fijo']);
const PARTES = new Set(['principal', 'acompanamiento']);
/**
 * El tope cuenta lo que se COMPRA, no lo que aparece en la lista. La sal, el
 * aceite y la hoja de laurel no complican una receta ni engordan la lista de
 * la compra: están en casa. Contarlos daba por malas tres recetas del piloto
 * que son platos perfectamente normales —unas lentejas con verduras— solo
 * porque llevaban laurel.
 *
 * El total sigue vigilado, pero como aviso: si una receta se va a doce
 * líneas hay algo que mirar aunque nueve sean especias.
 */
const MAX_COMPRADOS = 8;
const MAX_TOTAL = 12;
const MAX_PASOS = 6;

function reglaEsquema(ctx: Contexto): Fallo[] {
  const fallos: Fallo[] = [];
  const err = (detalle: string) =>
    fallos.push({ receta: ctx.nombre, regla: 'esquema', detalle, nivel: 'error' as const });

  const comprados = ctx.ingredientes.filter(
    (i) => !meta(ctx, i.canonico)?.es_despensa && !SIN_SKU.has(i.canonico),
  ).length;
  if (comprados > MAX_COMPRADOS) {
    err(`${comprados} ingredientes que hay que comprar, el tope son ${MAX_COMPRADOS}`);
  }
  if (ctx.ingredientes.length > MAX_TOTAL) {
    fallos.push({
      receta: ctx.nombre,
      regla: 'esquema',
      detalle: `${ctx.ingredientes.length} líneas de ingrediente (el aviso está en ${MAX_TOTAL})`,
      nivel: 'aviso',
    });
  }
  if (ctx.receta && ctx.receta.pasos.length > MAX_PASOS) {
    err(`${ctx.receta.pasos.length} pasos, el tope son ${MAX_PASOS}`);
  }

  const vistos = new Set<string>();
  for (const ing of ctx.ingredientes) {
    const m = meta(ctx, ing.canonico);
    if (!m) { err(`"${ing.canonico}" no está en el vocabulario canónico`); continue; }
    if (!SIN_SKU.has(ing.canonico) && !sku(ctx, ing.canonico)) err(`"${ing.canonico}" no tiene producto mapeado`);
    if (vistos.has(ing.canonico)) err(`"${ing.canonico}" repetido`);
    vistos.add(ing.canonico);
    if (!PARTES.has(ing.parte)) err(`"${ing.canonico}" parte inválida: ${ing.parte}`);
    if (!UNIDADES.has(ing.unidad)) err(`"${ing.canonico}" unidad inválida: ${ing.unidad}`);
    if (!ESCALADOS.has(ing.escalado)) err(`"${ing.canonico}" escalado inválido: ${ing.escalado}`);
    if (ing.unidad !== m.unidad_base) err(`"${ing.canonico}" va en ${m.unidad_base}, no en ${ing.unidad}`);
    if (!(ing.cantidad > 0)) err(`"${ing.canonico}" cantidad inválida: ${ing.cantidad}`);
  }
  return fallos;
}

// ---------------------------------------------------------------------------
// La pasada completa
// ---------------------------------------------------------------------------

/** Reglas que miran una receta cada vez. */
const POR_RECETA = [reglaEsquema, reglaSal, reglaEscalado, reglaCantidades, reglaRatios];

/**
 * Todas las reglas vigentes contra TODAS las recetas. No hay parámetro para
 * excluir un lote: ese es el punto.
 */
export function comprobarTodo(datos: DatosMotor, contextos: Contexto[]): Fallo[] {
  const fallos: Fallo[] = [];
  for (const ctx of contextos) for (const regla of POR_RECETA) fallos.push(...regla(ctx));
  fallos.push(...reglaEscaladoConsistente(contextos));
  fallos.push(...reglaRendimiento(datos));
  fallos.push(...reglaConservacion(datos));
  fallos.push(...reglaDespensa(datos, contextos));
  return fallos;
}

/** Convierte el recetario (y sus ensamblajes) en contextos comprobables. */
export function contextosDe(datos: DatosMotor): Contexto[] {
  const contextos: Contexto[] = datos.recetas.map((r) => ({
    datos, nombre: r.nombre, ingredientes: r.ingredientes, esEnsamblaje: false, receta: r,
  }));
  for (const lista of Object.values(datos.ensamblajes ?? {})) {
    for (const e of lista) {
      contextos.push({ datos, nombre: `${e.nombre} (ensamblaje)`, ingredientes: e.ingredientes, esEnsamblaje: true });
    }
  }
  return contextos;
}
