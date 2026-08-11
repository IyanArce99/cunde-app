import { IconoAspa, IconoFlechaAbajo, IconoLineas } from './Iconos';
import './TarjetaPlato.css';

/**
 * LA HOJA DEL DÍA: «¿no te convence un plato?».
 *
 * El −0,01 € de la alternativa es literal del handoff y conviene dejarlo.
 * Enseñar un ahorro ridículo dice la verdad sobre cómo funciona el motor —te
 * ofrece la alternativa aunque apenas cambie el precio, y te enseña cuánto es—
 * mejor que un −1,50 € inventado que prometería ahorros que no siempre existen.
 *
 * `aria-hidden`: ilustración. El texto que informa está en la columna de al lado.
 */
export default function TarjetaPlato() {
  return (
    <div className="plato" aria-hidden="true">
      <div className="plato__cabecera">
        <span>
          <span className="plato__cuando">DOM 16 · COMIDA</span>
          <span className="plato__nombre">Alubias al pimentón</span>
        </span>
        <span className="plato__cerrar">✕</span>
      </div>

      <div className="plato__precios">
        <span className="cifra">25 min · 0,93 € la ración</span>
        <span className="cifra">1,86 € las 2</span>
      </div>

      <div className="plato__seccion">
        <div className="plato__etiqueta">Cambiar por</div>
        <div className="plato__alternativa">
          <span>
            <span className="plato__alt-nombre">Lentejas salteadas</span>
            <span className="plato__alt-nota">15 min · cocinas</span>
          </span>
          <span className="plato__alt-precio">
            <span className="plato__alt-delta cifra">−0,01 €</span>
            <span className="plato__alt-unidad">por ración</span>
          </span>
        </div>
        <div className="plato__mas">Ver más platos ›</div>
      </div>

      <div className="plato__seccion">
        <div className="plato__etiqueta">¿Qué te parece este plato?</div>
        <div className="plato__valoracion">
          <div className="plato__voto">Me gusta</div>
          <div className="plato__voto plato__voto--activo">Está bien</div>
          <div className="plato__voto">No, gracias</div>
        </div>
        <div className="plato__acciones">
          <div className="plato__accion"><IconoFlechaAbajo /><span>Más barato</span></div>
          <div className="plato__accion"><IconoAspa /><span>No cocino</span></div>
          <div className="plato__accion"><IconoLineas /><span>Receta</span></div>
        </div>
      </div>
    </div>
  );
}
