import type { Retoque } from '../data/motor';
import type { DiaSemana, Ranura } from '../state/types';
import { diaCortoConNumero, eur, eurConSigno } from '../lib/format';
import { fechaDePosicion } from '../lib/fechas';
import type { FechaDia } from '../lib/fechas';
import { nombreRanura } from '../lib/menu';
import TicketRow from './TicketRow';
import PrimaryButton from './PrimaryButton';
import BottomSheet from './BottomSheet';
import './CambioSemana.css';

interface CambioSemanaProps {
  antes: DiaSemana[];
  /** El primer día real de la semana. Nulo en las anteriores a las fechas. */
  fechaInicio: FechaDia | null;
  despues: DiaSemana[];
  totalAntes: number;
  totalDespues: number;
  retoque: Retoque;
  onConfirmar: () => void;
  onCancelar: () => void;
}

/**
 * Qué se le dice al usuario cuando el motor no encuentra nada. Pasa de
 * verdad: medido, 114 de 378 pulsaciones de "bájame el precio" no tenían
 * nada más barato que ofrecer. Antes la hoja salía igual, con "0 comidas
 * cambian", "Te ahorras +0,00 €" y un botón que decía "Dejarlo así". Se
 * dice lo que hay y se cierra.
 */
const SIN_CAMBIO: Record<Retoque, string> = {
  barato: 'No hay nada más barato con lo que ya llevas en el carrito.',
  cambiar: 'No encuentro otro reparto para esa comida.',
  libre: 'No puedo dejar ese hueco libre sin descuadrar la semana.',
};

const RANURAS: Ranura[] = ['comida', 'cena'];

/**
 * Se listan estas y el resto se cuenta. Antes la lista tenía scroll interno
 * sin ninguna señal de que continuaba: el titular decía "9 comidas cambian" y
 * en pantalla se veían 5.
 */
const MAX_FILAS = 6;

/**
 * Rehacer desde un hueco mueve más de un día. La app absorbe el fallo, pero
 * no lo esconde: se enseña línea a línea qué comida cambia y cuánto se mueve
 * el carrito, y no se aplica hasta que el usuario dice que sí.
 */
const CambioSemana: React.FC<CambioSemanaProps> = ({
  antes, fechaInicio, despues, totalAntes, totalDespues, retoque, onConfirmar, onCancelar,
}) => {
  const cambios: { etiqueta: string; de: string; a: string }[] = [];
  antes.forEach((diaAntes, i) => {
    const diaDespues = despues.find((d) => d.dia === diaAntes.dia);
    /* El día REAL cuando se sabe: quien empieza en viernes no debe leer «MAR»
       en la hoja que le dice qué comidas le van a cambiar. */
    const cuando = fechaDePosicion(fechaInicio, i);
    for (const ranura of RANURAS) {
      const a = diaAntes[ranura];
      const b = diaDespues?.[ranura] ?? null;
      if (!a && !b) continue;
      if (a?.nombre === b?.nombre && a?.tipo === b?.tipo) continue;
      cambios.push({
        etiqueta: `${cuando ? diaCortoConNumero(cuando) : diaAntes.dia} · ${nombreRanura(ranura)}`,
        de: a?.nombre ?? 'libre',
        a: b?.nombre ?? 'libre',
      });
    }
  });

  const delta = totalDespues - totalAntes;

  if (!cambios.length) {
    return (
      <BottomSheet onDismiss={onCancelar}>
        <h2 className="cambio__titulo">{SIN_CAMBIO[retoque]}</h2>
        <PrimaryButton onClick={onCancelar}>Volver</PrimaryButton>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet onDismiss={onCancelar}>
      <h2 className="cambio__titulo">
        {cambios.length} {cambios.length === 1 ? 'comida cambia' : 'comidas cambian'}.
      </h2>

      <div className="cambio__lista">
        {cambios.slice(0, MAX_FILAS).map((c) => (
          <div className="cambio__fila" key={c.etiqueta}>
            <span className="cambio__cuando">{c.etiqueta}</span>
            <span className="cambio__de">{c.de}</span>
            <span className="cambio__a">{c.a}</span>
          </div>
        ))}
        {cambios.length > MAX_FILAS && (
          <div className="cambio__resto">y {cambios.length - MAX_FILAS} comidas más</div>
        )}
      </div>

      <div className="cambio__cuentas">
        <TicketRow label="Carrito antes" value={eur(totalAntes)} size={15} />
        <TicketRow label="Carrito ahora" value={eur(totalDespues)} size={15} />
        <div className="cambio__total">
          <TicketRow
            label={delta <= 0 ? 'Te ahorras' : 'Te sube'}
            value={eurConSigno(delta)}
            size={15}
            color={delta > 0 ? 'var(--roja)' : 'var(--azulete)'}
          />
        </div>
      </div>

      <PrimaryButton onClick={onConfirmar}>Dejarlo así</PrimaryButton>
      {/**
        * `salida-texto`, como «Ahora no» del cierre. Sin ella este enlace medía
        * 92×19: la vuelta atrás de una propuesta que cambia catorce comidas era
        * un objetivo de 19 px frente a un botón de 56. Eso no es una jerarquía
        * visual, es hacer difícil decir que no — y esta app se posiciona
        * justamente contra eso.
        */}
      <div className="cambio__salida">
        <a className="salida-texto" href="#!" onClick={(e) => { e.preventDefault(); onCancelar(); }}>
          Como estaba
        </a>
      </div>
    </BottomSheet>
  );
};

export default CambioSemana;
