import type { DatosMotor, IngredienteCanonico, Sku } from './tipos.ts';

/**
 * POSTRES · una línea más del carrito, no una receta.
 *
 * Un postre no se cocina: es una unidad que se saca de la nevera y se come.
 * No tiene pasos, ni minutos, ni raciones que escalar, así que meterlo en el
 * recetario habría sido forzar la forma equivocada. Va por el mismo camino que
 * cualquier otro ingrediente —necesidad por SKU, redondeo a envases, sobrante,
 * desperdicio— y por eso el yogur que sobra del pack de seis cuenta igual que
 * el pimiento que sobra de la bandeja.
 *
 * ═══ LA REGLA QUE MANDA: EL POSTRE SE PAGA DEL PRESUPUESTO ═══
 *
 * Para dos personas con postre en las catorce comidas son 6-7 € a la semana,
 * casi un 10% de un presupuesto de 65. Si eso se sumara al final, encender el
 * interruptor rompería el tope y la app estaría mintiendo con su propia cifra.
 * Así que el coste se calcula ANTES —no depende de qué platos salgan— y se
 * descuenta del presupuesto con el que el motor elige recetas. Ver
 * `costeDePostres` y su uso en seleccionar.ts.
 */

/** Lo que come una persona de postre en cada hueco. */
export interface RacionPostre {
  ingrediente: IngredienteCanonico;
  sku: Sku;
  /** Cantidad en unidades de catálogo (1 ud de yogur, 0,15 kg de plátano). */
  porRacion: number;
  /** Cuántas raciones de este postre lleva la semana entera. */
  raciones: number;
}

/** Cuántos tipos distintos entran en la rotación. */
const TIPOS_EN_ROTACION = 4;

/**
 * Las restricciones que tumban un postre, más allá de sus alérgenos.
 *
 * "Vegetariano" y "Vegano" no son alérgenos y no vienen en el catálogo, así
 * que se resuelven aquí con el origen del ingrediente y la marca manual de la
 * gelatina (colágeno animal, ver catalogo/postres.js). Equivocarse en esto es
 * servirle cerdo a quien no come cerdo, así que se es conservador: ante la
 * duda, el postre no entra.
 */
function permitido(ing: IngredienteCanonico, exclusiones: string[]): boolean {
  const ex = new Set(exclusiones);
  for (const a of ing.alergenos) if (ex.has(a)) return false;

  const noVegetariano = (ing as { postre_no_vegetariano?: boolean }).postre_no_vegetariano === true;
  if (ex.has('Vegetariano') || ex.has('Vegano')) {
    if (noVegetariano) return false;
    if (ing.origen === 'carne' || ing.origen === 'pescado' || ing.origen === 'marisco') return false;
  }
  // Vegano además tumba lo lácteo y el huevo.
  if (ex.has('Vegano') && (ing.origen === 'lacteo' || ing.alergenos.includes('Huevo' as never))) return false;
  // La gelatina de Mercadona es de origen porcino o vacuno sin distinguir, así
  // que quien excluye el cerdo tampoco la lleva.
  if (ex.has('Cerdo') && noVegetariano) return false;
  return true;
}

/** Lo que cuesta una ración de este postre. */
function precioRacion(ing: IngredienteCanonico, sku: Sku): number {
  const porRacion = (ing as { postre_por_racion?: number }).postre_por_racion ?? 1;
  return porRacion * sku.precio_kg_l_ud;
}

/**
 * LA CARTA DE ESTA SEMANA.
 *
 * Determinista y sin azar: mismas restricciones, misma carta. Se ordena por lo
 * que cuesta la ración —es una app de dinero— y se cogen los cuatro primeros,
 * pero se fuerza que entre al menos una fruta si alguna está permitida.
 *
 * Lo de la fruta no es nutrición, que no es nuestro terreno: es que la fruta
 * es el único postre sin ningún alérgeno, así que es lo que sostiene la
 * rotación cuando los filtros se comen todo lo demás. Sin esa garantía, una
 * semana sin lactosa podía acabar siendo cuatro gelatinas.
 */
export function cartaDePostres(datos: DatosMotor, exclusiones: string[]): { ing: IngredienteCanonico; sku: Sku }[] {
  const todos = Object.values(datos.ingredientes)
    .filter((i) => (i as { es_postre?: boolean }).es_postre === true)
    .filter((i) => permitido(i, exclusiones))
    .map((ing) => ({ ing, sku: datos.skus[ing.id] }))
    .filter((x) => !!x.sku)
    .sort((a, b) => precioRacion(a.ing, a.sku) - precioRacion(b.ing, b.sku)
      // Desempate por id: dos postres al mismo precio no pueden cambiar de
      // orden según cómo venga el objeto del JSON.
      || a.ing.id.localeCompare(b.ing.id));

  if (todos.length <= TIPOS_EN_ROTACION) return todos;

  const carta = todos.slice(0, TIPOS_EN_ROTACION);
  const esFruta = (x: { ing: IngredienteCanonico }) => (x.ing as { postre_es_fruta?: boolean }).postre_es_fruta === true;
  if (!carta.some(esFruta)) {
    const fruta = todos.find(esFruta);
    // Entra la fruta más barata en lugar del postre más caro de la carta.
    if (fruta) carta[carta.length - 1] = fruta;
  }
  return carta;
}

/** Lo que cuesta una ración de este postre. Público: la UI lo enseña. */
export function precioDeRacion(ing: IngredienteCanonico, sku: Sku): number {
  return precioRacion(ing, sku);
}

/**
 * ═══ QUÉ POSTRE TOCA EN CADA COMIDA ═══
 *
 * Esta es la fuente de la verdad del postre, y antes NO EXISTÍA.
 *
 * El reparto original era por RACIONES: «esta semana entran 7 yogures, 7
 * plátanos, 7 gelatinas y 7 manzanas». Con eso se puede comprar y se puede
 * cobrar, pero no se puede decir qué se come el martes — la pregunta no tenía
 * respuesta en los datos. Por eso encender el interruptor subía el precio y no
 * cambiaba nada de lo que el usuario ve: no había nada que enseñar.
 *
 * Ahora el reparto es por HUECO y en el orden de la semana, y las raciones se
 * derivan de él. La rotación es la misma idea de siempre —por turnos, no al
 * peso del precio, para que no salgan once gelatinas— pero aplicada a la unidad
 * que el usuario entiende: la comida.
 *
 * Determinista y sin azar: mismo índice, mismo postre. Es lo que permite que
 * `hidratar` lo reconstruya al recargar sin guardarlo en `PlanSerial`.
 */
export function postrePorHueco(
  datos: DatosMotor,
  exclusiones: string[],
  numHuecos: number,
): { ing: IngredienteCanonico; sku: Sku }[] {
  const carta = cartaDePostres(datos, exclusiones);
  if (!carta.length) return [];
  return Array.from({ length: numHuecos }, (_, i) => carta[i % carta.length]);
}

/**
 * Las raciones de la semana, DERIVADAS del reparto por comida.
 *
 * Se cuenta cuántos huecos le tocan a cada postre y se multiplica por los
 * comensales. Así el carrito compra exactamente lo que el menú dice que se va a
 * comer — antes eran dos repartos distintos del mismo total y podían no
 * coincidir plato a plato aunque la suma cuadrara.
 *
 * El invariante se conserva: la suma de raciones sigue siendo N × numHuecos.
 */
export function planDePostres(
  datos: DatosMotor,
  exclusiones: string[],
  N: number,
  numHuecos: number,
): RacionPostre[] {
  const porHueco = postrePorHueco(datos, exclusiones, numHuecos);
  if (!porHueco.length) return [];

  const huecosPorPostre = new Map<string, number>();
  for (const x of porHueco) {
    huecosPorPostre.set(x.ing.id, (huecosPorPostre.get(x.ing.id) ?? 0) + 1);
  }

  return cartaDePostres(datos, exclusiones).map((x) => ({
    ingrediente: x.ing,
    sku: x.sku,
    porRacion: (x.ing as { postre_por_racion?: number }).postre_por_racion ?? 1,
    raciones: (huecosPorPostre.get(x.ing.id) ?? 0) * N,
  })).filter((p) => p.raciones > 0);
}

/**
 * LO QUE HAY QUE APARTAR DEL PRESUPUESTO.
 *
 * Es coste de CARRITO, no de consumo: lo que pasa por caja, con los envases
 * redondeados hacia arriba. Si hacen falta 28 yogures y vienen de seis en
 * seis, se pagan cinco packs y sobran dos yogures — igual que con cualquier
 * otro producto.
 *
 * Se calcula aparte y antes de elegir platos porque no depende de ellos: el
 * postre es el mismo salga lentejas o salga merluza. Eso es lo que permite
 * descontarlo del techo sin meter el postre dentro del optimizador.
 */
export function costeDePostres(plan: RacionPostre[]): number {
  let total = 0;
  for (const p of plan) {
    const necesario = p.raciones * p.porRacion;
    total += Math.ceil(necesario / p.sku.contenido) * p.sku.precio;
  }
  return total;
}
