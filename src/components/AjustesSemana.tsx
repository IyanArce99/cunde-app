import { useState } from 'react';
import type { ComidasPref, Esfuerzo, Preferencias } from '../state/types';
import PrimaryButton from './PrimaryButton';
import BottomSheet from './BottomSheet';
import './AjustesSemana.css';

const OPCIONES_COMIDAS: { valor: ComidasPref; label: string; meta: string }[] = [
  { valor: 'comidas', label: 'Comidas', meta: '7 platos' },
  { valor: 'cenas', label: 'Cenas', meta: '7 platos' },
  { valor: 'ambas', label: 'Las dos', meta: '14 platos' },
];

const OPCIONES_ESFUERZO: { valor: Esfuerzo; label: string; sub: string }[] = [
  { valor: 'minimo', label: 'Lo mínimo', sub: 'menos de 20 min' },
  { valor: 'normal', label: 'Lo normal', sub: '30 a 40 min' },
  { valor: 'libre', label: 'Me gusta cocinar', sub: 'sin límite' },
];

const DIETAS = ['Cerdo', 'Pescado', 'Marisco', 'Lactosa', 'Gluten', 'Vegetariano', 'Vegano'];

interface AjustesSemanaProps {
  preferenciasActuales: Preferencias;
  origen: 'exclusiones' | 'sobrante';
  onGuardar: (preferencias: Preferencias) => void;
  onCerrar: () => void;
}

const AjustesSemana: React.FC<AjustesSemanaProps> = ({ preferenciasActuales, origen, onGuardar, onCerrar }) => {
  const [comidas, setComidas] = useState(preferenciasActuales.comidas);
  const [esfuerzo, setEsfuerzo] = useState(preferenciasActuales.esfuerzo);
  const [exclusiones, setExclusiones] = useState(preferenciasActuales.exclusiones);

  const alternarDieta = (dieta: string) => {
    setExclusiones((actual) =>
      actual.includes(dieta) ? actual.filter((d) => d !== dieta) : actual.concat(dieta),
    );
  };

  return (
    <BottomSheet onDismiss={onCerrar}>
      <span className="ajustes__etiqueta">AJUSTES DE LA SEMANA</span>

      <h2 className="ajustes__pregunta">¿Qué resuelvo?</h2>
      <div className="ajustes__fila-pill">
        {OPCIONES_COMIDAS.map((o) => (
          <button
            key={o.valor}
            type="button"
            className={`ajustes__pill${comidas === o.valor ? ' ajustes__pill--seleccionado' : ''}`}
            onClick={() => setComidas(o.valor)}
          >
            <span className="ajustes__pill-label">{o.label}</span>
            <span className="ajustes__pill-meta">{o.meta}</span>
          </button>
        ))}
      </div>

      <h2 className="ajustes__pregunta">¿Cuánto quieres cocinar?</h2>
      <div className="ajustes__lista-bloque">
        {OPCIONES_ESFUERZO.map((o) => (
          <button
            key={o.valor}
            type="button"
            className={`ajustes__bloque${esfuerzo === o.valor ? ' ajustes__bloque--seleccionado' : ''}`}
            onClick={() => setEsfuerzo(o.valor)}
          >
            <span className="ajustes__bloque-label">{o.label}</span>
            <span className="ajustes__bloque-sub">{o.sub}</span>
          </button>
        ))}
      </div>

      <h2 className="ajustes__pregunta">¿Algo que no comes?</h2>
      <button
        type="button"
        className={`ajustes__pill ajustes__pill--ancho${exclusiones.length === 0 ? ' ajustes__pill--seleccionado' : ''}`}
        onClick={() => setExclusiones([])}
      >
        <span className="ajustes__pill-label">Nada, como de todo</span>
      </button>
      <div className="ajustes__chips">
        {DIETAS.map((dieta) => (
          <button
            key={dieta}
            type="button"
            className={`ajustes__chip${exclusiones.includes(dieta) ? ' ajustes__chip--seleccionado' : ''}`}
            onClick={() => alternarDieta(dieta)}
          >
            {dieta}
          </button>
        ))}
      </div>

      {origen === 'sobrante' && (
        <p className="ajustes__nota">
          Esto no cambia la semana que ya tienes delante: se aplica a partir de la próxima.
        </p>
      )}

      <PrimaryButton onClick={() => onGuardar({ comidas, esfuerzo, exclusiones })}>Guardar ajustes</PrimaryButton>
    </BottomSheet>
  );
};

export default AjustesSemana;
