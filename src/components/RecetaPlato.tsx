import { numComensales } from '../state/types';
import type { Comensales, Plato } from '../state/types';
import { recetasPorPlato } from '../data/mockRecetas';
import BottomSheet from './BottomSheet';
import './RecetaPlato.css';

interface RecetaPlatoProps {
  plato: Plato;
  comensales: Comensales;
  onCerrar: () => void;
}

const RecetaPlato: React.FC<RecetaPlatoProps> = ({ plato, comensales, onCerrar }) => {
  const n = numComensales(comensales);
  const pasos = recetasPorPlato[plato.nombre];

  return (
    <BottomSheet onDismiss={onCerrar}>
      <div className="receta__cabecera">
        <span className="receta__titulo">
          {plato.dia} · {plato.nombre.toUpperCase()}
        </span>
        <button className="receta__cerrar" type="button" onClick={onCerrar} aria-label="Cerrar">
          ✕
        </button>
      </div>
      <span className="receta__meta">
        {plato.minutos} min · {n} {n === 1 ? 'ración' : 'raciones'}
      </span>

      {pasos ? (
        <ol className="receta__pasos">
          {pasos.map((paso, i) => (
            <li key={i} className="receta__paso">
              <span className="receta__paso-numero">{i + 1}</span>
              <span className="receta__paso-texto">{paso}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="receta__sin-datos">Todavía no tengo la receta de este plato.</p>
      )}
    </BottomSheet>
  );
};

export default RecetaPlato;
