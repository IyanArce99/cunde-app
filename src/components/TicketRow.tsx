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
    </Componente>
  );
};

export default TicketRow;
