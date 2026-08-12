/**
 * ═══ EL SUMIDERO · LO ÚNICO QUE CONOCE SUPABASE ═══
 *
 * Ningún componente, página ni reductor importa este fichero. Emiten con
 * `analitica(...)` y no saben a dónde va. Cambiar Supabase por otra cosa es
 * reescribir este fichero y nada más.
 *
 * ═══ CÓMO HABLA CON EL SERVIDOR ═══
 *
 * Por RPC (`/rest/v1/rpc/track_events`), no por `insert` en la tabla. La tabla
 * tiene los permisos revocados para `anon`: si el cliente pudiera insertar
 * directamente, también podría leer, borrar o escribir un millón de filas. La
 * función es la única puerta, valida cada evento y no devuelve nada.
 *
 * Se manda en lotes de 50. Marcar cuarenta casillas de la compra no puede ser
 * cuarenta peticiones, y al recuperar cobertura tampoco interesa vaciar la cola
 * de una en una.
 *
 * ═══ LA CLAVE QUE VA AQUÍ ═══
 *
 * La `publishable`/`anon`, que viaja dentro del APK y por tanto es pública de
 * facto. Nunca `service_role` ni la contraseña de Postgres. Lo que protege los
 * datos no es esconder esta clave: es que con ella solo se pueda ejecutar una
 * función que inserta.
 */

import {
  asomar, confirmar, cuantosHay, encolar, type EventoEnCola,
} from './analitica-cola';
import { installId, plataforma, sessionId, versionApp } from './analitica-identidad';
import type { PropsAnalitica } from './analitica';

const POR_LOTE = 50;
/** Si el envío falla no se reintenta en bucle: se espera al siguiente disparo. */
let enviando = false;

interface Config { url: string; clave: string }
let config: Config | null = null;

function leerConfig(): Config | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const clave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !clave) return null;
  return { url: url.replace(/\/+$/, ''), clave };
}

/**
 * Un evento no puede ser arbitrariamente grande. El servidor también lo
 * comprueba, pero rechazarlo aquí evita gastar una petición y —sobre todo— que
 * un evento gordo bloquee el lote entero una y otra vez sin salir nunca de la
 * cola.
 */
const MAX_PROPS_BYTES = 2048;

function propsSeguras(props: PropsAnalitica): Record<string, unknown> {
  const limpio: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null) continue;
    /* `week_number` y `screen` viajan en columna propia, no en el JSON. */
    if (k === 'week_number' || k === 'screen') continue;
    limpio[k] = v;
  }
  const json = JSON.stringify(limpio);
  if (json.length > MAX_PROPS_BYTES) {
    return { _recortado: true, _bytes: json.length };
  }
  return limpio;
}

/** Las pantallas válidas. Un `screen` fuera de esta lista no viaja. */
const PANTALLAS = new Set([
  'onboarding_portada', 'onboarding_super', 'onboarding_datos', 'onboarding_presupuesto',
  'semana', 'compra', 'ajustes', 'hoja_dia', 'cierre', 'platos_bloqueados',
]);

export function construirEvento(nombre: string, props: PropsAnalitica): EventoEnCola {
  const pantalla = typeof props.screen === 'string' && PANTALLAS.has(props.screen)
    ? props.screen : null;
  const semana = typeof props.week_number === 'number'
    && Number.isInteger(props.week_number)
    && props.week_number >= 0 && props.week_number <= 1000
    ? props.week_number : null;

  return {
    event_id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    event_name: nombre.slice(0, 64),
    install_id: installId(),
    session_id: sessionId(),
    app_version: versionApp(),
    platform: plataforma(),
    week_number: semana,
    screen: pantalla,
    properties: propsSeguras(props),
    ocurrido_en: new Date().toISOString(),
  };
}

async function enviarLote(lote: EventoEnCola[]): Promise<boolean> {
  if (!config) return false;
  try {
    const res = await fetch(`${config.url}/rest/v1/rpc/track_events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: config.clave,
        Authorization: `Bearer ${config.clave}`,
      },
      body: JSON.stringify({ p_events: lote }),
    });
    /* 4xx que no sea 429 significa que el lote NO va a entrar nunca —evento mal
       formado, función cambiada—. Se confirma igualmente para que no se quede
       atascado delante bloqueando todo lo que venga detrás. */
    if (res.ok) return true;
    if (res.status >= 400 && res.status < 500 && res.status !== 429) {
      if (import.meta.env.DEV) {
        console.warn('[analytics] lote rechazado', res.status, await res.text().catch(() => ''));
      }
      return true;
    }
    return false;
  } catch {
    /* Sin red. Se queda en la cola. */
    return false;
  }
}

export async function vaciar(): Promise<void> {
  if (enviando || !config) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  enviando = true;
  try {
    while (cuantosHay() > 0) {
      const lote = asomar(POR_LOTE);
      if (lote.length === 0) break;
      // eslint-disable-next-line no-await-in-loop -- en serie a propósito: en
      // paralelo se dispararía la cola entera contra el servidor de golpe.
      const bien = await enviarLote(lote);
      if (!bien) break;
      confirmar(lote.map((e) => e.event_id));
    }
  } finally {
    enviando = false;
  }
}

/**
 * Conecta la analítica al arrancar la app.
 *
 * Devuelve el sumidero, o `null` si no hay configuración: sin `VITE_SUPABASE_URL`
 * esto no encola ni pide nada, que es el estado correcto en desarrollo y en un
 * fork sin credenciales.
 */
export function sumideroSupabase(): ((n: string, p: PropsAnalitica) => void) | null {
  config = leerConfig();
  if (!config) return null;

  /* Al arrancar y al recuperar cobertura. Lo segundo importa más de lo que
     parece: la cola se llena justo cuando NO hay red. */
  void vaciar();
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => { void vaciar(); });
    /* Al irse a segundo plano: en móvil, cerrar la app es lo normal, y sin esto
       lo último de la sesión se queda esperando al siguiente arranque. */
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void vaciar();
    });
  }

  return (nombre, props) => {
    encolar(construirEvento(nombre, props));
    /* No se espera: `analitica()` la llama un componente después de un
       `dispatch`, y una acción de usuario no puede quedar detrás de una
       petición de red. */
    void vaciar();
  };
}
