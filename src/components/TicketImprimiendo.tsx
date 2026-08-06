import './TicketImprimiendo.css';

/**
 * LA IMPRESORA SACANDO EL TICKET.
 *
 * Es el estado de carga de la pantalla Generando, no un adorno: son ~2,2 s
 * mirando una pantalla y esto es lo único que hay que mirar. Las otras dos
 * viñetas del onboarding se quitaron por eso mismo — al lado de una pregunta
 * que se explica sola, un pictograma es decoración.
 *
 * VA EN LÍNEA Y NO COMO MÁSCARA. El componente Vineta mete el SVG con
 * `mask: url(...)`, y dentro de una máscara el navegador pinta el SVG como
 * imagen estática: las animaciones no corren. Para que el papel salga hay que
 * tener los nodos en el DOM.
 *
 * CÓMO SE ANIMA, y por qué así:
 *   · El papel está dibujado a su largo completo desde el principio y lo que
 *     se mueve es un `translateY` bajo un `clipPath` que empieza en la ranura.
 *     Es la única forma de que "salga" sin animar `height`, que es lo que
 *     prohíbe el proyecto — en WebView de Android animar la geometría cuesta
 *     un repintado por fotograma.
 *   · Las tres líneas impresas van montadas en el papel, así que aparecen
 *     solas según asoma. No hay que animarlas por separado.
 *   · El bucle corta con `opacity` en el último tramo: es el gesto de arrancar
 *     el ticket. El salto de vuelta ocurre con el papel ya dentro de la
 *     ranura, tapado por el recorte, así que no se ve.
 *   · Con `prefers-reduced-motion` no se mueve nada y se ve el ticket entero,
 *     que sigue diciendo lo mismo.
 *
 * `currentColor` en el trazo: el color lo pone el contenedor, así que el mismo
 * dibujo sirve sobre papel y sobre crema sin dos versiones que desincronizar.
 */
const TicketImprimiendo: React.FC = () => (
  <svg
    className="imprimiendo"
    viewBox="0 0 120 120"
    fill="none"
    stroke="currentColor"
    strokeWidth="6"
    strokeLinecap="butt"
    strokeLinejoin="miter"
    aria-hidden="true"
  >
    <defs>
      {/* Todo lo que quede por encima de la ranura no se pinta: es lo que hace
          que el papel parezca salir de dentro de la máquina. */}
      <clipPath id="ranura">
        <rect x="0" y="39" width="120" height="81" />
      </clipPath>
    </defs>

    <g className="imprimiendo__papel" clipPath="url(#ranura)">
      <path d="M30 40 H90 V96 L82 104 L74 96 L66 104 L58 96 L50 104 L42 96 L34 104 L30 100 Z" />
      <path d="M42 58 H78" />
      <path d="M42 72 H78" />
      <path d="M42 86 H78" strokeDasharray="7 9" />
    </g>

    {/* La máquina va DESPUÉS del papel para taparlo en la ranura. */}
    <path d="M14 14 H106 V38 H14 Z" />
    <path d="M28 38 H92" />
  </svg>
);

export default TicketImprimiendo;
