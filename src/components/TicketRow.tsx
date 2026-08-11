import type { ReactNode } from 'react';
import './TicketRow.css';

interface TicketRowProps {
  label: ReactNode;
  value: ReactNode;
  size?: 13 | 15;
  /** Tiñe la fila entera. Para cuando lo excepcional es la fila, no el dato. */
  color?: string;
  /**
   * Tiñe SOLO el importe.
   *
   * Es lo que quiere casi siempre una línea de ticket: el concepto es un
   * rótulo —"Diferencia" no es ni buena ni mala noticia— y lo que se sale de
   * lo normal es la cifra. Pintando la fila entera, "Diferencia" en rojo se
   * lee como que el concepto es el problema, y encima el rótulo pierde su
   * gris de reposo y empieza a competir con la cifra que tiene al lado.
   */
  colorValor?: string;
  onClick?: () => void;
}

const TicketRow: React.FC<TicketRowProps> = ({ label, value, size = 13, color, colorValor, onClick }) => {
  const Componente = onClick ? 'button' : 'div';
  return (
    <Componente
      className="ticket-row"
      style={{ fontSize: size, color, cursor: onClick ? 'pointer' : undefined }}
      onClick={onClick}
    >
      <span className="ticket-row__label">{label}</span>
      <span className="ticket-row__leader" />
      <span className="ticket-row__value" style={colorValor ? { color: colorValor } : undefined}>{value}</span>
      {/* La flecha la pone el componente, no quien lo usa. Estaba escrita a
          mano dentro del `value` de la fila del súper —`${cadena} ›`—, que es
          una convención que solo conoce esa línea: en cuanto hay tres filas
          pulsables, una se queda sin flecha y nadie se entera. aria-hidden
          porque para un lector de pantalla ya es un botón. */}
      {onClick && <span className="ticket-row__flecha" aria-hidden="true">›</span>}
    </Componente>
  );
};

export default TicketRow;
