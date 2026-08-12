/**
 * ═══ COLA PERSISTENTE DE EVENTOS ═══
 *
 * La pantalla Compra se usa de pie, en el sótano de un supermercado, sin
 * cobertura. Si la analítica dependiera de tener red, justo la parte del
 * producto que más interesa medir sería la que nunca se mide.
 *
 * Así que emitir un evento **nunca toca la red**: se apila en memoria, se
 * vuelca a `localStorage` y se intenta enviar cuando toca. Si el envío falla,
 * no se borra nada.
 *
 * ═══ POR QUÉ localStorage Y NO IndexedDB ═══
 *
 * Porque la cola es pequeña y el coste de IndexedDB es una API asíncrona, un
 * esquema y una migración. En la beta caben mil eventos de ~200 bytes: 200 KB
 * contra los 5 MB del cupo. El día que esto se quede corto, el sitio donde
 * cambiarlo es este fichero y nada más.
 *
 * ═══ EL COSTE DE ESCRIBIR ═══
 *
 * Serializar la cola entera en cada evento sería O(n) por marcar una casilla de
 * la compra, con 40 casillas seguidas. Por eso el volcado va **agrupado**: el
 * evento entra en memoria al instante y el `localStorage` se escribe una vez
 * por tanda, no una por evento.
 */

export interface EventoEnCola {
  event_id: string;
  event_name: string;
  install_id: string;
  session_id: string;
  app_version: string;
  platform: string;
  week_number: number | null;
  screen: string | null;
  properties: Record<string, unknown>;
  /** Cuándo ocurrió DE VERDAD, no cuándo se pudo enviar. */
  ocurrido_en: string;
}

const CLAVE = 'cunde:analytics-queue';

/**
 * ═══ EL LÍMITE, Y POR QUÉ SE TIRAN LOS VIEJOS ═══
 *
 * Mil eventos. Un móvil sin conexión durante semanas no puede convertirse en un
 * almacén que se come el cupo de `localStorage` y tumba la persistencia del
 * ESTADO de la app, que es lo que de verdad no se puede perder.
 *
 * Al llegar al límite se descartan los MÁS ANTIGUOS. Es FIFO puro y se ha
 * elegido a sabiendas frente a un sistema de prioridades:
 *
 *   · Un esquema de prioridades exige decidir hoy qué evento importará dentro
 *     de tres meses, y equivocarse ahí se paga con datos que no existen.
 *   · Los eventos viejos de una cola atascada son de sesiones que ya no se
 *     pueden reconstruir enteras de todos modos.
 *   · Y quien llega a mil eventos sin enviar es un caso tan raro que optimizar
 *     su reparto es trabajo perdido.
 *
 * Lo que se pierde queda contado en `descartados`, para poder saber si ese caso
 * raro deja de serlo.
 */
const MAXIMO = 1000;

let cola: EventoEnCola[] = [];
let cargada = false;
let descartados = 0;
let volcadoPendiente: ReturnType<typeof setTimeout> | null = null;

function cargar(): void {
  if (cargada) return;
  cargada = true;
  try {
    const bruto = window.localStorage.getItem(CLAVE);
    if (!bruto) return;
    const leido: unknown = JSON.parse(bruto);
    /* Todo lo que venga de disco es sospechoso: puede ser de una versión
       anterior, o estar a medio escribir por un cierre a mitad. Se filtra
       elemento a elemento en vez de confiar en el tipo. */
    if (Array.isArray(leido)) {
      cola = leido.filter(
        (e): e is EventoEnCola =>
          !!e && typeof e === 'object'
          && typeof (e as EventoEnCola).event_id === 'string'
          && typeof (e as EventoEnCola).event_name === 'string',
      );
    }
  } catch {
    /* JSON corrupto. Se empieza de cero y la app ni se entera: perder analítica
       es aceptable, dejar de arrancar no. */
    cola = [];
    try { window.localStorage.removeItem(CLAVE); } catch { /* ni eso importa */ }
  }
}

function volcar(): void {
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(cola));
  } catch {
    /* Cupo lleno o almacenamiento bloqueado. Se recorta a la mitad y se
       reintenta una vez: mejor media cola que ninguna, y sobre todo mejor que
       dejar el almacenamiento lleno para el estado de la app. */
    const antes = cola.length;
    cola = cola.slice(Math.floor(cola.length / 2));
    descartados += antes - cola.length;
    try { window.localStorage.setItem(CLAVE, JSON.stringify(cola)); } catch { /* se deja */ }
  }
}

/** Agrupado: 40 casillas marcadas seguidas escriben disco una vez, no 40. */
function pedirVolcado(): void {
  if (volcadoPendiente) return;
  volcadoPendiente = setTimeout(() => {
    volcadoPendiente = null;
    volcar();
  }, 400);
}

export function encolar(evento: EventoEnCola): void {
  cargar();
  cola.push(evento);
  if (cola.length > MAXIMO) {
    descartados += cola.length - MAXIMO;
    cola = cola.slice(cola.length - MAXIMO);
  }
  pedirVolcado();
}

/** Los `n` primeros, sin sacarlos: solo se sacan si el envío confirma. */
export function asomar(n: number): EventoEnCola[] {
  cargar();
  return cola.slice(0, n);
}

/** Fuera los que el servidor ya tiene. Por `event_id`, no por posición: entre
    el asomar y el confirmar pueden haber entrado eventos nuevos. */
export function confirmar(ids: string[]): void {
  cargar();
  const fuera = new Set(ids);
  cola = cola.filter((e) => !fuera.has(e.event_id));
  volcar();
  if (volcadoPendiente) { clearTimeout(volcadoPendiente); volcadoPendiente = null; }
}

export function cuantosHay(): number {
  cargar();
  return cola.length;
}

export function cuantosDescartados(): number {
  return descartados;
}

/** Solo para tests: vuelve al estado de app recién instalada. */
export function _reiniciarCola(): void {
  cola = [];
  cargada = false;
  descartados = 0;
  if (volcadoPendiente) { clearTimeout(volcadoPendiente); volcadoPendiente = null; }
  try { window.localStorage.removeItem(CLAVE); } catch { /* da igual */ }
}

/** Solo para tests: fuerza el volcado sin esperar al agrupador. */
export function _volcarYa(): void {
  if (volcadoPendiente) { clearTimeout(volcadoPendiente); volcadoPendiente = null; }
  volcar();
}

export { CLAVE as CLAVE_COLA, MAXIMO as MAXIMO_COLA };
