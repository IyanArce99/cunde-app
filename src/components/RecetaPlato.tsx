import { numComensales } from '../state/types';
import type { Comensales, Plato } from '../state/types';
import { datos } from '../data/motor';
import BottomSheet from './BottomSheet';
import AvisoAlergenos from './AvisoAlergenos';
import FotoPlato from './FotoPlato';
import './RecetaPlato.css';

interface RecetaPlatoProps {
  plato: Plato;
  /** El día ya no vive dentro del plato: un plato puede ocupar varios huecos. */
  dia: string;
  comensales: Comensales;
  /** Para el aviso de alérgenos. Ver AvisoAlergenos. */
  exclusiones: string[];
  onCerrar: () => void;
}

const RecetaPlato: React.FC<RecetaPlatoProps> = ({ plato, dia, comensales, exclusiones, onCerrar }) => {
  const n = numComensales(comensales);
  // Los pasos viven en la propia receta (docs/recetas-piloto.json y
  // docs/recetas/lote-*.json), no en un fichero aparte de la app. Un
  // ensamblaje tiene los suyos: montar el plato con la tanda de ayer no se
  // parece en nada a cocinarlo de cero (ver docs/ensamblajes.json).
  const pasos = plato.desde
    ? Object.values(datos.ensamblajes ?? {}).flat().find((e) => e.nombre === plato.nombre)?.pasos
    : datos.recetas.find((r) => r.nombre === plato.nombre)?.pasos;

  return (
    <BottomSheet onDismiss={onCerrar}>
      <div className="receta__cabecera">
        <span className="receta__titulo">
          {dia} · {plato.nombre.toUpperCase()}
        </span>
        <button className="receta__cerrar" type="button" onClick={onCerrar} aria-label="Cerrar">
          ✕
        </button>
      </div>
      <span className="receta__meta">
        {plato.minutos} min · {n} {n === 1 ? 'ración' : 'raciones'}
      </span>

      {/* Encima de los pasos: aquí estás cocinando y quieres ver a qué apuntas.
          Sin foto, la ficha empieza directamente por el paso 1. */}
      <FotoPlato foto={plato.foto} alt={plato.nombre} />

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

      <AvisoAlergenos exclusiones={exclusiones} compacto />
    </BottomSheet>
  );
};

export default RecetaPlato;
