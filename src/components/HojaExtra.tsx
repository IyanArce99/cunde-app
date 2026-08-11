import { useState } from 'react';
import BottomSheet from './BottomSheet';
import PrimaryButton from './PrimaryButton';
import { leerPrecio } from '../lib/extras';
import type { ExtraCompra } from '../lib/extras';
import './HojaExtra.css';

interface HojaExtraProps {
  /** El que se edita. `null` para añadir uno nuevo. */
  extra: ExtraCompra | null;
  onAnadir: (nombre: string, precio: number | null) => void;
  onPrecio: (id: string, precio: number | null) => void;
  onQuitar: (id: string) => void;
  onCerrar: () => void;
}

/**
 * ═══ AÑADIR A LA COMPRA · Y CORREGIR LO AÑADIDO ═══
 *
 * Una sola hoja para las dos cosas. Son la misma pregunta —qué es y cuánto
 * cuesta— hecha en dos momentos: el domingo en el sofá, cuando muchas veces no
 * se sabe el precio, y el martes delante del lineal, cuando ya se ve.
 *
 * Dos hojas casi idénticas habrían sido dos sitios donde arreglar el mismo
 * fallo, y el usuario no distingue entre "añadir" y "corregir": para él es
 * apuntar una cosa que le falta.
 *
 * ═══ EL PRECIO NO ES OBLIGATORIO, Y ES LO IMPORTANTE ═══
 *
 * Sin eso, esta funcionalidad no sirve para lo que se usa de verdad: acordarse
 * de que hace falta café. Obligar a poner un precio que no se sabe empuja a
 * inventarlo, y un número inventado en una app que se vende por sus números es
 * peor que no tener el producto apuntado.
 */
const HojaExtra: React.FC<HojaExtraProps> = ({ extra, onAnadir, onPrecio, onQuitar, onCerrar }) => {
  const editando = extra !== null;
  const [nombre, setNombre] = useState(extra?.nombre ?? '');
  const [precio, setPrecio] = useState(extra?.precio === null || extra === null ? '' : String(extra.precio).replace('.', ','));

  const leido = leerPrecio(precio);
  const precioMalo = leido === undefined;
  const puedeGuardar = editando ? !precioMalo : nombre.trim() !== '' && !precioMalo;

  const guardar = () => {
    if (!puedeGuardar) return;
    if (editando) onPrecio(extra.id, leido ?? null);
    else onAnadir(nombre, leido ?? null);
    onCerrar();
  };

  return (
    <BottomSheet onDismiss={onCerrar}>
      <div className="ajustes__cabecera">
        <span className="ajustes__titulo">{editando ? 'CORREGIR' : 'AÑADIR A LA COMPRA'}</span>
        <button type="button" className="ajustes__cerrar" aria-label="Cerrar" onClick={onCerrar}>
          ✕
        </button>
      </div>

      <label className="extra__campo">
        <span className="extra__rotulo">Qué es</span>
        {/**
          * El nombre no se edita al corregir: la V1 resuelve precio y quitar,
          * que es lo que se corrige de verdad delante del lineal. Quien se
          * equivocó de nombre lo quita y lo vuelve a apuntar — dos toques, y
          * sin un campo más que mantener.
          */}
        <input
          className="extra__input"
          type="text"
          value={nombre}
          readOnly={editando}
          autoFocus={!editando}
          placeholder="Café"
          aria-label="Qué es"
          enterKeyHint="done"
          onChange={(e) => setNombre(e.target.value)}
        />
      </label>

      <label className="extra__campo">
        <span className="extra__rotulo">
          Cuánto cuesta
          {/* Dicho en el rótulo y no debajo: quien va a dejarlo en blanco tiene
              que saberlo ANTES de plantarse delante del campo vacío. */}
          <span className="extra__opcional"> · si lo sabes</span>
        </span>
        <div className={`extra__caja${precioMalo ? ' extra__caja--mal' : ''}`}>
          <input
            className="extra__input extra__input--precio"
            type="text"
            /* `decimal` y no `numeric`: en iOS, `numeric` da un teclado SIN
               separador decimal y no se puede escribir 3,45. */
            inputMode="decimal"
            value={precio}
            placeholder="3,45"
            aria-label="Cuánto cuesta, opcional"
            enterKeyHint="done"
            onChange={(e) => setPrecio(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') guardar(); }}
          />
          <span className="extra__moneda" aria-hidden="true">€</span>
        </div>
      </label>

      {precioMalo ? (
        <p className="extra__aviso" role="status">Eso no es un precio. Déjalo en blanco si no lo sabes.</p>
      ) : (
        <p className="extra__nota">
          {leido === null
            ? 'Sin precio no suma al total, pero lo llevas en la lista.'
            : 'Suma a los extras, no al coste del menú.'}
        </p>
      )}

      <PrimaryButton disabled={!puedeGuardar} onClick={guardar}>
        {editando ? 'Guardar' : 'Añadir a la compra'}
      </PrimaryButton>

      {editando && (
        /* Quitar vive aquí y no en la fila: en una lista que se recorre de pie
           empujando un carro, un botón de borrar por fila es un borrado
           accidental esperando a pasar. Dentro de la hoja hace falta abrirla a
           propósito. Y sin papelera: se dice lo que hace. */
        <div className="extra__salida">
          <button
            type="button"
            className="salida-texto"
            onClick={() => { onQuitar(extra.id); onCerrar(); }}
          >
            Quitar de la compra
          </button>
        </div>
      )}
    </BottomSheet>
  );
};

export default HojaExtra;
