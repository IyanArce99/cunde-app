/**
 * ═══ QUIÉN ES QUIÉN, SIN SABER QUIÉN ES NADIE ═══
 *
 * Cunde no tiene cuentas. Para poder decir «cuántas personas llegan a la semana
 * 2» hace falta poder contar la misma instalación dos veces, y nada más.
 *
 * `install_id` es un UUID aleatorio que se crea una vez y se guarda. No sale de
 * un correo, ni de un nombre, ni del identificador publicitario, ni de una
 * huella del dispositivo. Es un número sin significado: dos instalaciones de la
 * misma persona son dos usuarios distintos, y si alguien borra los datos de la
 * app aparece como usuario nuevo. Las dos cosas están asumidas — la alternativa
 * para arreglarlas es identificar a la persona, que es justo lo que no se hace.
 *
 * `session_id` agrupa lo que pasa en un arranque. **Una sesión es un arranque
 * real de la app**: se crea al cargar el módulo y no caduca por inactividad. No
 * es la definición de un analytics de empresa —volver tras dos horas en segundo
 * plano cuenta como la misma sesión— y es suficiente para la beta: lo que se
 * quiere saber es qué pasa en una visita, no cuántas visitas hay.
 */

const CLAVE_INSTALL = 'cunde:install-id';

/**
 * `crypto.randomUUID` no existe en contextos no seguros ni en WebViews viejas.
 * Un identificador que a veces no se puede crear dejaría a esos usuarios fuera
 * del recuento, así que hay respaldo. No pretende ser criptográfico: solo
 * necesita no repetirse entre instalaciones.
 */
function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const b = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let cacheInstall: string | null = null;

/**
 * El de siempre, o uno nuevo la primera vez.
 *
 * Si lo guardado no es un UUID —alguien tocó `localStorage`, o quedó basura de
 * una versión anterior— se descarta y se crea otro: la columna del servidor es
 * `uuid` y un valor inválido haría fallar la inserción del lote entero.
 */
export function installId(): string {
  if (cacheInstall) return cacheInstall;
  try {
    const guardado = window.localStorage.getItem(CLAVE_INSTALL);
    if (guardado && ES_UUID.test(guardado)) {
      cacheInstall = guardado;
      return guardado;
    }
    const nuevo = uuid();
    window.localStorage.setItem(CLAVE_INSTALL, nuevo);
    cacheInstall = nuevo;
    return nuevo;
  } catch {
    /* Sin `localStorage` (modo privado de algún navegador) la analítica sigue
       funcionando, pero cada arranque cuenta como una instalación nueva. Es
       peor dato; no es un fallo de la app. */
    cacheInstall ??= uuid();
    return cacheInstall;
  }
}

/** Se fija al cargar el módulo: un arranque, una sesión. */
const SESION = uuid();

export function sessionId(): string {
  return SESION;
}

/**
 * Dónde corre. Se pregunta a Capacitor si está: es quien lo sabe de verdad.
 * Analizar el user-agent para adivinar Android es frágil y además mentiría en
 * un WebView de desarrollo.
 */
export function plataforma(): 'android' | 'ios' | 'web' {
  const cap = (window as unknown as {
    Capacitor?: { getPlatform?: () => string };
  }).Capacitor;
  const p = cap?.getPlatform?.();
  if (p === 'android' || p === 'ios') return p;
  return 'web';
}

/**
 * La versión, de un solo sitio: `package.json`, inyectado por Vite en tiempo de
 * compilación (ver `vite.config.ts`). Escribirla a mano aquí garantizaba que
 * tarde o temprano dijera una distinta de la publicada.
 */
export function versionApp(): string {
  return (typeof __VERSION_APP__ === 'string' && __VERSION_APP__) || 'desconocida';
}

/** Solo para tests: olvida el cacheado para poder probar la primera creación. */
export function _olvidarInstallId(): void {
  cacheInstall = null;
}

export { CLAVE_INSTALL };
