import { datos, zonaCargada } from '../data/motor';
import { buscarActualizacion, guardar, leerGuardada, zonaDe } from './precios';

/**
 * ═══ TRAERSE LOS PRECIOS NUEVOS · EN SEGUNDO PLANO Y SIN PRISA ═══
 *
 * Se llama una vez, al arrancar. No bloquea nada, no enseña nada y no falla
 * hacia arriba: si hay red y hay algo nuevo, se guarda para la próxima
 * apertura; si no, la app sigue con lo que tiene.
 *
 * ═══ POR QUÉ NO SE APLICA YA ═══
 *
 * Porque el usuario puede estar en el pasillo de las conservas mirando su
 * lista. Cambiarle los precios en ese momento le mueve el total mientras
 * compara con la etiqueta, y no ha tocado nada. Un precio de ayer es una
 * imprecisión; un total que cambia solo es un fallo. Ver lib/precios.ts.
 *
 * ═══ LA URL ═══
 *
 * `VITE_PRECIOS_URL`. Sin ella esto no hace ni una petición, que es el estado
 * por defecto: la app funciona exactamente como funcionaba, con los precios del
 * APK. Así se puede montar el backend sin tocar el cliente y encenderlo cuando
 * esté, en vez de al revés.
 */

/** Margen antes de rendirse. Esto no urge: si no llega, mañana se vuelve a pedir. */
const ESPERA_MAXIMA_MS = 8000;

let yaLanzada = false;

export function sincronizarPrecios(): void {
  // React 18 monta dos veces en desarrollo. Sin esto son dos peticiones a un
  // servidor que no es nuestro por cada arranque.
  if (yaLanzada) return;
  yaLanzada = true;

  /**
   * ═══ UNA URL POR ZONA ═══
   *
   * `VITE_PRECIOS_URL` puede llevar `{zona}` y entonces se pide la de la zona
   * cargada. Sin `{zona}`, la URL es la de siempre y solo vale para Madrid:
   * lo que hay publicado es mad3, y pedirlo desde Gran Canaria sería bajarse
   * precios que luego hay que rechazar.
   */
  const zona = zonaCargada().zona;
  const plantilla = import.meta.env.VITE_PRECIOS_URL as string | undefined;
  if (!plantilla) return;
  if (!plantilla.includes('{zona}') && zona !== 'madrid') return;
  const url = plantilla.replace('{zona}', encodeURIComponent(zona));

  const guardada = leerGuardada(zona);
  /* Se compara contra la MÁS NUEVA de las dos que ya se tienen —la del APK y la
     guardada—: tras publicar una versión, la del APK puede ser más reciente que
     la que quedó en el móvil, y sin esto se volvería a bajar una vieja. */
  const actual = guardada && guardada.version > datos.generadoEn ? guardada.version : datos.generadoEn;

  const corta = new AbortController();
  const reloj = setTimeout(() => corta.abort(), ESPERA_MAXIMA_MS);

  void buscarActualizacion(url, actual, corta.signal)
    // De otra zona no se guarda: no se aplicaría nunca y ocuparía el sitio.
    .then((nueva) => { if (nueva && zonaDe(nueva) === zona) guardar(nueva); })
    .finally(() => clearTimeout(reloj));
}
