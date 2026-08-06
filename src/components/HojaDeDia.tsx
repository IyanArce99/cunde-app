import { numComensales } from '../state/types';
import type { Comensales, Plato, Ranura } from '../state/types';
import { eur } from '../lib/format';
import { nombreRanura } from '../lib/menu';
import type { Retoque } from '../data/motor';
import BottomSheet from './BottomSheet';
import FotoPlato from './FotoPlato';
import TicketRow from './TicketRow';
import AvisoAlergenos from './AvisoAlergenos';
import './HojaDeDia.css';

interface HojaDeDiaProps {
  /** El hueco concreto al que se aplican las tres acciones. */
  dia: string;
  ranura: Ranura;
  plato: Plato | null;
  comensales: Comensales;
  /** Para el aviso de alérgenos. Ver AvisoAlergenos. */
  exclusiones: string[];
  onRetocar: (retoque: Retoque) => void;
  onVerReceta: () => void;
  onCerrar: () => void;
}

function tiempoDe(plato: Plato | null): string {
  if (!plato) return 'no cocinas';
  if (plato.tipo === 'sobras') return 'solo calentar';
  if (plato.tipo === 'ensamblaje') return `${plato.minutos} min`;
  return `${plato.minutos} min`;
}

const HojaDeDia: React.FC<HojaDeDiaProps> = ({
  dia, ranura, plato, comensales, exclusiones, onRetocar, onVerReceta, onCerrar,
}) => {
  const n = numComensales(comensales);
  const costeHueco = (plato?.precioRacion ?? 0) * n;
  const esSobras = plato?.tipo === 'sobras' || plato?.tipo === 'ensamblaje';

  return (
    <BottomSheet onDismiss={onCerrar}>
      <div className="hoja-dia__cabecera">
        <span className="hoja-dia__titulo">
          {dia} · {nombreRanura(ranura).toUpperCase()} · {(plato?.nombre ?? 'Libre').toUpperCase()}
        </span>
        <button className="hoja-dia__cerrar" type="button" onClick={onCerrar} aria-label="Cerrar">
          ✕
        </button>
      </div>

      {/* La foto va DESPUÉS de la cabecera y ANTES de las cuentas: primero qué
          plato es, luego cómo es, luego cuánto cuesta. Si no hay foto no se
          pinta nada y la hoja simplemente es más corta. */}
      <FotoPlato foto={plato?.foto} alt={plato?.nombre ?? ''} />

      {/* Los DOS precios, y dichos. En la lista de la semana el plato pone
          0,98 € —la ración— y aquí ponía 1,96 € sin más aviso que un "2
          raciones" en la etiqueta: dos cifras distintas para el mismo plato en
          dos pantallas seguidas, y la de dentro el doble que la de fuera. El
          usuario que las ve no piensa "una es por ración", piensa que una de
          las dos está mal — y en una app cuya tesis es la cifra, eso se paga
          en todos los demás números. */}
      <TicketRow
        label={`${tiempoDe(plato)} · ${eur(plato?.precioRacion ?? 0)} la ración`}
        value={n === 1 ? eur(costeHueco) : `${eur(costeHueco)} las ${n}`}
        size={15}
      />

      {esSobras && (
        <p className="hoja-dia__aviso">
          {plato?.desde
            ? `Este plato sale de ${plato.desde.toLowerCase()}, que cocinas antes. Solo compras lo que se le añade.`
            : 'Este hueco lo cubre lo que cocinas antes. Si lo cambias, recoloco esa tanda.'}
        </p>
      )}

      {!!plato?.omitidos?.length && (
        <p className="hoja-dia__aviso">
          Lo hago sin {plato.omitidos.join(' ni ').toLowerCase()}: no encaja con lo que has quitado. El plato
          funciona igual.
        </p>
      )}

      <div className="hoja-dia__acciones">
        <button className="hoja-dia__accion" type="button" onClick={() => onRetocar('cambiar')}>
          <span className="hoja-dia__icono">↻</span>
          <span className="hoja-dia__texto">
            <span className="hoja-dia__accion-titulo">Cambiar plato</span>
            <span className="hoja-dia__accion-subtitulo">otro reparto desde aquí</span>
          </span>
        </button>

        <button className="hoja-dia__accion" type="button" onClick={() => onRetocar('barato')}>
          <span className="hoja-dia__icono">↓</span>
          <span className="hoja-dia__texto">
            <span className="hoja-dia__accion-titulo">Bájame el precio</span>
            <span className="hoja-dia__accion-subtitulo">lo más barato de aquí al domingo</span>
          </span>
        </button>

        <button className="hoja-dia__accion" type="button" onClick={() => onRetocar('libre')}>
          <span className="hoja-dia__icono">✕</span>
          <span className="hoja-dia__texto">
            <span className="hoja-dia__accion-titulo">Esta {nombreRanura(ranura)} no cocino</span>
            <span className="hoja-dia__accion-subtitulo">reorganizo la semana</span>
          </span>
        </button>
      </div>

      {plato?.tipo === 'cocinado' && (
        <div className="hoja-dia__ver-receta">
          <a className="salida-texto" href="#!" onClick={(e) => { e.preventDefault(); onVerReceta(); }}>
            Ver receta
          </a>
        </div>
      )}

      <AvisoAlergenos exclusiones={exclusiones} compacto />
    </BottomSheet>
  );
};

export default HojaDeDia;
