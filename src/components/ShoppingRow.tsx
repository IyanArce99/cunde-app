import { memo } from 'react';
import type { ItemLista } from '../state/types';
import { eur } from '../lib/format';
import TicketRow from './TicketRow';
import './ShoppingRow.css';

interface ShoppingRowProps {
  item: ItemLista;
  onToggle: (id: string) => void;
  onToggleLoTengo: (id: string) => void;
}

/**
 * Dos estados independientes, dos controles. `loTengo` (solo despensa)
 * decide si el producto entra en el total; `enElCarro` es el marcado normal
 * de la lista. Un único control con sentido invertido se rompía en la
 * tienda: al desmarcar el aceite porque falta, no quedaba forma de marcarlo
 * cuando se echa al carro.
 *
 * Mientras "ya lo tengo" esté puesto, el producto no cuenta y no se puede
 * meter en el carro: no hay nada que coger.
 */
const ShoppingRow: React.FC<ShoppingRowProps> = ({ item, onToggle, onToggleLoTengo }) => {
  // Dos motivos distintos para dar un producto por hecho —despensa declarada
  // (aceite, sal) o sobrante de la semana pasada— y el mismo gesto para
  // corregirlo: en el súper, con una mano, no puede haber dos controles
  // distintos que signifiquen "esto no lo tengo".
  const seDaPorHecho = !!item.esDespensa || !!item.yaEnCasa;
  const esDespensa = !!item.esDespensa;
  const loTengo = item.loTengo !== false;
  const fueraDeCuentas = seDaPorHecho && loTengo;
  const marcado = item.enElCarro && !fueraDeCuentas;

  return (
    <div className={`fila-producto${fueraDeCuentas ? ' fila-producto--fuera' : ''}`}>
      <button
        className="fila-producto__principal"
        onClick={() => onToggle(item.id)}
        disabled={fueraDeCuentas}
        type="button"
      >
        {/* La casilla de "lo llevo en el carro" solo se pinta si hay algo que
            coger. Mientras el producto se da por hecho, la fila tenía DOS
            casillas y la de la izquierda no hacía nada: al quitar la marca el
            producto se va a su pasillo, así que ahí nunca llega a servir.
            Dos controles y uno muerto, en la pantalla que se usa de pie y con
            una mano, es exactamente lo que no puede haber. */}
        {!fueraDeCuentas && (
          <span className={`fila-producto__caja${marcado ? ' fila-producto__caja--marcada' : ''}`}>
            {marcado ? '✓' : ''}
          </span>
        )}
        <span className="fila-producto__contenido">
          <span className="fila-producto__linea1">
            <span className={`fila-producto__nombre${marcado ? ' fila-producto__nombre--marcado' : ''}`}>
              {item.nombre}
            </span>
            {item.procedenciaPrecio && !esDespensa && (
              <span className="fila-producto__etiqueta">{item.procedenciaPrecio}</span>
            )}
            {/* Pendiente de comprobar con su etiqueta que es ese ingrediente. No
                se presenta como verificado; con una alergia, la app ya no lo usa
                si además no se sabe qué alérgenos lleva. */}
            {item.sinVerificar && (
              <span className="fila-producto__etiqueta" title="Aún no hemos comprobado con su etiqueta que sea este producto">sin verificar</span>
            )}
          </span>
          <span className={`fila-producto__linea2${marcado ? ' fila-producto__linea2--marcado' : ''}`}>
            <TicketRow label={item.formatoVenta} value={eur(item.precio)} size={15} />
          </span>
          {item.paraPlato && <span className="fila-producto__linea3">para: {item.paraPlato}</span>}
        </span>
      </button>

      {seDaPorHecho && (
        <button
          className="fila-producto__tengo"
          type="button"
          aria-pressed={loTengo}
          onClick={() => onToggleLoTengo(item.id)}
        >
          <span className={`fila-producto__caja${loTengo ? ' fila-producto__caja--marcada' : ''}`}>
            {loTengo ? '✓' : ''}
          </span>
          <span className="fila-producto__tengo-texto">
            ya lo
            <br />
            tengo
          </span>
        </button>
      )}
    </div>
  );
};

export default memo(ShoppingRow);
