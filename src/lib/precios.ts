import type { DatosMotor, Sku } from '../motor/tipos.ts';
import { deFechaDia, esFechaDia } from './fechas';

/**
 * ═══ PRECIOS QUE SE ACTUALIZAN SIN PUBLICAR EN LA TIENDA ═══
 *
 * El problema que resuelve: los precios de Mercadona se revisan a diario con un
 * cron, pero viajaban DENTRO de `motor-datos.json`, que se empaqueta en el APK.
 * Así que una bajada de precio no le llegaba a nadie hasta la siguiente
 * publicación en la Play Store — y publicar tarda días y se revisa a mano. El
 * 7 de agosto cambiaron diez precios y no llegaron a ningún usuario.
 *
 * ═══ CÓMO ═══
 *
 * La app trae en el APK la instantánea del día en que se compiló, y al arrancar
 * mira si hay una más nueva. Si la hay, se la guarda. Los precios que ve el
 * usuario son siempre locales: aquí solo se decide CUÁLES son los locales.
 *
 * ═══ Y SE APLICA AL ARRANCAR, NUNCA EN CALIENTE ═══
 *
 * La instantánea que se descarga hoy se aplica en la siguiente apertura, no en
 * esta. Cambiar los precios mientras alguien mira su lista movería la cifra que
 * tiene delante sin que él haya tocado nada, y en el supermercado eso es peor
 * que un precio de ayer: estás comparando lo que dice la app con lo que dice la
 * etiqueta, y la app cambia sola.
 *
 * ═══ NO ES SUPABASE, ES UNA URL ═══
 *
 * A este fichero le da igual de dónde venga la instantánea: una tabla de
 * Supabase, un objeto en su Storage o un JSON estático. Se pasa la URL por
 * `VITE_PRECIOS_URL` y si no está configurada esto no hace nada — la app
 * funciona exactamente como antes. Atar el cliente a un proveedor concreto es
 * lo que después obliga a tocar la app para cambiar de proveedor.
 */

/** Una fila de producto tal y como la necesita el motor. */
export type FilaPrecio = Pick<
  Sku,
  'sku' | 'nombre' | 'contenido' | 'unidad' | 'precio' | 'precio_kg_l_ud'
  | 'packaging' | 'unidades_pack' | 'peso_variable' | 'departamento' | 'subfamilia'
> & Pick<Partial<Sku>, 'contenido_etiqueta' | 'alergenos_desconocidos'>;

export interface Instantanea {
  /** La fecha de captura. Es lo que se compara para saber si hay algo nuevo. */
  version: string;
  almacen: string;
  /**
   * La zona de la que son estos precios (ver lib/zona.ts). Las publicadas antes
   * del 14 oct 2026 no lo llevan y son todas de mad3: sin campo, Madrid.
   *
   * Una instantánea de otra zona NO se aplica nunca, ni a medias. Los precios
   * de Madrid sobre el catálogo de Gran Canaria serían precios de Madrid
   * enseñados como de Gran Canaria, que es justo lo que la zona existe para
   * impedir.
   */
  zona?: string;
  /** Por ingrediente canónico, que es como los busca el motor. */
  skus: Record<string, FilaPrecio>;
}

/** Una clave por zona. Madrid conserva la de siempre: es la que ya tienen guardada. */
const claveDe = (zona: string) => (zona === 'madrid' ? 'cunde:precios:v1' : `cunde:precios:v1:${zona}`);
export const zonaDe = (inst: Pick<Instantanea, 'zona'>) => inst.zona ?? 'madrid';

/**
 * Cuánto puede moverse un precio de una captura a otra antes de oler mal.
 *
 * El mismo 60% que ya comprueba `catalogo/aplicar-precios.js` antes de tocar el
 * catálogo. Se repite aquí a propósito y no se confía en que el servidor ya lo
 * haya mirado: entre el cron y este código hay una red y un bucket, y el día
 * que alguien suba un fichero mal, el que se come el precio inventado es el
 * usuario delante del lineal.
 */
const SALTO_SOSPECHOSO = 0.6;
/** Y qué fracción del catálogo puede cambiar de golpe. */
const FRACCION_MAXIMA = 1 / 3;

/** Que sea una instantánea y no cualquier cosa que devuelva un servidor. */
export function esInstantanea(x: unknown): x is Instantanea {
  if (!x || typeof x !== 'object') return false;
  const i = x as Partial<Instantanea>;
  if (typeof i.version !== 'string' || !i.version) return false;
  if (typeof i.almacen !== 'string') return false;
  if (i.zona !== undefined && typeof i.zona !== 'string') return false;
  if (!i.skus || typeof i.skus !== 'object') return false;
  for (const fila of Object.values(i.skus)) {
    if (!fila || typeof fila !== 'object') return false;
    const f = fila as Partial<FilaPrecio>;
    if (typeof f.sku !== 'string') return false;
    if (typeof f.precio !== 'number' || !Number.isFinite(f.precio) || f.precio <= 0) return false;
    if (typeof f.contenido !== 'number' || !Number.isFinite(f.contenido) || f.contenido <= 0) return false;
  }
  return true;
}

export interface ResultadoAplicar {
  aplicados: number;
  rechazados: string[];
  /** Cuando la instantánea entera se descarta, el porqué. */
  descartada?: 'demasiados-cambios' | 'vacia' | 'otra-zona';
}

/**
 * Mete los precios de la instantánea en el catálogo del motor.
 *
 * MUTA `datos` a propósito: el motor lo tiene como una constante de módulo y
 * media docena de ficheros lo importan por referencia. Devolver una copia
 * obligaría a hilarla por todos ellos para que la lea quien tiene que leerla, y
 * el primero que se olvidase generaría con los precios viejos sin que nada
 * fallara. Se llama UNA vez, antes de pintar nada.
 */
export function aplicarInstantanea(datos: DatosMotor, inst: Instantanea, zona = 'madrid'): ResultadoAplicar {
  if (zonaDe(inst) !== zona) return { aplicados: 0, rechazados: [], descartada: 'otra-zona' };
  const entradas = Object.entries(inst.skus);
  if (!entradas.length) return { aplicados: 0, rechazados: [], descartada: 'vacia' };

  const rechazados: string[] = [];
  const buenos: [string, FilaPrecio][] = [];

  for (const [canonico, fila] of entradas) {
    const actual = datos.skus[canonico];
    // Un canónico que la app no conoce no es un error: la instantánea puede
    // venir de un catálogo más nuevo que este APK. Se ignora y ya.
    if (!actual) continue;
    if (actual.precio > 0) {
      const salto = Math.abs(fila.precio - actual.precio) / actual.precio;
      if (salto > SALTO_SOSPECHOSO) {
        rechazados.push(`${canonico}: ${actual.precio} -> ${fila.precio}`);
        continue;
      }
    }
    /**
     * MISMO producto, OTRO formato: se rechaza. Si el tarro de 570 g pasa a
     * 400 g, el precio nuevo no es una subida ni una bajada, es otro envase, y
     * aplicarlo sobre el contenido viejo daría un precio por kilo falso. El neto
     * de la etiqueta es `contenido_etiqueta` en las conservas y `contenido` en
     * lo demás; una instantánea publicada antes de contar el escurrido trae el
     * neto en `contenido`, y por eso se compara neto con neto.
     */
    if (fila.sku === actual.sku) {
      const netoFila = fila.contenido_etiqueta ?? fila.contenido;
      const netoActual = actual.contenido_etiqueta ?? actual.contenido;
      if (Math.abs(netoFila - netoActual) > 1e-6) {
        rechazados.push(`${canonico}: el envase pasa de ${netoActual} a ${netoFila} ${actual.unidad}`);
        continue;
      }
    }
    buenos.push([canonico, fila]);
  }

  /**
   * Si cambia más de un tercio, no se aplica NADA.
   *
   * Un puñado de precios distintos es un martes cualquiera; un tercio del
   * catálogo moviéndose de golpe es que algo se ha roto arriba — un scrape a
   * medias, otro almacén, un cambio de formato en la respuesta. Ante eso, los
   * precios de ayer son mejores que los de nadie.
   */
  const cambian = buenos.filter(([c, f]) => Math.abs(f.precio - datos.skus[c].precio) > 0.005);
  if (cambian.length > Object.keys(datos.skus).length * FRACCION_MAXIMA) {
    return { aplicados: 0, rechazados, descartada: 'demasiados-cambios' };
  }

  for (const [canonico, fila] of buenos) {
    const actual = datos.skus[canonico];
    if (fila.sku === actual.sku) {
      /* El mismo producto: de la instantánea, el precio y lo que se lee en la
         etiqueta. Lo que rinde el envase (`contenido`, el escurrido en las
         conservas) es del APK, y el precio por kilo se recalcula sobre ello:
         consumo y carrito tienen que hablar de lo mismo. */
      Object.assign(actual, {
        nombre: fila.nombre,
        precio: fila.precio,
        packaging: fila.packaging,
        departamento: fila.departamento,
        subfamilia: fila.subfamilia,
        precio_kg_l_ud: Number((fila.precio / actual.contenido).toFixed(4)),
      });
    } else {
      // Otro producto: la fila entera. Ver «trae la fila entera» en los tests.
      Object.assign(actual, fila);
    }
  }
  return { aplicados: buenos.length, rechazados };
}

/** La última instantánea guardada, si la hay y si sigue siendo válida. */
export function leerGuardada(zona = 'madrid'): Instantanea | null {
  try {
    const crudo = localStorage.getItem(claveDe(zona));
    if (!crudo) return null;
    const x: unknown = JSON.parse(crudo);
    // Una guardada con otra zona en su clave es un almacenamiento tocado.
    return esInstantanea(x) && zonaDe(x) === zona ? x : null;
  } catch {
    // Almacenamiento lleno, JSON corrupto, modo privado. Nada de esto puede
    // impedir que la app arranque: se sigue con los precios del APK.
    return null;
  }
}

export function guardar(inst: Instantanea): void {
  try {
    localStorage.setItem(claveDe(zonaDe(inst)), JSON.stringify(inst));
  } catch {
    // Ver arriba. Se perderá la actualización y se volverá a pedir mañana.
  }
}

/**
 * Pide la instantánea publicada. `null` si no hay nada nuevo o si no se puede.
 *
 * Nunca lanza: esto corre en el arranque de una app que tiene que funcionar sin
 * cobertura, y una promesa rechazada sin capturar en ese punto es una pantalla
 * en blanco por no haber podido consultar un precio.
 */
export async function buscarActualizacion(
  url: string,
  versionActual: string,
  senal?: AbortSignal,
): Promise<Instantanea | null> {
  try {
    const res = await fetch(url, { signal: senal, headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    const x: unknown = await res.json();
    if (!esInstantanea(x)) return null;
    // Solo hacia adelante: una instantánea más vieja que la que ya se tiene no
    // se aplica. Es lo que impide que un caché intermedio revierta precios.
    if (x.version <= versionActual) return null;
    return x;
  } catch {
    return null;
  }
}

/**
 * ═══ CUÁNTOS DÍAS TIENEN LOS PRECIOS QUE SE ESTÁN VIENDO ═══
 *
 * La cabecera de Compra enseña la fecha del catálogo desde el principio, y eso
 * está bien: es el dato que uno comprueba. Pero se lee EXACTAMENTE IGUAL con
 * dos días que con cuarenta, y quien mira «10 AGO» un 21 de agosto tiene que
 * restar de cabeza en mitad del súper para saber si fiarse.
 *
 * Esto existe porque la cadena que trae precios nuevos tiene tres eslabones
 * —el cron que raspa, la publicación a mano, y que la app tenga configurada la
 * URL— y ninguno avisa al usuario cuando se rompe. Que la app note su propia
 * antigüedad es lo único que protege a quien está delante del lineal pase lo
 * que pase por detrás.
 */
export function diasDePrecios(version: string, hoyISO: string): number {
  /**
   * `esFechaDia` y no `Number.isFinite` sobre el resultado: la cadena vacía
   * pasaba la comprobación de finitud y salía por 46.244 días.
   *
   * El motivo es que `''.split('-')` da `['']` y `Number('')` es CERO, no
   * `NaN`. Con eso, `deFechaDia` construía `new Date(0, 0, 1)` —y JavaScript
   * interpreta los años de 0 a 99 como 1900+n— así que salía una fecha de 1900
   * perfectamente válida y finita. Una versión ilegible tiene que dar cero, no
   * un siglo.
   */
  if (!esFechaDia(version) || !esFechaDia(hoyISO)) return 0;
  const dia = 24 * 60 * 60 * 1000;
  const a = deFechaDia(version).getTime();
  const b = deFechaDia(hoyISO).getTime();
  // Nunca negativo: unos precios «del futuro» son un reloj mal puesto, no una
  // antigüedad, y decir «hace -3 días» es peor que no decir nada.
  return Math.max(0, Math.round((b - a) / dia));
}

/**
 * A partir de cuántos días se dice la antigüedad en vez de solo la fecha.
 *
 * Siete, y el número tiene motivo: la app vende semanas. Unos precios de hace
 * más de siete días son más viejos que la semana que están valorando, y ahí la
 * fecha deja de ser un detalle y pasa a ser algo que hay que juzgar.
 *
 * Por debajo no se dice nada. Publicar es una decisión humana y puede tardar
 * unos días con toda normalidad; avisar de eso sería gritar por costumbre y
 * enseñar al usuario a no hacer caso del aviso cuando de verdad importe.
 */
export const DIAS_PRECIOS_VIEJOS = 7;

export function preciosViejos(version: string, hoyISO: string): boolean {
  return diasDePrecios(version, hoyISO) >= DIAS_PRECIOS_VIEJOS;
}
