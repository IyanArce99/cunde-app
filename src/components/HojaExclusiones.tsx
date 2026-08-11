import { useState } from 'react';
import BottomSheet from './BottomSheet';
import PrimaryButton from './PrimaryButton';
import SelectorExclusiones from './SelectorExclusiones';
import './AjustesSemana.css';

interface HojaExclusionesProps {
  valor: string[];
  onGuardar: (exclusiones: string[]) => void;
  onCerrar: () => void;
}

/**
 * QUÉ NO COMES, ANTES DE GENERAR.
 *
 * Las alergias salieron de la pantalla 2/3 porque quince chips la hacían la
 * única del embudo con scroll. Pero no podían acabar SOLO dentro de ajustes:
 * ahí se llega después de ver un menú, y un menú con marisco delante de alguien
 * con alergia al marisco ya ha fallado aunque se pueda corregir.
 *
 * Así que vuelven, pero detrás de una fila y no como una pregunta más: quien no
 * tiene ninguna restricción —la mayoría— no paga nada por ellas, y quien la
 * tiene la ve escrita en el pie antes de tocar "Ver mi semana".
 *
 * El estado es local hasta "Guardar": tocar un chip no puede rehacer la semana
 * a cada toque, y salirse a medias tiene que dejar las cosas como estaban.
 */
const HojaExclusiones: React.FC<HojaExclusionesProps> = ({ valor, onGuardar, onCerrar }) => {
  const [exclusiones, setExclusiones] = useState(valor);

  return (
    <BottomSheet onDismiss={onCerrar}>
      <div className="ajustes__cabecera">
        <span className="ajustes__titulo-hoja">¿Algo fuera del menú?</span>
        <button type="button" className="ajustes__cerrar" aria-label="Cerrar" onClick={onCerrar}>
          ✕
        </button>
      </div>

      <SelectorExclusiones valor={exclusiones} onCambiar={setExclusiones} />

      <PrimaryButton onClick={() => onGuardar(exclusiones)}>Guardar</PrimaryButton>
    </BottomSheet>
  );
};

export default HojaExclusiones;
