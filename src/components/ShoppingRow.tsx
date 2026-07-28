import { memo } from 'react';
import type { ItemLista } from '../state/types';
import { eur } from '../lib/format';
import TicketRow from './TicketRow';
import './ShoppingRow.css';

interface ShoppingRowProps {
  item: ItemLista;
  onToggle: (id: string) => void;
}

const ShoppingRow: React.FC<ShoppingRowProps> = ({ item, onToggle }) => {
  return (
    <button className="fila-producto" onClick={() => onToggle(item.id)} type="button">
      <span className={`fila-producto__caja${item.marcado ? ' fila-producto__caja--marcada' : ''}`}>
        {item.marcado ? '✓' : ''}
      </span>
      <div className="fila-producto__contenido">
        <div className="fila-producto__linea1">
          <span className={`fila-producto__nombre${item.marcado ? ' fila-producto__nombre--marcado' : ''}`}>
            {item.nombre}
          </span>
          {item.procedenciaPrecio && <span className="fila-producto__etiqueta">{item.procedenciaPrecio}</span>}
        </div>
        <div className={`fila-producto__linea2${item.marcado ? ' fila-producto__linea2--marcado' : ''}`}>
          <TicketRow label={item.formatoVenta} value={eur(item.precio)} size={15} />
        </div>
        {item.paraPlato && <div className="fila-producto__linea3">para: {item.paraPlato}</div>}
      </div>
    </button>
  );
};

export default memo(ShoppingRow);
