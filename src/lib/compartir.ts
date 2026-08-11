import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Directory, Filesystem } from '@capacitor/filesystem';

/**
 * ═══ MANDAR EL PNG A DONDE EL USUARIO QUIERA ═══
 *
 * Sin integraciones por red social. La hoja del sistema ya sabe qué apps tiene
 * instaladas el usuario y él ya sabe usarla; un SDK de Instagram sería código
 * propio para hacer peor lo que el sistema hace bien.
 *
 * Tres caminos, en este orden:
 *
 *   1. NATIVO — se escribe el fichero en caché y se pasa su URI a la hoja del
 *      sistema. Es lo único que permite mandar la IMAGEN y no un enlace.
 *   2. WEB CON `navigator.share` — solo si acepta ficheros. Muchos navegadores
 *      tienen `share` pero no `canShare({files})`, y llamarlo igual comparte el
 *      texto sin la imagen, que es peor que no ofrecerlo.
 *   3. DESCARGA — el PNG al disco. No es compartir, y por eso quien llama lo
 *      distingue en el resultado: la analítica no puede contar una descarga
 *      como una compartición.
 *
 * Nada de esto lanza hacia arriba. Cancelar no es un fallo —el usuario ha
 * decidido no compartir, que es una respuesta— y se devuelve como tal.
 */
export type ResultadoCompartir =
  | { estado: 'compartido' }
  | { estado: 'cancelado' }
  | { estado: 'descargado' }
  | { estado: 'fallo' };

/** El nombre del fichero. Sin fecha ni id: no hace falta y es un dato menos. */
const NOMBRE = 'cunde.png';

async function compartirNativo(base64: string, texto: string): Promise<ResultadoCompartir> {
  // En caché y no en documentos: es un fichero de usar y tirar, y el sistema lo
  // limpia solo. Guardarlo en documentos le dejaría basura al usuario.
  const escrito = await Filesystem.writeFile({
    path: NOMBRE,
    data: base64,
    directory: Directory.Cache,
  });
  await Share.share({ text: texto, files: [escrito.uri] });
  return { estado: 'compartido' };
}

function aBlob(base64: string): Blob {
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return new Blob([bytes], { type: 'image/png' });
}

function descargar(base64: string): ResultadoCompartir {
  const url = URL.createObjectURL(aBlob(base64));
  const a = document.createElement('a');
  a.href = url;
  a.download = NOMBRE;
  a.click();
  // Revocar en el mismo tick cancela la descarga en algunos navegadores.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return { estado: 'descargado' };
}

/**
 * ¿Ha cancelado el usuario?
 *
 * No hay un código de error común: Capacitor y la Web Share API cada uno tiene
 * el suyo, y la única señal fiable en web es `AbortError`. Se mira también el
 * mensaje porque el plugin de Android devuelve "Share canceled" sin nombre de
 * error. Es feo y es lo que hay: la alternativa es contar cada cancelación como
 * un fallo y llenar la analítica de errores que no lo son.
 */
function esCancelacion(e: unknown): boolean {
  if (e instanceof DOMException && e.name === 'AbortError') return true;
  const mensaje = e instanceof Error ? e.message : String(e ?? '');
  return /cancel/i.test(mensaje);
}

export async function compartirImagen(base64: string, texto: string): Promise<ResultadoCompartir> {
  try {
    if (Capacitor.isNativePlatform()) return await compartirNativo(base64, texto);

    const archivo = new File([aBlob(base64)], NOMBRE, { type: 'image/png' });
    if (navigator.canShare?.({ files: [archivo] })) {
      await navigator.share({ files: [archivo], text: texto });
      return { estado: 'compartido' };
    }
    return descargar(base64);
  } catch (e) {
    if (esCancelacion(e)) return { estado: 'cancelado' };
    // Último intento antes de rendirse: si compartir falló por lo que sea, al
    // menos que el usuario se quede con la imagen.
    if (!Capacitor.isNativePlatform()) {
      try { return descargar(base64); } catch { /* ya no hay más que hacer */ }
    }
    return { estado: 'fallo' };
  }
}

/** Si tiene sentido ofrecer «Guardar imagen» aparte de «Compartir». */
export function puedeDescargar(): boolean {
  return !Capacitor.isNativePlatform();
}
