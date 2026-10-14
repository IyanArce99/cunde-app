/**
 * ═══ DE QUÉ ZONA SON LOS PRECIOS ═══
 *
 * Una zona es un catálogo MEDIDO: unos almacenes de Mercadona consultados uno a
 * uno el mismo día. Hoy hay dos:
 *
 *   · Madrid        el catálogo de siempre, del almacén mad3. Madrid tiene tres
 *                   almacenes (mad1, mad2, mad3) y en el fresco cambian: 15 de
 *                   34 frescos tienen otro precio entre ellos (medido el 10 ago).
 *                   Sin preguntar a Mercadona no se sabe qué código postal va a
 *                   cuál, así que en Madrid se enseña mad3 y se dice.
 *   · Gran Canaria  los NUEVE almacenes con reparto online de la isla, medidos
 *                   el 14 oct 2026. Para los SKU de la app dan lo mismo salvo
 *                   cinco, y esos cinco se tratan aparte (ver
 *                   catalogo/construir-zona.ts). Solo cuentan los códigos
 *                   postales que Mercadona asigna a uno de esos nueve.
 *
 * Fuera de eso no se inventa nada. Tres coberturas:
 *
 *   · `medida`         el código postal cae en una zona medida.
 *   · `referencia`     no hay zona para ese código; se enseñan los precios de
 *                      Madrid y la app dice que son de Madrid.
 *   · `sin-cobertura`  Canarias fuera de lo medido (Tenerife, Lanzarote,
 *                      Fuerteventura, el interior de Gran Canaria sin reparto).
 *                      Allí no es que el precio cambie un poco: faltan
 *                      productos. Se enseña Madrid como EJEMPLO y se dice que no
 *                      sirve para comprar allí.
 *
 * El código postal se resuelve aquí, en el teléfono y sin red: la tabla de
 * Gran Canaria va dentro del catálogo de la zona. La app nunca pregunta a
 * Mercadona —eso es raspar desde el móvil de cada usuario—.
 */
import granCanaria from '../data/zonas/gran-canaria.json';
import { esCodigoPostal } from './codigoPostal';
import { CLAVES_ANTERIORES, STORAGE_KEY } from '../state/almacenamiento';

export type ZonaId = 'madrid' | 'gran-canaria';
export type Cobertura = 'medida' | 'referencia' | 'sin-cobertura';

export interface ZonaResuelta {
  zona: ZonaId;
  /** El almacén de Mercadona, si se sabe. En Madrid es el medido: mad3. */
  almacen: string | null;
  cobertura: Cobertura;
}

export const NOMBRE_ZONA: Record<ZonaId, string> = {
  madrid: 'Madrid',
  'gran-canaria': 'Gran Canaria',
};

const almacenesGC = new Set(granCanaria.almacenes);
const cpGC = new Map(granCanaria.codigosPostales.map((c) => [c.cp, c.almacen]));

export function resolverZona(cp: string | null | undefined): ZonaResuelta {
  if (!esCodigoPostal(cp)) return { zona: 'madrid', almacen: 'mad3', cobertura: 'referencia' };
  const almacen = cpGC.get(cp);
  if (almacen && almacenesGC.has(almacen)) return { zona: 'gran-canaria', almacen, cobertura: 'medida' };
  const provincia = cp.slice(0, 2);
  // 35 Las Palmas, 38 Santa Cruz de Tenerife. Un código de Gran Canaria que no
  // está en la tabla, o que está sin almacén, cae aquí: no hay reparto online
  // y los precios de la tienda física no están medidos.
  if (provincia === '35' || provincia === '38') return { zona: 'madrid', almacen: 'mad3', cobertura: 'sin-cobertura' };
  if (provincia === '28') return { zona: 'madrid', almacen: 'mad3', cobertura: 'medida' };
  return { zona: 'madrid', almacen: 'mad3', cobertura: 'referencia' };
}

/**
 * La zona del código postal GUARDADO, para cargar el catálogo antes de pintar.
 *
 * Se lee del estado de la app y no de una clave propia: el código postal es la
 * única fuente de verdad, y dos copias acaban diciendo cosas distintas. Si no
 * hay estado o no se puede leer, Madrid como referencia, que es lo que la app
 * hacía siempre.
 */
export function zonaAlArrancar(leer: (clave: string) => string | null = (k) => window.localStorage.getItem(k)): ZonaResuelta {
  for (const clave of [STORAGE_KEY, ...CLAVES_ANTERIORES]) {
    try {
      const crudo = leer(clave);
      if (!crudo) continue;
      return resolverZona(JSON.parse(crudo)?.perfil?.codigoPostal);
    } catch {
      // Clave corrupta: la siguiente. Lo mismo que hace cargarEstadoInicial.
    }
  }
  return resolverZona(null);
}

/** Lo que se dice de la zona, en una línea. Tuteo, sin disculpas. */
export function textoDeZona(z: ZonaResuelta): string {
  if (z.cobertura === 'sin-cobertura') {
    return 'En tu zona de Canarias aún no tengo precios. Te enseño los de Madrid como ejemplo: allí no te sirven para comprar.';
  }
  if (z.cobertura === 'referencia') return 'Tu zona aún no la tengo. Los precios son los de Madrid.';
  if (z.zona === 'gran-canaria') return `Precios de Gran Canaria, tienda online, almacén ${z.almacen}.`;
  return 'Precios de Madrid, almacén mad3. En la fruta y el fresco tu tienda puede variar.';
}
