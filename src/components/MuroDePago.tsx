import { useState } from 'react';
import type { Suscripcion } from '../state/types';
import { eur } from '../lib/format';
import { AL_ANO, PRECIOS } from '../lib/suscripcion';
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
 * Y el precio se dice en la misma unidad que el ahorro: el plan mensual sale a
 * 0,92 € por semana contra 8,57 € ahorrados, un ratio de 9 a 1 en una línea.
 *
 * LO QUE NO SE TOCA, porque es el posicionamiento entero: ningún plan
 * preseleccionado, la salida gratuita en tinta y del mismo tamaño (no en gris
 * pequeño), decir cuándo se cobra y cómo se sale, y ni prueba con cargo
 * automático ni cuenta atrás.
 *
 * Aquí ponía también «ni semanal». Desde el 11 ago SÍ hay plan semanal, a
 * 1,49 € — 77,48 al año, el más CARO de los tres: está para quien no quiere
 * comprometerse a un mes, y paga esa comodidad. La regla se escribió contra una
 * app que cobra 9,99 A LA SEMANA (519 al año); lo predatorio era el importe y
 * la prueba trampa, no el periodo.
 *
 * Por eso cada plan enseña lo que suma en un año, y eso NO es decoración: sin
 * esa línea, 1,49 parece tres veces más barato que 3,99 cuando es un 62% más
 * caro. La línea es la condición para poder tener este plan.
 *
 * Con el plan de por vida cambia la letra pequeña: «cancelas cuando quieras»
 * sobre un pago único sería falso.
 */
/**
 * Lo que se cobra por cada plan, en un solo sitio.
 *
 * Estaba escrito como un ternario dentro del botón, y con dos planes daba
 * igual. Con tres, «si no es mes, es anual» cobraría 29,99 € por el de por
 * vida — un fallo que no se ve en pantalla hasta que alguien paga de menos.
 */
function precioDe(plan: Exclude<Suscripcion, null>): number {
  if (plan === 'semana') return PRECIOS.semana;
  if (plan === 'de-por-vida') return PRECIOS.deporvida;
  return PRECIOS.mes;
}

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

      {/**
        * ═══ TRES PLANES, NINGUNO SEÑUELO, Y CADA UNO DICE LO QUE SUMA AL AÑO ═══
        *
        * El patrón habitual de tres precios pone uno en medio marcado como «el
        * recomendado» para que los otros dos parezcan malos. Aquí no: los tres
        * tienen la misma caja, el mismo tamaño y ninguno viene marcado. Van en
        * orden de compromiso creciente —semana, mes, siempre—, no ordenados
        * para empujar al de en medio.
        *
        * Con periodos distintos, la cifra grande no es comparable: 0,49 parece
        * ocho veces más barato que 3,99 y en realidad es la mitad de caro al
        * año. La línea de abajo pone los tres en la misma unidad.
        *
        * No es un detalle de maquetación: enseñar 0,49 € sin decir que son
        * 25,48 al año es exactamente el truco de la app que cobra 9,99 a la
        * semana, y esa comparación es el posicionamiento entero de Cunde.
        *
        * Siguen sin preseleccionar y con la misma caja los tres: ninguno es
        * «el recomendado».
        */}
      <div className="muro__planes">
        <button
          className={`muro__plan${plan === 'semana' ? ' muro__plan--seleccionado' : ''}`}
          onClick={() => setPlan('semana')}
          aria-pressed={plan === 'semana'}
          type="button"
        >
          <span className="muro__plan-precio">{eur(PRECIOS.semana)}</span>
          <span className="muro__plan-periodo">a la semana</span>
          <span className="muro__plan-unidad">{eur(AL_ANO.semana)} al año</span>
        </button>
        <button
          className={`muro__plan${plan === 'mes' ? ' muro__plan--seleccionado' : ''}`}
          onClick={() => setPlan('mes')}
          aria-pressed={plan === 'mes'}
          type="button"
        >
          <span className="muro__plan-precio">{eur(PRECIOS.mes)}</span>
          <span className="muro__plan-periodo">al mes</span>
          <span className="muro__plan-unidad">{eur(AL_ANO.mes)} al año</span>
        </button>
        <button
          className={`muro__plan${plan === 'de-por-vida' ? ' muro__plan--seleccionado' : ''}`}
          onClick={() => setPlan('de-por-vida')}
          aria-pressed={plan === 'de-por-vida'}
          type="button"
        >
          <span className="muro__plan-precio">{eur(PRECIOS.deporvida)}</span>
          <span className="muro__plan-periodo">una vez</span>
          {/* Aquí no cabe «al año»: no hay periodo entre el que dividir. */}
          <span className="muro__plan-unidad">y ya está</span>
        </button>
      </div>

      {/* Ninguno viene marcado: el CTA no se activa hasta que el usuario elige,
          y no elegimos por él poniendo el caro delante. */}
      <PrimaryButton disabled={!plan} onClick={() => plan && onElegirPlan(plan)}>
        {/* Con dos planes bastaba un ternario; con tres, «lo que no es mes es
            anual» cobraría 29,99 € por el de por vida. */}
        {plan ? `Empezar · ${eur(precioDe(plan))}` : 'Elige un plan'}
      </PrimaryButton>

      <div className="muro__salida">
        <a className="salida-texto" href="#!" onClick={(e) => { e.preventDefault(); onSeguirGratis(); }}>
          Seguir con el plan gratis
        </a>
      </div>
      {/* La frase depende del plan elegido: «cancelas cuando quieras» sobre un
          pago único es falso, y decir que algo se cancela cuando no se puede
          cancelar es exactamente el tipo de letra pequeña contra el que se
          posiciona este producto. Sin plan elegido se dice lo común a los tres. */}
      <p className="muro__legal">
        {plan === 'de-por-vida'
          ? 'Un solo pago. No se renueva ni hay que cancelar nada.'
          : 'Se cobra hoy. Cancelas cuando quieras.'}
      </p>
      <TicketRow label="Tu despensa" value="se guarda aunque no pagues" size={13} color="var(--gris)" />
    </BottomSheet>
  );
};

export default MuroDePago;
