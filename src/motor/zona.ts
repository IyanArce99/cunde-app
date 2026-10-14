/**
 * ═══ EL CATÁLOGO DE UNA ZONA, SOBRE LAS MISMAS RECETAS ═══
 *
 * Las recetas son las mismas en toda España; lo que cambia es el lineal. Una
 * zona trae, por ingrediente canónico, el producto que hay allí —o `null` si no
 * hay uno verificado— y esto monta los datos del motor con ESOS productos.
 *
 * Tres reglas, y las tres son de no mentir:
 *
 *   1. Nunca se rellena con Madrid. Un canónico que la zona no trae (ni
 *      siquiera como `null`, porque se añadió después de medirla) cuenta como
 *      sin producto. Usar el SKU de Madrid sería enseñar un precio de Madrid
 *      como si fuera de allí, o mandar a buscar algo que no está en el lineal.
 *   2. Ninguna sustitución silenciosa. Si falta un producto, las recetas que
 *      lo necesitan se quedan fuera de esta zona y se dice cuáles y por qué.
 *      Las alternativas, si las hay, ya vienen en el catálogo de la zona con su
 *      verificación; aquí no se inventa ninguna.
 *   3. Las recetas no se duplican ni se copian: se filtran.
 *
 * Ver catalogo/construir-zona.ts, que es quien escribe el catálogo.
 */
import { SIN_SKU } from './carrito.ts';
import type { DatosMotor, Ensamblaje, Sku } from './tipos.ts';

export interface CatalogoZona {
  zona: string;
  nombre: string;
  cadena: string;
  almacenes: string[];
  /** La fecha de la medición. Hace de versión de los precios de la zona. */
  version: string;
  skus: Record<string, Sku | null>;
  /**
   * Lo que existe igual solo en ALGUNOS almacenes de la zona, por almacén. Va
   * encima de `skus` para quien compra en ese almacén: la barra de pan 83264.1
   * está en ocho de los nueve almacenes de Gran Canaria y el caldo de verduras
   * de Madrid solo en dos. Sin esta capa, lo que no está en todos se perdía
   * para todos. Ver catalogo/construir-zona.ts.
   */
  porAlmacen?: Record<string, Record<string, Sku>>;
}

export interface RecetaFuera {
  receta: string;
  faltan: string[];
}

export interface DatosDeZona extends DatosMotor {
  zona: string;
  /** El almacén cuya capa se ha aplicado, o null si solo lo común. */
  almacen: string | null;
  /** Lo que se ha quitado y por qué. Para decirlo, no para esconderlo. */
  recetasFuera: RecetaFuera[];
}

export function datosDeZona(base: DatosMotor, zona: CatalogoZona, almacen?: string | null): DatosDeZona {
  const skus: Record<string, Sku> = {};
  for (const [canonico, sku] of Object.entries(zona.skus)) if (sku) skus[canonico] = sku;
  // La capa del almacén, solo si se sabe cuál es. Sin almacén, lo común.
  if (almacen) for (const [canonico, sku] of Object.entries(zona.porAlmacen?.[almacen] ?? {})) skus[canonico] = sku;

  const faltanEn = (ingredientes: { canonico: string }[]) => [...new Set(
    ingredientes.map((i) => i.canonico).filter((c) => !SIN_SKU.has(c) && !skus[c]),
  )].sort((a, b) => a.localeCompare(b));

  const recetasFuera: RecetaFuera[] = [];
  const recetas = base.recetas.filter((r) => {
    const faltan = faltanEn(r.ingredientes);
    if (faltan.length) recetasFuera.push({ receta: r.id, faltan });
    return faltan.length === 0;
  });

  const vivas = new Set(recetas.map((r) => r.id));
  let ensamblajes: Record<string, Ensamblaje[]> | undefined;
  if (base.ensamblajes) {
    ensamblajes = {};
    for (const [desde, lista] of Object.entries(base.ensamblajes)) {
      if (!vivas.has(desde)) continue;
      const quedan = lista.filter((e) => faltanEn(e.ingredientes).length === 0);
      if (quedan.length) ensamblajes[desde] = quedan;
    }
  }

  return {
    ...base,
    generadoEn: zona.version,
    zona: zona.zona,
    almacen: almacen ?? null,
    skus,
    recetas,
    ...(ensamblajes ? { ensamblajes } : {}),
    recetasFuera,
  };
}
