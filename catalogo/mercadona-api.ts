/**
 * ═══ EL ÚNICO CLIENTE DE LA API DE MERCADONA PARA LAS AUDITORÍAS ═══
 *
 * Las mismas reglas que todos los scripts de catalogo/, en un solo sitio:
 *   - 300-500 ms entre peticiones, nunca concurrentes.
 *   - User-Agent identificable con contacto.
 *   - 403 o 429: se PARA. Ni reintentos, ni rotación, ni disimulo.
 *
 * Y una que faltaba: distinguir «no existe» de «no se ha podido saber». Un 404
 * es una respuesta: el producto no está en ese almacén. Un error de red, un 5xx
 * o un cuerpo que no es JSON NO lo son, y tratarlos como 404 marcaría como
 * retirado un producto que solo ha fallado al descargar.
 */

const BASE = 'https://tienda.mercadona.es/api';
const UA = 'CundeCatalogBot/0.2 (+contacto: iyiarce@gmail.com; auditoria puntual de ~120 productos de una app de listas de la compra, uso interno)';

export class BloqueoDetectado extends Error {}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
let ultima = 0;
async function turno() {
  const espera = 300 + Math.random() * 200 - (Date.now() - ultima);
  if (espera > 0) await esperar(espera);
  ultima = Date.now();
}

export type Respuesta<T> =
  | { estado: 'ok'; http: number; datos: T; url: string; en: string }
  | { estado: 'no-existe'; http: 404; url: string; en: string }
  | { estado: 'fallo'; http: number | null; motivo: string; url: string; en: string };

async function pedir<T>(url: string, init?: RequestInit): Promise<Respuesta<T>> {
  await turno();
  const en = new Date().toISOString();
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { 'User-Agent': UA, Accept: 'application/json', ...(init?.headers ?? {}) } });
  } catch (err) {
    return { estado: 'fallo', http: null, motivo: `red: ${(err as Error).message}`, url, en };
  }
  if (res.status === 403 || res.status === 429) {
    throw new BloqueoDetectado(`HTTP ${res.status} en ${url}. Paro y reporto.`);
  }
  if (res.status === 404) return { estado: 'no-existe', http: 404, url, en };
  const tipo = res.headers.get('content-type') ?? '';
  if (!res.ok || !tipo.includes('application/json')) {
    return { estado: 'fallo', http: res.status, motivo: `HTTP ${res.status} · ${tipo}`, url, en };
  }
  try {
    return { estado: 'ok', http: res.status, datos: (await res.json()) as T, url, en };
  } catch (err) {
    return { estado: 'fallo', http: res.status, motivo: `JSON: ${(err as Error).message}`, url, en };
  }
}

/** El detalle de un producto en un almacén. */
export function producto(sku: string, almacen: string) {
  return pedir<ProductoApi>(`${BASE}/products/${sku}/?lang=es&wh=${almacen}`);
}

/** El árbol de categorías de un almacén. */
export function categorias(almacen: string) {
  return pedir<{ results: { id: number; name: string; categories?: { id: number; name: string }[] }[] }>(
    `${BASE}/categories/?lang=es&wh=${almacen}`,
  );
}

/** Una categoría de segundo nivel, con sus productos. */
export function categoria(id: number, almacen: string) {
  return pedir<{ categories?: { name: string; products?: ProductoApi[] }[] }>(`${BASE}/categories/${id}/?lang=es&wh=${almacen}`);
}

/**
 * El almacén que sirve un código postal. Mercadona lo devuelve en la cabecera
 * `x-customer-wh` al cambiar el código postal de la sesión; no se guarda
 * ninguna sesión: cada petición es independiente.
 */
export async function almacenDe(cp: string): Promise<{ cp: string; almacen: string | null; http: number | null; en: string; motivo?: string }> {
  await turno();
  const en = new Date().toISOString();
  let res: Response;
  try {
    res = await fetch(`${BASE}/postal-codes/actions/change-pc/`, {
      method: 'PUT',
      headers: { 'User-Agent': UA, 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_postal_code: cp }),
    });
  } catch (err) {
    return { cp, almacen: null, http: null, en, motivo: `red: ${(err as Error).message}` };
  }
  if (res.status === 403 || res.status === 429) throw new BloqueoDetectado(`HTTP ${res.status} resolviendo ${cp}. Paro y reporto.`);
  return { cp, almacen: res.ok ? res.headers.get('x-customer-wh') : null, http: res.status, en };
}

/** Lo que usamos del detalle de producto. La API trae más; esto es lo auditado. */
export interface ProductoApi {
  id: string;
  ean?: string | null;
  display_name: string;
  packaging?: string | null;
  published?: boolean;
  unavailable_from?: string | null;
  limit?: number;
  brand?: string | null;
  categories?: { id: number; name: string; categories?: { id: number; name: string; categories?: { id: number; name: string }[] }[] }[];
  price_instructions?: {
    unit_price?: string | number;
    bulk_price?: string | number;
    reference_price?: string | number;
    reference_format?: string;
    unit_size?: number | string;
    size_format?: string;
    total_units?: number | null;
    pack_size?: number | null;
    is_pack?: boolean;
    drained_weight?: number | string | null;
    approx_size?: boolean;
    selling_method?: number;
    iva?: number | null;
    tax_percentage?: string | number | null;
    unit_name?: string | null;
  };
  nutrition_information?: { allergens?: string | null; ingredients?: string | null };
  details?: { legal_name?: string | null; description?: string | null; storage_instructions?: string | null };
}
