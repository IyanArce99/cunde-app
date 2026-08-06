import { useState } from 'react';
import type { Suscripcion } from '../state/types';
import { eur } from '../lib/format';
import { PRECIOS, POR_SEMANA_ANUAL } from '../lib/suscripcion';
import TicketRow from './TicketRow';
import PrimaryButton from './PrimaryButton';
import BottomSheet from './BottomSheet';
import './MuroDePago.css';

/**
 * Lo que este usuario ha conseguido, con SUS datos. Nunca un promedio del
 * sector ni una cifra inventada: si no hay dato real, no se enseña cifra.
 */
export interface LogroReal {
  /** € que la despensa evitó pagar esta semana. El argumento principal. */
  ahorroDespensa: number;
  /** € que bajó con "bájame el precio" desde que usa la app. */
  bajadoConRetoques: number;
  /** Retoques hechos. Sirve cuando aún no hay euros que enseñar. */
  ajustes: number;
}

interface MuroDePagoProps {
  logro: LogroReal;
  onElegirPlan: (plan: Suscripcion) => void;
  onSeguirGratis: () => void;
}

/**
 * ABRE CON LO CONSEGUIDO, NO CON EL FRACASO.
 *
 * La versión anterior abría con "Presupuesto 65,00 € · Pagaste 68,40 € · Te
 * pasaste 3,40 €", resaltado en amarillo: le enseñaba al usuario que había
 * fallado justo antes de pedirle dinero. Y encima anclaba la petición en la
 * semana en que peor le fue.
 *
 * Ahora arranca con lo que la app le ha dado, en euros y con datos suyos. El
 * orden de preferencia es por fuerza del argumento:
 *
 *   1. Lo que le ahorró la despensa esta semana. Es lo que se vende.
 *   2. Lo que bajó con los retoques, si aún no hay despensa acumulada.
 *   3. Cuántos ajustes ha hecho, si no hay euros.
 *   4. Nada. Si no hay ningún dato real, NO SE ENSEÑA CIFRA — antes que
 *      inventar una media del sector, se dice qué se lleva y ya.
 *
 * Y el precio se dice en la misma unidad que el ahorro: 0,57 € a la semana
 * contra 8,57 € ahorrados es una frase de una línea con un ratio de 15 a 1.
 *
 * LO QUE NO SE TOCA, porque es el posicionamiento entero: ningún plan
 * preseleccionado, la salida gratuita en tinta y del mismo tamaño (no en gris
 * pequeño), "Se cobra hoy. Cancelas cuando quieras", y ni semanal, ni prueba
 * con cargo automático, ni cuenta atrás.
 */
const MuroDePago: React.FC<MuroDePagoProps> = ({ logro, onElegirPlan, onSeguirGratis }) => {
  const [plan, setPlan] = useState<Suscripcion>(null);

  const cabecera = (() => {
    if (logro.ahorroDespensa >= 0.01) {
      return { et: 'LA DESPENSA TE AHORRÓ', cifra: eur(logro.ahorroDespensa), pie: 'esta semana' };
    }
    if (logro.bajadoConRetoques >= 0.01) {
      return { et: 'HAS BAJADO LA COMPRA', cifra: eur(logro.bajadoConRetoques), pie: 'desde que usas Cunde' };
    }
    if (logro.ajustes > 0) {
      return {
        et: 'HAS AJUSTADO TU SEMANA',
        cifra: `${logro.ajustes} ${logro.ajustes === 1 ? 'vez' : 'veces'}`,
        pie: 'sin salir de casa',
      };
    }
    return null;
  })();

  return (
    <BottomSheet>
      {cabecera ? (
        <div className="muro__logro">
          <span className="muro__logro-etiqueta">{cabecera.et}</span>
          <span className="muro__logro-cifra">{cabecera.cifra}</span>
          <span className="muro__logro-pie">{cabecera.pie}</span>
        </div>
      ) : (
        // Sin dato real no hay cifra. Se dice qué se lleva y punto.
        <span className="muro__logro-etiqueta">CUNDE COMPLETO</span>
      )}

      <p className="muro__cuerpo">
        Lo de esta semana es gratis para siempre: el menú, los precios y la lista.
        Se paga que la app se acuerde — la despensa que se acumula, no repetirte
        platos en tres semanas, y la cuenta de lo que llevas ahorrado.
      </p>

      <div className="muro__planes">
        <button
          className={`muro__plan${plan === 'año' ? ' muro__plan--seleccionado' : ''}`}
          onClick={() => setPlan('año')}
          aria-pressed={plan === 'año'}
          type="button"
        >
          <span className="muro__plan-precio">{eur(PRECIOS.anual)}</span>
          <span className="muro__plan-periodo">al año</span>
          <span className="muro__plan-unidad">{eur(POR_SEMANA_ANUAL)} por semana</span>
        </button>
        <button
          className={`muro__plan${plan === 'mes' ? ' muro__plan--seleccionado' : ''}`}
          onClick={() => setPlan('mes')}
          aria-pressed={plan === 'mes'}
          type="button"
        >
          <span className="muro__plan-precio">{eur(PRECIOS.mes)}</span>
          <span className="muro__plan-periodo">al mes</span>
          <span className="muro__plan-unidad">{eur(PRECIOS.mes / 4.33)} por semana</span>
        </button>
      </div>

      {/* Ninguno viene marcado: el CTA no se activa hasta que el usuario elige,
          y no elegimos por él poniendo el caro delante. */}
      <PrimaryButton disabled={!plan} onClick={() => plan && onElegirPlan(plan)}>
        {plan ? `Empezar · ${eur(plan === 'mes' ? PRECIOS.mes : PRECIOS.anual)}` : 'Elige un plan'}
      </PrimaryButton>

      <div className="muro__salida">
        <a className="salida-texto" href="#!" onClick={(e) => { e.preventDefault(); onSeguirGratis(); }}>
          Seguir con el plan gratis
        </a>
      </div>
      <p className="muro__legal">Se cobra hoy. Cancelas cuando quieras.</p>
      <TicketRow label="Tu despensa" value="se guarda aunque no pagues" size={13} color="var(--gris)" />
    </BottomSheet>
  );
};

export default MuroDePago;
