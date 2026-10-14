/**
 * Motor de menú y coste. Determinista, sin IA, sin red. Vive en TypeScript y
 * lo usan los dos lados: los scripts de `catalogo/` en tiempo de build
 * (node --experimental-strip-types) y la app en tiempo de ejecución. Una sola
 * implementación: si divergieran, el precio que enseña la app dejaría de ser
 * el que calculó el build.
 *
 * Los datos NO se importan aquí: entran por parámetro (ver DatosMotor). Así
 * el mismo código sirve para el catálogo entero en build y para los 35 SKU
 * elegidos que van en el bundle.
 */

export type Parte = 'principal' | 'acompanamiento';
export type Escalado = 'lineal' | 'sublineal' | 'fijo';
export type UnidadReceta = 'g' | 'ml' | 'ud';
export type UnidadCatalogo = 'kg' | 'l' | 'ud';

export interface IngredienteReceta {
  canonico: string;
  parte: Parte;
  cantidad: number;
  unidad: UnidadReceta;
  escalado: Escalado;
}

export interface Receta {
  id: string;
  nombre: string;
  minutos: number;
  tags: string[];
  proteina: string;
  tecnica: string;
  /** Vida del plato ya cocinado, en frío. Tope superior de rinde_huecos. */
  dias_nevera: number;
  rinde_huecos: Record<Parte, number>;
  ingredientes: IngredienteReceta[];
  /** Cómo se cocina. Máximo 6, en imperativo. */
  pasos: string[];
  /**
   * FOTO DEL PLATO, opcional. Nombre de fichero dentro de /recetas/, sin ruta.
   *
   * Opcional a propósito y para siempre: se fotografían cocinando de verdad, y
   * la mayoría del recetario no va a tener foto durante semanas. La ausencia no
   * deja hueco ni marco — el bloque simplemente no se pinta. Un cuadrado gris
   * es peor que ninguna imagen.
   *
   * NO va en la tarjeta del día. Medido: la columna del nombre mide 232 px y
   * una miniatura de 56 la deja en 166, que a 17 px son ~18 caracteres — los
   * nombres (21 de media, 28 el mayor) volverían a envolver y las tarjetas a
   * tener tres alturas distintas. La tarjeta es una línea de ticket para barrer
   * siete días; la foto vive donde el usuario ya ha parado a mirar.
   */
  foto?: string;
  /**
   * Especias de despensa retiradas para que la receta encaje con un filtro.
   * Solo lo pone adaptarReceta(); en el recetario en disco no existe. La hoja
   * del día lo dice: quitar algo sin avisar es mentir sobre lo que se cocina.
   */
  omitidos?: string[];
}

/**
 * Un plato que se monta CON la tanda de otro, no en vez de ella.
 *
 * La diferencia entre repetir un plato y aprovecharlo. El guiso de garbanzos
 * del lunes no vuelve a la mesa como guiso de garbanzos: vuelve salteado con
 * huevo, y lo único que se compra son los huevos. Por eso `ingredientes`
 * lleva SOLO lo que se añade — el coste del hueco es ese, ni 0 € (que es
 * mentira: has abierto la nevera y has comprado algo) ni el plato entero.
 *
 * `desde` es el id de la receta cuya tanda se aprovecha. Es la relación que
 * faltaba en el esquema: hasta ahora una sobra solo sabía repetirse.
 */
export interface Ensamblaje {
  id: string;
  nombre: string;
  /** Receta de la que come. Su tanda tiene que estar en la semana. */
  desde: string;
  /** Lo que cuesta montarlo, no cocinar el plato original. */
  minutos: number;
  /** SOLO lo que se añade. Lo demás ya está comprado y cocinado. */
  ingredientes: IngredienteReceta[];
  pasos: string[];
}

/** De dónde sale el ingrediente. Gobierna vegetariano y vegano. */
export type Origen = 'vegetal' | 'huevo' | 'lacteo' | 'carne' | 'pescado' | 'marisco';

/**
 * Lo que hay que poder excluir. Gobierna el resto de filtros.
 *
 * `apio`, `soja` y `sulfitos` entraron cuando la auditoría por EAN los
 * encontró en el caldo de verduras, la picada de cerdo y media docena de
 * conservas. Un alérgeno detectado que no se puede excluir es peor que no
 * haberlo buscado: el dato estaba y el filtro no existía.
 */
export type Alergeno =
  | 'gluten' | 'lactosa' | 'frutos_secos' | 'cerdo' | 'marisco'
  | 'apio' | 'soja' | 'sulfitos'
  | 'huevo' | 'pescado' | 'cacahuete' | 'sesamo' | 'mostaza';

export interface IngredienteCanonico {
  id: string;
  nombre: string;
  unidad_base: string;
  es_despensa: boolean;
  dias_conservacion: number;
  gramos_por_unidad: number | null;
  origen: Origen;
  /** Lo que el producto LLEVA. Bloquea siempre. */
  alergenos: Alergeno[];
  /**
   * Contaminación cruzada declarada ("puede contener trazas de…"). Es una
   * advertencia de fábrica, no un ingrediente: bloquea en los filtros de
   * ALERGIA y no en los de preferencia. Un vegano puede comer espagueti que
   * se elabora en una línea donde también pasa huevo.
   */
  trazas?: Alergeno[];
  /** Tablas nutricionales estándar, sobre la parte comestible. */
  proteina_g_por_100: number;
  /** Fracción del peso de compra que se come. Hueso, espina, piel, cáscara. */
  rendimiento_comestible?: number;
  /** Almidón o legumbre sobre la que se monta el plato. Para los topes. */
  base: string | null;
}

/** El producto real del súper que cubre un ingrediente canónico. */
export interface Sku {
  sku: string;
  nombre: string;
  /**
   * Lo que rinde el envase, en `unidad`: sobre esto se calculan los envases,
   * el sobrante y `precio_kg_l_ud`. En una conserva es el peso ESCURRIDO,
   * porque las recetas piden «los garbanzos escurridos».
   */
  contenido: number;
  /**
   * El neto que pone la etiqueta, solo cuando no coincide con `contenido`
   * (conservas en líquido). Es lo que se enseña: «Tarro 570 g». No entra en
   * ninguna cuenta. Ver catalogo/escurridos.ts.
   */
  contenido_etiqueta?: number;
  unidad: UnidadCatalogo;
  precio: number;
  precio_kg_l_ud: number;
  packaging: string | null;
  unidades_pack: number | null;
  peso_variable: boolean;
  departamento: string;
  subfamilia: string;
}

export interface DatosMotor {
  /**
   * La fecha del catálogo, en ISO. La escribe `catalogo/generar.ts`.
   *
   * Estaba en el JSON desde el principio pero no en el tipo, así que quien la
   * quería la leía importando el `.json` a pelo —la pantalla Compra lo hacía—
   * y TypeScript no vigilaba nada. Ahora es lo que compara la app para saber si
   * los precios que se ha bajado son más nuevos que los que trae el APK, así
   * que ha dejado de ser decorativa. Ver src/lib/precios.ts.
   */
  generadoEn: string;
  recetas: Receta[];
  ingredientes: Record<string, IngredienteCanonico>;
  /** canonico -> producto elegido. Ver catalogo/mapeo-elegido.json. */
  skus: Record<string, Sku>;
  /** Agrupados por la receta de la que comen. Ver docs/ensamblajes.json. */
  ensamblajes?: Record<string, Ensamblaje[]>;
}

export type Ranura = 'comida' | 'cena';

/**
 * Una sesión de cocina. Cubre `huecosPrincipal` huecos con el plato
 * principal y `huecosAcompanamiento` con el acompañamiento. Cuando el
 * principal cubre más que el acompañamiento, los huecos de diferencia son de
 * ENSAMBLAJE: se aprovecha el principal y se rehace solo el acompañamiento.
 */
export interface Tanda {
  receta: Receta;
  huecosPrincipal: number;
  huecosAcompanamiento: number;
  /** Si el segundo hueco se monta como otro plato. Ver Ensamblaje. */
  ensamblaje?: Ensamblaje;
}

export type TipoHueco = 'cocinado' | 'sobras' | 'ensamblaje' | 'libre';

export interface Hueco {
  dia: string;
  ranura: Ranura;
  /** null solo en 'libre': ese día no se cocina. */
  receta: Receta | null;
  tipo: TipoHueco;
  /** De qué hueco viene lo aprovechado. Solo en 'sobras' y 'ensamblaje'. */
  origen?: { dia: string; ranura: Ranura };
  /** El plato en que se convierte la sobra, si no se repite tal cual. */
  ensamblaje?: Ensamblaje;
}

export interface LineaCarrito {
  canonicos: string[];
  sku: string;
  nombre: string;
  departamento: string;
  packaging: string | null;
  esDespensa: boolean;
  pesoVariable: boolean;
  unidad: UnidadCatalogo;
  diasFresco: number;
  diasEfectivos: number;
  necesario: number;
  comprado: number;
  compras: number;
  contenidoEnvase: number;
  /** El neto de la etiqueta, para escribir el formato. Ver `Sku.contenido_etiqueta`. */
  contenidoEtiqueta?: number;
  carritoCoste: number;
  consumoCoste: number;
  sobranteCantidad: number;
  perecederoCoste: number;
  inventarioCoste: number;
}

export interface Carrito {
  lineas: LineaCarrito[];
  totalCarrito: number;
  totalConsumo: number;
  totalPerecedero: number;
  totalInventario: number;
  totalDespensa: number;
  /**
   * Lo que esta semana se come del armario y por tanto NO pasa por caja: ya
   * se pagó en una semana anterior. Existe para que el motor no confunda
   * "carrito barato porque tengo la nevera llena" con "no he sabido llenar la
   * semana" y se ponga a comprar de más. Ver `gastoEfectivo` en seleccionar.
   */
  totalDelArmario: number;
}

export const DIAS = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
