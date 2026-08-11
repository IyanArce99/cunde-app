import { eur } from '../lib/format';
import { filasDelTicket, porPersonaYComida, porcentajeDiferencia } from '../lib/compartible';
import type { DatosCompartibles } from '../lib/compartible';
import './TicketCompartible.css';

interface TicketCompartibleProps {
  datos: DatosCompartibles;
}

/**
 * ═══ LO QUE EL USUARIO VE ANTES DE COMPARTIR ═══
 *
 * HTML de verdad, no un `<img>` con el PNG.
 *
 * El PNG tarda en generarse y es un mapa de bits: no se puede leer con un
 * lector de pantalla, no se agranda con el tamaño de letra del sistema y en una
 * pantalla de 360 px sale borroso. Enseñarlo como previsualización obligaría a
 * generar la imagen para que el usuario pueda decidir si la quiere.
 *
 * Así, la previsualización aparece al instante y es texto. El PNG solo se
 * fabrica cuando ya ha dicho que sí.
 *
 * Que los dos digan lo mismo lo garantiza `filasDelTicket`: esto y el canvas
 * leen la MISMA lista.
 */
const TicketCompartible: React.FC<TicketCompartibleProps> = ({ datos }) => {
  const filas = filasDelTicket(datos);
  const unidad = datos.tipo === 'semana' ? porPersonaYComida(datos) : null;
  const pct = datos.tipo === 'resultado' ? porcentajeDiferencia(datos) : null;
  const personas = `${datos.personas} ${datos.personas === 1 ? 'PERSONA' : 'PERSONAS'}`;

  return (
    /* `figure` y no `div`: es una unidad de contenido con su pie. Y sin
       `aria-hidden`: esto ES la previsualización, y quien no ve la pantalla
       tiene el mismo derecho a saber qué va a mandar por WhatsApp. */
    <figure className="compartible">
      <span className="compartible__marca">cunde</span>

      <div className="compartible__cabecera">
        <span className="compartible__rotulo">
          {[datos.supermercado.toUpperCase(), datos.rango].filter(Boolean).join(' · ')}
        </span>
        <span className="compartible__rotulo">{personas} · {datos.comidas} COMIDAS</span>
      </div>

      <dl className="compartible__filas">
        {filas.map((f, i) => {
          if (f.clase === 'hueco') return <div key={i} className="compartible__hueco" />;
          if (f.clase === 'nota') return <p key={i} className="compartible__nota">{f.texto}</p>;
          const total = f.clase === 'total';
          return (
            /* `dt`/`dd` sueltos dentro de un `div`: es lo que hace que un
               lector de pantalla lea «concepto, importe» en pareja en vez de
               once etiquetas seguidas y después once cifras. */
            <div
              key={i}
              className={`compartible__fila${total ? ' compartible__fila--total' : ''}${
                total && f.color === 'roja' ? ' compartible__fila--roja' : ''
              }`}
            >
              <dt className="compartible__etiqueta">{f.etiqueta}</dt>
              <dd className={`compartible__valor${'fuerte' in f && f.fuerte ? ' compartible__valor--fuerte' : ''}`}>
                {f.valor}
              </dd>
            </div>
          );
        })}
      </dl>

      {/* La cifra grande. Aquí también es lo mayor de la tarjeta: la regla no
          cambia porque el sitio sea pequeño. */}
      {unidad !== null && (
        <div className="compartible__unidad">
          <span className="compartible__cifra">{eur(unidad)}</span>
          <span className="compartible__rotulo">POR PERSONA Y COMIDA</span>
        </div>
      )}
      {pct !== null && (
        <div className="compartible__unidad">
          <span className="compartible__cifra">{pct.toFixed(1).replace('.', ',')}%</span>
          <span className="compartible__rotulo">DE DIFERENCIA</span>
        </div>
      )}

      <figcaption className="compartible__pie">Hecho con Cunde</figcaption>
    </figure>
  );
};

export default TicketCompartible;
