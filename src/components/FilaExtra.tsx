import { memo, useCallback } from 'react';
import { eur } from '../lib/format';
import type { ExtraCompra } from '../lib/extras';
import './FilaExtra.css';

interface FilaExtraProps {
  extra: ExtraCompra;
  onMarcar: (id: string) => void;
  onAbrir: (id: string) => void;
}

/**
 * ═══ UNA COSA QUE HAS AÑADIDO TÚ ═══
 *
 * ═══ POR QUÉ NO ES `ShoppingRow` ═══
 *
 * `ShoppingRow` está atado a `ItemLista`, que es lo que devuelve el motor:
 * pasillo, formato de venta, `paraPlato`, `esDespensa`, `loTengo`,
 * `procedenciaPrecio`, peso variable. Un café no tiene ninguna de esas siete
 * cosas. Meterlo ahí habría sido añadirle a la fila más caliente de la app
 * —25-40 filas que se repintan al marcar— un puñado de condicionales para un
 * caso que no comparte ni un solo campo.
 *
 * Lo que sí se reutiliza es el SISTEMA VISUAL: la misma casilla
 * (`fila-producto__caja`), el mismo tachado al marcar, el mismo filete. Se
 * parecen porque se usan igual, no porque compartan código.
 *
 * ═══ DOS OBJETIVOS TÁCTILES, NO UNO ═══
 *
 * Tocar la fila MARCA, como en toda la pantalla. Editar y quitar viven detrás
 * de un botón propio a la derecha, con su área de 48 y su nombre accesible. Un
 * solo objetivo que hiciera las dos cosas —marcar con toque corto, abrir con
 * toque largo— sería un gesto invisible en la pantalla que se usa de pie, con
 * una mano y empujando un carro.
 *
 * Memoizada como `ShoppingRow` y por lo mismo: marcar un producto no puede
 * repintar la lista entera.
 */
const FilaExtra: React.FC<FilaExtraProps> = ({ extra, onMarcar, onAbrir }) => {
  const marcar = useCallback(() => onMarcar(extra.id), [extra.id, onMarcar]);
  const abrir = useCallback(() => onAbrir(extra.id), [extra.id, onAbrir]);

  return (
    <div className="fila-extra">
      <button
        type="button"
        className="fila-extra__principal"
        role="checkbox"
        aria-checked={extra.marcado}
        onClick={marcar}
      >
        <span
          className={`fila-producto__caja${extra.marcado ? ' fila-producto__caja--marcada' : ''}`}
          aria-hidden="true"
        >
          {extra.marcado ? '✓' : ''}
        </span>
        <span className="fila-extra__texto">
          <span className={`fila-extra__nombre${extra.marcado ? ' fila-extra__nombre--marcado' : ''}`}>
            {extra.nombre}
          </span>
          {/**
            * ═══ «sin precio», NUNCA «0,00 €» ═══
            *
            * Un cero diría que el producto es gratis, y eso es falso: lo que
            * pasa es que nadie sabe todavía lo que cuesta. En una app cuya
            * única defensa es que sus números son verdad, inventar un cero
            * para no dejar el hueco vacío es exactamente lo que no se puede
            * hacer. En gris porque es la ausencia de un dato, no un dato.
            */}
          <span className={`fila-extra__precio${extra.precio === null ? ' fila-extra__precio--sin' : ''}`}>
            {extra.precio === null ? 'sin precio' : eur(extra.precio)}
          </span>
        </span>
      </button>

      {/* El nombre accesible lleva el del producto: con quince extras, quince
          botones que se anuncian «Editar» son quince botones idénticos. */}
      <button
        type="button"
        className="fila-extra__editar"
        aria-label={`Editar ${extra.nombre}`}
        onClick={abrir}
      >
        ···
      </button>
    </div>
  );
};

export default memo(FilaExtra);
