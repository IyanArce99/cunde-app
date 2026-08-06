import type { ReactNode } from 'react';
import './TicketRow.css';

interface TicketRowProps {
  label: ReactNode;
  value: ReactNode;
  size?: 13 | 15;
  color?: string;
  onClick?: () => void;
}

const TicketRow: React.FC<TicketRowProps> = ({ label, value, size = 13, color, onClick }) => {
  const Componente = onClick ? 'button' : 'div';
  return (
    <Componente
      className="ticket-row"
      style={{ fontSize: size, color, cursor: onClick ? 'pointer' : undefined }}
      onClick={onClick}
    >
      <span className="ticket-row__label">{label}</span>
      <span className="ticket-row__leader" />
      <span className="ticket-row__value">{value}</span>
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
