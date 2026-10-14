import type {
  Carrito, DatosMotor, Ensamblaje, IngredienteReceta, LineaCarrito, Parte, Receta, Sku, Tanda, UnidadReceta,
} from './tipos.ts';
import type { RacionPostre } from './postres.ts';

const DIAS_LARGA_CONSERVACION = 365;
const PACKAGING_CONSERVA = new Set(['Lata', 'Bote', 'Tarro', 'Brik']);

/**
 * Ingredientes que son vocabulario pero NO se compran: no tienen SKU, no
 * cuestan nada y no salen en la lista. El agua es el caso: sin ella, los
 * arroces tenían que cuadrar su ratio 1:2 con caldo de pago, lo que
 * encarecía el plato y forzaba recetas raras.
 */
export const SIN_SKU = new Set(['agua']);

// ---------------------------------------------------------------------------
// Escalado
// ---------------------------------------------------------------------------

/**
 * Escalar por comensales no es multiplicar. Cada línea lleva su marca:
 *   lineal    — proteína, verdura, legumbre, arroz, pasta. Multiplica por N.
 *   sublineal — especias, ajo, aceite de sofreír, sal. N^0.7.
 *   fijo      — laurel, chorro de vinagre. Una tanda es una olla: no crece.
 */
export function escalar(cantidad: number, escalado: string, raciones: number): number {
  if (escalado === 'lineal') return cantidad * raciones;
  if (escalado === 'sublineal') return cantidad * 2 * Math.pow(raciones / 2, 0.7);
  if (escalado === 'fijo') return cantidad * 2;
  throw new Error(`escalado desconocido: "${escalado}"`);
}

/**
 * Las recetas cuentan en g/ml/ud; el catálogo en kg/l/ud. Cuando la receta
 * cuenta en "ud" (una lata, un huevo) y el producto se vende por peso, lo que
 * pesa 1 ud sale del propio envase: cuántas piezas trae (unidades_pack) o, si
 * el envase ES una pieza (packaging "Pieza"), su contenido.
 */
export function aUnidadCatalogo(cantidad: number, unidadReceta: UnidadReceta, sku: Sku): number {
  if (unidadReceta === 'g' && sku.unidad === 'kg') return cantidad / 1000;
  if (unidadReceta === 'ml' && sku.unidad === 'l') return cantidad / 1000;
  if (unidadReceta === 'ud' && sku.unidad === 'ud') return cantidad;
  if (unidadReceta === 'ud') return cantidad * (sku.contenido / (sku.unidades_pack ?? 1));
  throw new Error(`no sé convertir "${unidadReceta}" a "${sku.unidad}" — sku ${sku.sku}`);
}

export function esCandidatoUsable(unidadReceta: UnidadReceta, sku: Sku): boolean {
  if (unidadReceta === 'g') return sku.unidad === 'kg';
  if (unidadReceta === 'ml') return sku.unidad === 'l';
  if (sku.unidad === 'ud') return true;
  return sku.unidades_pack != null || sku.packaging === 'Pieza';
}

// ---------------------------------------------------------------------------
// Caducidad: manda la presentación, no el ingrediente fresco
// ---------------------------------------------------------------------------

function esCongelado(sku: Sku): boolean {
  return sku.departamento === 'Congelados' || /congelad/i.test(sku.nombre);
}

export function esConserva(sku: Sku): boolean {
  if (sku.departamento === 'Conservas, caldos y cremas') return true;
  if (sku.packaging && PACKAGING_CONSERVA.has(sku.packaging)) return true;
  return /conserva/i.test(sku.subfamilia ?? '');
}

/** Los días que de verdad aguanta ESTE producto, no su versión fresca. */
export function diasEfectivos(sku: Sku, diasIngredienteFresco: number): number {
  return esCongelado(sku) || esConserva(sku) ? DIAS_LARGA_CONSERVACION : diasIngredienteFresco;
}

/**
 * Un guisante congelado no caduca en 5 días. Pero un bote de garbanzos
 * ABIERTO dura tres, no un año: por eso el sobrante se parte en unidades
 * enteras sin abrir (vida larga) y resto de envase abierto (vida del
 * ingrediente fresco). En congelado no hace falta partir: vuelve al arcón.
 */
export function repartirSobrante(sku: Sku, sobrante: number, diasFresco: number) {
  if (sobrante <= 0) return { largaConservacion: 0, corta: 0, diasCorta: diasFresco };
  if (esCongelado(sku)) return { largaConservacion: sobrante, corta: 0, diasCorta: diasFresco };

  if (esConserva(sku)) {
    const contenidoPorUnidad = sku.contenido / (sku.unidades_pack ?? 1);
    const enteras = Math.floor(sobrante / contenidoPorUnidad + 1e-9);
    const largaConservacion = enteras * contenidoPorUnidad;
    return { largaConservacion, corta: sobrante - largaConservacion, diasCorta: diasFresco };
  }

  return { largaConservacion: 0, corta: sobrante, diasCorta: diasFresco };
}

/**
 * Cuánto del sobrante es pérdida real. La app funciona en ciclos de 7 días:
 * hasta ahí es pérdida íntegra (se pudre antes de la semana que viene); a
 * partir decae hacia cero, porque es inventario y no pérdida.
 */
export function factorPenalizacion(dias: number): number {
  if (!dias || dias <= 0) return 1; // sin dato: perecedero, no asumas que aguanta
  return Math.min(1, 7 / dias);
}

// ---------------------------------------------------------------------------
// Carrito
// ---------------------------------------------------------------------------

/**
 * REDONDEO ARITMÉTICO, NO POR TEXTO.
 *
 * Era `Number(n.toFixed(d))`, y `toFixed` formatea el número a cadena y lo
 * vuelve a parsear. Está en el bucle más interno del acumulador de necesidad,
 * así que se llamaba cientos de miles de veces por semana construida: el
 * perfilador de CPU lo daba como el **31,9 % del tiempo del motor**, más que
 * ninguna otra función, incluida la que elige los platos.
 *
 * `Math.round(n * 10^d) / 10^d` da el mismo valor en todo el rango que maneja
 * el motor —cantidades y euros, siempre positivos y muy por debajo de 2^53—
 * y no pasa por el formateador. Comprobado con las semanas generadas byte a
 * byte antes y después del cambio, no solo con los tests.
 *
 * La tabla evita recalcular la potencia; `d` solo vale 2 o 4 en toda la app.
 */
const POTENCIAS = [1, 10, 100, 1e3, 1e4, 1e5, 1e6];
const redondear = (n: number, d = 4) => {
  const p = POTENCIAS[d];
  const escalado = n * p;
  const resto = escalado - Math.floor(escalado);
  /**
   * En el filo del empate los dos redondeos NO coinciden: `toFixed` mira el
   * valor decimal exacto del binario y `Math.round` mira el producto, que ya
   * arrastra su propio error. Probado sobre 243 semanas, 2 salían distintas
   * con el redondeo aritmético a secas — o sea, dos menús cambiados. Aquí
   * solo esos casos pagan el formateo, y son una minoría ínfima.
   */
  if (resto > 0.4999999 && resto < 0.5000001) return Number(n.toFixed(d));
  return Math.round(escalado) / p;
};

/**
 * Qué ingredientes entran en una tanda y con cuántas raciones. Si la tanda
 * lleva ensamblaje, se suman TAMBIÉN sus ingredientes, para un solo hueco:
 * son lo único que ese hueco hace pasar por caja, porque el resto ya se
 * compró con la tanda original.
 */
function lineasDeTanda(tanda: Tanda, N: number): { ing: IngredienteReceta; raciones: number }[] {
  const lineas = tanda.receta.ingredientes.map((ing) => ({
    ing,
    raciones: (ing.parte === 'principal' ? tanda.huecosPrincipal : tanda.huecosAcompanamiento) * N,
  }));
  if (tanda.ensamblaje) {
    for (const ing of tanda.ensamblaje.ingredientes) lineas.push({ ing, raciones: N });
  }
  return lineas;
}

interface Acum { sku: Sku; cantidad: number; canonicos: Set<string>; esDespensa: boolean; diasFresco: number }

/** La necesidad acumulada por SKU. El estado incremental del optimizador. */
export type Necesidad = Map<string, Acum>;

/**
 * LO QUE YA HAY EN CASA, por SKU y en unidades de catálogo.
 *
 * No existía, y el agujero era enorme: el motor arrancaba cada semana con la
 * cocina vacía. Medido con una persona sola y 32 € de presupuesto, cuatro
 * semanas seguidas: pagaba 30,82 · 31,15 · 31,84 · 30,58 € y se comía 14,47 ·
 * 13,69 · 13,72 · 13,84 €. La semana 2 compraba cebollas teniendo 1,55 kg
 * guardados; la 3, con 1,62; la 4, con 1,65 kg y 18 huevos. El armario crecía
 * para siempre y ella pagaba por llenarlo cada domingo.
 *
 * Va por SKU y no por ingrediente canónico porque lo que hay en el armario es
 * un producto concreto: media bolsa de arroz largo Hacendado, no "arroz".
 */
export interface EnCasa {
  cantidad: number;
  /** Días que le quedan de vida. Al pasar una semana se le restan siete. */
  diasRestantes: number;
  /**
   * Semanas que lleva en el armario. 0 es "sobró de la semana que acabo de
   * cerrar".
   *
   * No es para el motor —que solo mira cantidad y caducidad— sino para el
   * plan gratuito: sin suscripción se usa solo lo de la semana inmediatamente
   * anterior, y lo demás se conserva entero pero no se descuenta. Ver
   * lib/suscripcion.ts: al caducar la despensa SE CONGELA, no se borra.
   */
  semanas: number;
}
export type Existencias = Record<string, EnCasa>;

const DIAS_DE_LA_SEMANA = 7;

/**
 * Lo que queda en casa después de cocinar la semana: lo de antes, más lo
 * comprado, menos lo consumido, y todo con una semana menos de vida.
 *
 * LO QUE CADUCA, CADUCA. La primera versión arrastraba el sobrante para
 * siempre con solo mirar si aguantaba siete días, y el armario se iba a 40
 * productos y 51 € de valor a la sexta semana. Con eso el carrito de la
 * semana 6 bajaba a 16,75 € —una bolsa de cebollas de quince días de vida no
 * está buena mes y medio después—. Restando los siete días de la semana el
 * armario llega a un estado estable, que es lo que hace una cocina de verdad.
 */
export function existenciasTrasLaSemana(
  carrito: Carrito,
  antes?: Existencias,
  /**
   * Los días que pasan hasta la semana siguiente. Siete, salvo que el usuario
   * tarde en abrirla: tres semanas fuera son veintiún días de nevera, y restar
   * siete dejaba en la despensa productos ya caducados que el motor daba por
   * buenos y descontaba de la compra.
   */
  dias = DIAS_DE_LA_SEMANA,
): Existencias {
  const resultado: Existencias = {};

  for (const l of carrito.lineas) {
    if (l.sobranteCantidad <= 0) continue;
    const habia = antes?.[l.sku];
    // Lo viejo se gasta primero: si el sobrante no pasa de lo que ya había, es
    // ESE producto el que sigue en el armario, con sus días, no uno nuevo.
    const vieneDeAntes = habia && l.sobranteCantidad <= habia.cantidad + 1e-9;
    const quedan = (vieneDeAntes ? habia.diasRestantes : l.diasEfectivos) - dias;
    if (quedan <= 0) continue;
    resultado[l.sku] = {
      cantidad: redondear(l.sobranteCantidad, 4),
      diasRestantes: quedan,
      // Si el sobrante viene de lo que ya había, envejece; si es nuevo, nace.
      semanas: vieneDeAntes ? (habia.semanas ?? 0) + 1 : 0,
    };
  }

  // Lo que había y esta semana no se tocó sigue estando, una semana más viejo.
  for (const [sku, enCasa] of Object.entries(antes ?? {})) {
    if (resultado[sku] !== undefined) continue;
    if (carrito.lineas.some((l) => l.sku === sku)) continue;
    const restan = enCasa.diasRestantes - dias;
    if (restan > 0) resultado[sku] = { cantidad: enCasa.cantidad, diasRestantes: restan, semanas: (enCasa.semanas ?? 0) + 1 };
  }

  return resultado;
}

/**
 * Acumula la necesidad de estas tandas SOBRE una base opcional (que se clona,
 * no se muta). Es la mitad incremental de calcularCarrito: el optimizador
 * prueba ~50.000 candidatos por generación y reconstruir el carrito entero
 * por candidato —con su ordenación y sus objetos de línea— era el 80% del
 * tiempo de montar una semana. Misma aritmética, mismo resultado.
 */
export function acumularNecesidad(tandas: Tanda[], datos: DatosMotor, N: number, base?: Necesidad): Necesidad {
  const necesidad: Necesidad = new Map();
  if (base) for (const [k, a] of base) necesidad.set(k, { ...a, canonicos: new Set(a.canonicos) });

  for (const tanda of tandas) {
    for (const { ing, raciones } of lineasDeTanda(tanda, N)) {
      if (raciones <= 0 || SIN_SKU.has(ing.canonico)) continue;
      const sku = datos.skus[ing.canonico];
      if (!sku) throw new Error(`sin sku elegido para "${ing.canonico}"`);
      const meta = datos.ingredientes[ing.canonico];
      const cantidad = aUnidadCatalogo(escalar(ing.cantidad, ing.escalado, raciones), ing.unidad, sku);

      let acum = necesidad.get(sku.sku);
      if (!acum) {
        acum = { sku, cantidad: 0, canonicos: new Set(), esDespensa: false, diasFresco: Infinity };
        necesidad.set(sku.sku, acum);
      }
      acum.cantidad += cantidad;
      acum.canonicos.add(ing.canonico);
      if (meta.es_despensa) acum.esDespensa = true;
      acum.diasFresco = Math.min(acum.diasFresco, meta.dias_conservacion);
    }
  }
  return necesidad;
}

/**
 * Solo los dos totales que necesita la puntuación del motor, sin construir
 * las líneas ni ordenarlas. Copia la aritmética de calcularCarrito paso a
 * paso, redondeos incluidos, para que un candidato puntúe EXACTAMENTE el
 * mismo carrito que luego se materializa.
 */
export function totalesDeNecesidad(
  necesidad: Necesidad,
  existencias?: Existencias,
): { totalCarrito: number; totalPerecedero: number; totalDelArmario: number } {
  let carrito = 0;
  let perecedero = 0;
  let delArmario = 0;
  for (const a of necesidad.values()) {
    if (a.esDespensa) continue;
    // Se descuenta como mucho lo que hace falta: tener tres kilos de cebolla
    // guardados no puede contar como sobrante de ESTA semana y penalizar.
    const enCasa = Math.min(existencias?.[a.sku.sku]?.cantidad ?? 0, a.cantidad);
    const compras = Math.ceil((a.cantidad - enCasa) / a.sku.contenido);
    const sobrante = enCasa + compras * a.sku.contenido - a.cantidad;
    delArmario += enCasa * a.sku.precio_kg_l_ud;
    const reparto = repartirSobrante(a.sku, sobrante, a.diasFresco);
    carrito += redondear(compras * a.sku.precio);
    perecedero += redondear(
      reparto.corta * a.sku.precio_kg_l_ud * factorPenalizacion(reparto.diasCorta) +
      reparto.largaConservacion * a.sku.precio_kg_l_ud * factorPenalizacion(DIAS_LARGA_CONSERVACION),
    );
  }
  return {
    totalCarrito: redondear(carrito, 2),
    totalPerecedero: redondear(perecedero, 2),
    totalDelArmario: redondear(delArmario, 2),
  };
}

/**
 * Lo que de verdad pasa por caja. Se acumula la necesidad de TODAS las tandas
 * (la cebolla de cinco platos se compra una vez, no cinco: el encadenamiento
 * de ingredientes emerge de sumar, no de una regla aparte) y se redondea al
 * envase entero, que no se puede comprar media garrafa.
 *
 * La acumulación es por SKU, no por canónico: dos canónicos distintos pueden
 * resolver al mismo producto y entonces basta comprarlo una vez.
 */
/**
 * La necesidad que generan los postres, para usarla como base.
 *
 * Se construye igual que la de las recetas y con la misma forma, y por eso el
 * resto del motor no tiene que enterarse de que existe el postre: el redondeo
 * a envases, el sobrante, el desperdicio y el descuento de despensa salen de
 * la misma tubería. El yogur que sobra del pack de seis cuenta exactamente
 * igual que el pimiento que sobra de la bandeja.
 */
export function necesidadDePostres(plan: RacionPostre[]): Necesidad {
  const necesidad: Necesidad = new Map();
  for (const p of plan) {
    if (p.raciones <= 0) continue;
    necesidad.set(p.sku.sku, {
      sku: p.sku,
      cantidad: redondear(p.raciones * p.porRacion),
      canonicos: new Set([p.ingrediente.id]),
      esDespensa: false,
      diasFresco: p.ingrediente.dias_conservacion,
    });
  }
  return necesidad;
}

export function calcularCarrito(
  tandas: Tanda[],
  datos: DatosMotor,
  N: number,
  existencias?: Existencias,
  postres?: RacionPostre[],
): Carrito {
  const necesidad = acumularNecesidad(
    tandas, datos, N, postres?.length ? necesidadDePostres(postres) : undefined,
  );

  const lineas: LineaCarrito[] = [];
  let delArmario = 0;
  for (const a of necesidad.values()) {
    // Lo que ya está en casa no se vuelve a comprar, pero sí se come: el
    // consumo va sobre la cantidad entera y el carrito solo sobre lo que falta.
    const enCasa = Math.min(existencias?.[a.sku.sku]?.cantidad ?? 0, a.cantidad);
    const compras = Math.ceil((a.cantidad - enCasa) / a.sku.contenido);
    const comprado = compras * a.sku.contenido;
    const carritoCoste = compras * a.sku.precio;
    const consumoCoste = a.cantidad * a.sku.precio_kg_l_ud;
    const sobrante = enCasa + comprado - a.cantidad;
    if (!a.esDespensa) delArmario += enCasa * a.sku.precio_kg_l_ud;

    const reparto = repartirSobrante(a.sku, sobrante, a.diasFresco);
    const perecederoCoste =
      reparto.corta * a.sku.precio_kg_l_ud * factorPenalizacion(reparto.diasCorta) +
      reparto.largaConservacion * a.sku.precio_kg_l_ud * factorPenalizacion(DIAS_LARGA_CONSERVACION);

    lineas.push({
      canonicos: [...a.canonicos].sort((x, y) => x.localeCompare(y)),
      sku: a.sku.sku,
      nombre: a.sku.nombre,
      departamento: a.sku.departamento,
      packaging: a.sku.packaging,
      esDespensa: a.esDespensa,
      pesoVariable: a.sku.peso_variable,
      unidad: a.sku.unidad,
      diasFresco: a.diasFresco,
      diasEfectivos: diasEfectivos(a.sku, a.diasFresco),
      necesario: redondear(a.cantidad),
      comprado: redondear(comprado),
      compras,
      contenidoEnvase: a.sku.contenido,
      ...(a.sku.contenido_etiqueta ? { contenidoEtiqueta: a.sku.contenido_etiqueta } : {}),
      carritoCoste: redondear(carritoCoste),
      consumoCoste: redondear(consumoCoste),
      sobranteCantidad: redondear(sobrante),
      perecederoCoste: redondear(perecederoCoste),
      // El sobrante que NO se da por perdido. Sale del sobrante y no de
      // (carrito − consumo) porque con despensa el carrito ya no incluye lo
      // que había en casa, y la resta salía negativa. Son equivalentes cuando
      // la despensa está vacía.
      inventarioCoste: redondear(sobrante * a.sku.precio_kg_l_ud - perecederoCoste),
    });
  }

  lineas.sort((a, b) => b.perecederoCoste - a.perecederoCoste);
  const noDespensa = lineas.filter((l) => !l.esDespensa);
  const despensa = lineas.filter((l) => l.esDespensa);
  const suma = (arr: LineaCarrito[], campo: keyof LineaCarrito) =>
    redondear(arr.reduce((a, c) => a + (c[campo] as number), 0), 2);

  return {
    lineas,
    totalCarrito: suma(noDespensa, 'carritoCoste'),
    totalConsumo: suma(noDespensa, 'consumoCoste'),
    totalPerecedero: suma(noDespensa, 'perecederoCoste'),
    totalInventario: suma(noDespensa, 'inventarioCoste'),
    totalDespensa: suma(despensa, 'carritoCoste'),
    totalDelArmario: redondear(delArmario, 2),
  };
}

/** Coste por ración de una lista de ingredientes, sin despensa. */
function costePorRacion(ingredientes: IngredienteReceta[], datos: DatosMotor, N: number, soloParte?: Parte): number {
  let total = 0;
  for (const ing of ingredientes) {
    if (soloParte && ing.parte !== soloParte) continue;
    if (SIN_SKU.has(ing.canonico)) continue;
    if (datos.ingredientes[ing.canonico].es_despensa) continue;
    const sku = datos.skus[ing.canonico];
    total += aUnidadCatalogo(escalar(ing.cantidad, ing.escalado, N), ing.unidad, sku) * sku.precio_kg_l_ud;
  }
  return redondear(total / N, 4);
}

/** Coste por ración de una receta aislada. Es el "X € ración" de la tarjeta. */
export function consumoPorRacion(receta: Receta, datos: DatosMotor, N: number, soloParte?: Parte): number {
  return costePorRacion(receta.ingredientes, datos, N, soloParte);
}

/**
 * Lo que cuesta el hueco de ensamblaje: SOLO lo que se añade. Es la cifra que
 * justifica que exista — un hueco de sobras a 0 € miente (has comprado los
 * huevos) y cobrar el plato entero miente más (el guiso ya estaba pagado).
 */
export function consumoDeEnsamblaje(ensamblaje: Ensamblaje, datos: DatosMotor, N: number): number {
  return costePorRacion(ensamblaje.ingredientes, datos, N);
}

/** La proteína que añade el ensamblaje sobre la ración que aprovecha. */
export function proteinaDeEnsamblaje(ensamblaje: Ensamblaje, datos: DatosMotor, N: number): number {
  return proteinaDeIngredientes(ensamblaje.ingredientes, datos, N);
}

/**
 * Gramos de proteína por ración. La cantidad de la receta está en g, ml o ud
 * y hay que llevarla a gramos de alimento antes de aplicar la tabla: un huevo
 * son 60 g, un diente de ajo 5 g (ver gramos_por_unidad en el vocabulario).
 * El ml se cuenta como gramo — con caldos y bebidas vegetales el error es
 * despreciable frente a lo que aporta.
 */
function proteinaDeIngredientes(ingredientes: IngredienteReceta[], datos: DatosMotor, N: number): number {
  let total = 0;
  for (const ing of ingredientes) {
    const meta = datos.ingredientes[ing.canonico];
    const cantidad = escalar(ing.cantidad, ing.escalado, N);
    const gramos = ing.unidad === 'ud' ? cantidad * (meta.gramos_por_unidad ?? 0) : cantidad;
    // Sobre lo que se COME, no sobre lo que se compra: 155 g de costilla con
    // hueso no son 155 g de carne. El hueso se paga pero no alimenta, así que
    // el rendimiento se aplica aquí y no en el coste.
    const comestible = gramos * (meta.rendimiento_comestible ?? 1);
    total += (comestible * meta.proteina_g_por_100) / 100;
  }
  return redondear(total / N, 2);
}

export function proteinaPorRacion(receta: Receta, datos: DatosMotor, N: number): number {
  return proteinaDeIngredientes(receta.ingredientes, datos, N);
}

/**
 * ¿Aporta este plato proteína animal, y es fresca o de conserva?
 *
 * Con memoria por IDENTIDAD DE OBJETO, no por `receta.id`. Es una distinción
 * que importa: `recetarioAdaptado` fabrica recetas nuevas en cada llamada y
 * les quita ingredientes según las exclusiones, así que dos recetas con el
 * mismo id pueden tener composición distinta —justo la que decide esta
 * función—. Con el objeto como clave eso no puede confundirse, y el WeakMap
 * suelta las adaptadas en cuanto el recolector se las lleva.
 *
 * Valía el 3,3% del motor, más el 1,6% de la expresión regular de `esConserva`
 * que se evaluaba desde aquí.
 */
const proteinasAnimales = new WeakMap<Receta, 'ninguna' | 'conserva' | 'fresca'>();
export function proteinaAnimal(receta: Receta, datos: DatosMotor): 'ninguna' | 'conserva' | 'fresca' {
  const guardado = proteinasAnimales.get(receta);
  if (guardado !== undefined) return guardado;
  let hay: 'ninguna' | 'conserva' | 'fresca' = 'ninguna';
  for (const ing of receta.ingredientes) {
    const meta = datos.ingredientes[ing.canonico];
    if (!['carne', 'pescado', 'marisco'].includes(meta.origen)) continue;
    // El congelado cuenta como fresco: lo que descarta la regla es la lata.
    if (!esConserva(datos.skus[ing.canonico])) { hay = 'fresca'; break; }
    hay = 'conserva';
  }
  proteinasAnimales.set(receta, hay);
  return hay;
}
