import { numComensales } from '../state/types';
import type { Comensales, Plato } from '../state/types';
import { eur } from '../lib/format';
import { otroPlatoParecido, platoMasBarato } from '../lib/menu';
import BottomSheet from './BottomSheet';
import TicketRow from './TicketRow';
import './HojaDeDia.css';

interface HojaDeDiaProps {
  plato: Plato;
  comensales: Comensales;
  semanaActual: Plato[];
  onCambiarPlato: () => void;
  onBajarPrecio: () => void;
  onNoCocino: () => void;
  onVerReceta: () => void;
  onCerrar: () => void;
}

const HojaDeDia: React.FC<HojaDeDiaProps> = ({
  plato,
  comensales,
  semanaActual,
  onCambiarPlato,
  onBajarPrecio,
  onNoCocino,
  onVerReceta,
  onCerrar,
}) => {
  const n = numComensales(comensales);
  const costeDia = plato.precioRacion * n;
  const barato = platoMasBarato(semanaActual, plato);
  const ahorro = barato ? (plato.precioRacion - barato.precioRacion) * n : 0;
  // Solo para saber si queda alguna opción (null cuando el pool está agotado);
  // el plato concreto que devuelve es al azar y se descarta aquí a propósito.
  const hayParecido = otroPlatoParecido(semanaActual, plato) !== null;

  return (
    <BottomSheet onDismiss={onCerrar}>
      <div className="hoja-dia__cabecera">
        <span className="hoja-dia__titulo">
          {plato.dia} · {plato.nombre.toUpperCase()}
        </span>
        <button className="hoja-dia__cerrar" type="button" onClick={onCerrar} aria-label="Cerrar">
          ✕
        </button>
      </div>

      <TicketRow
        label={`${plato.minutos} min · ${n} ${n === 1 ? 'ración' : 'raciones'}`}
        value={eur(costeDia)}
        size={15}
      />

      <div className="hoja-dia__acciones">
        <button className="hoja-dia__accion" type="button" disabled={!hayParecido} onClick={onCambiarPlato}>
          <span className="hoja-dia__icono">↻</span>
          <span className="hoja-dia__texto">
            <span className="hoja-dia__accion-titulo">Cambiar plato</span>
            <span className="hoja-dia__accion-subtitulo">
              {hayParecido ? 'otro de parecido esfuerzo' : 'no me quedan más opciones esta semana'}
            </span>
          </span>
        </button>

        <button className="hoja-dia__accion" type="button" disabled={!barato} onClick={onBajarPrecio}>
          <span className="hoja-dia__icono">↓</span>
          <span className="hoja-dia__texto">
            <span className="hoja-dia__accion-titulo">Bájame el precio</span>
            <span className="hoja-dia__accion-subtitulo">
              {barato ? `−${eur(ahorro)} aprox.` : 'ya es la opción más barata esta semana'}
            </span>
          </span>
        </button>

        <button className="hoja-dia__accion" type="button" onClick={onNoCocino}>
          <span className="hoja-dia__icono">✕</span>
          <span className="hoja-dia__texto">
            <span className="hoja-dia__accion-titulo">Este día no cocino</span>
            <span className="hoja-dia__accion-subtitulo">reorganizo la semana</span>
          </span>
        </button>
      </div>

      <div className="hoja-dia__ver-receta">
        <a href="#!" onClick={(e) => { e.preventDefault(); onVerReceta(); }}>
          Ver receta
        </a>
      </div>
    </BottomSheet>
  );
};

export default HojaDeDia;
