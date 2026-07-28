import { useState } from 'react';
import { numComensales } from '../state/types';
import type { Comensales, Plato } from '../state/types';
import { totalPrevisto } from '../lib/derive';
import { eur, eurConSigno } from '../lib/format';
import { elegirDiaParaReorganizar, nombreDiaCompleto } from '../lib/menu';
import TicketRow from './TicketRow';
import PrimaryButton from './PrimaryButton';
import BottomSheet from './BottomSheet';
import './EsteDiaNoCocino.css';

interface EsteDiaNoCocinoProps {
  diaLibre: Plato;
  semanaActual: Plato[];
  comensales: Comensales;
  onHecho: (diaDestino: string, nuevoPlato: Omit<Plato, 'dia'>) => void;
  onDejarComoEsta: () => void;
}

const EsteDiaNoCocino: React.FC<EsteDiaNoCocinoProps> = ({
  diaLibre,
  semanaActual,
  comensales,
  onHecho,
  onDejarComoEsta,
}) => {
  const [reorg] = useState(() => elegirDiaParaReorganizar(semanaActual, diaLibre.dia));
  const n = numComensales(comensales);

  if (!reorg) {
    return (
      <BottomSheet onDismiss={onDejarComoEsta}>
        <p className="no-cocino__cuerpo">
          Ahora mismo no tengo con qué reorganizar la semana. Prueba desde otro día.
        </p>
        <PrimaryButton onClick={onDejarComoEsta}>Volver</PrimaryButton>
      </BottomSheet>
    );
  }

  const costeLibre = diaLibre.precioRacion * n;
  const costeAntiguo = reorg.diaDestino.precioRacion * n;
  const costeNuevo = reorg.nuevoPlato.precioRacion * n;
  const deltaDestino = costeNuevo - costeAntiguo;
  const totalNuevo = totalPrevisto(semanaActual, comensales) - costeLibre + deltaDestino;

  return (
    <BottomSheet onDismiss={onDejarComoEsta}>
      <h2 className="no-cocino__titulo">{nombreDiaCompleto(diaLibre.dia)} libre.</h2>
      <p className="no-cocino__cuerpo">
        Hoy no cocinas. El {nombreDiaCompleto(reorg.diaDestino.dia).toLowerCase()} pasa a {reorg.nuevoPlato.nombre}.
      </p>

      <div className="no-cocino__cuentas">
        <TicketRow label={`${diaLibre.dia} · ${diaLibre.nombre}`} value={eurConSigno(-costeLibre)} size={15} />
        <TicketRow
          label={`${reorg.diaDestino.dia} · ${reorg.diaDestino.nombre} → ${reorg.nuevoPlato.nombre}`}
          value={eurConSigno(deltaDestino)}
          size={15}
        />
        <div className="no-cocino__total">
          <TicketRow label="Total semana" value={eur(totalNuevo)} size={15} color="var(--azulete)" />
        </div>
      </div>

      <PrimaryButton onClick={() => onHecho(reorg.diaDestino.dia, reorg.nuevoPlato)}>Hecho</PrimaryButton>
      <div className="no-cocino__salida">
        <a href="#!" onClick={(e) => { e.preventDefault(); onDejarComoEsta(); }}>
          Dejarlo como está
        </a>
      </div>
    </BottomSheet>
  );
};

export default EsteDiaNoCocino;
