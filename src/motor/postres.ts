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

/**
 * Reparte las raciones de la semana entre la carta, por turnos.
 *
 * Por turnos y no al peso del precio: repartir por precio acabaría poniendo
 * once gelatinas y un plátano, que es más barato y es peor producto. La
 * variedad de la rotación es justo lo que separa "hay postre" de "hay un
 * postre repetido catorce veces".
 */
export function planDePostres(
  datos: DatosMotor,
  exclusiones: string[],
  N: number,
  numHuecos: number,
): RacionPostre[] {
  const carta = cartaDePostres(datos, exclusiones);
  if (!carta.length) return [];

  const totalRaciones = N * numHuecos;
  return carta.map((x, i) => {
    // Reparto por turnos: los primeros de la carta —los más baratos— se
    // quedan la ración de más cuando el total no divide exacto.
    const raciones = Math.floor(totalRaciones / carta.length)
      + (i < totalRaciones % carta.length ? 1 : 0);
    return {
      ingrediente: x.ing,
      sku: x.sku,
      porRacion: (x.ing as { postre_por_racion?: number }).postre_por_racion ?? 1,
      raciones,
    };
  }).filter((p) => p.raciones > 0);
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
