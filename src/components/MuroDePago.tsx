import { useEffect, useState } from 'react';
import type { Suscripcion } from '../state/types';
import { eur } from '../lib/format';
import { AL_ANO, PRECIOS } from '../lib/suscripcion';
import type { Plan } from '../lib/suscripcion';
/* `restaurarCompras` NO se importa aquí: la llama la pantalla y pasa el
   resultado por `onRestaurar`. Este componente no habla con la tienda. */
import { preciosDeLaTienda } from '../lib/compras';
import { analitica } from '../lib/analitica';
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

/**
 * ═══ UN SOLO MURO, CON CONTEXTO ═══
 *
 * No hay `MuroProteina` ni `MuroCambios`. Los planes, los precios y la salida
 * son siempre los mismos; lo único que cambia es la primera frase, que dice qué
 * ha intentado hacer el usuario justo antes.
 *
 * Eso importa: un muro que aparece sin explicar por qué se lee como un peaje.
 * El mismo muro diciendo «ya has usado tus dos cambios de esta semana» se lee
 * como una respuesta.
 */
export type OrigenMuro = 'cambios_plato' | 'proteina_alta' | 'semana_2';

interface MuroDePagoProps {
  logro: LogroReal;
  /** Por qué se abre. Decide el encabezado, nada más. */
  origen: OrigenMuro;
  onElegirPlan: (plan: Suscripcion) => void;
  onSeguirGratis: () => void;
  /** Restaura y devuelve si había algo que restaurar. */
  onRestaurar?: () => Promise<boolean>;
}

/**
 * El beneficio que se destaca según lo que el usuario acaba de intentar.
 *
 * Sin lenguaje de SaaS: ni «desbloquea», ni «premium», ni «experiencia». Dice
 * qué pasa y ya. Y en `semana_2` no hay intento que responder, así que se
 * cuenta lo que Cunde+ hace y punto.
 */
const CABECERA: Record<OrigenMuro, { titulo: string; cuerpo: string }> = {
  cambios_plato: {
    titulo: 'CAMBIOS ILIMITADOS',
    cuerpo: 'Ya has usado tus dos cambios de esta semana. Con Cunde+ cambias los platos '
      + 'que quieras, hasta que la semana te encaje.',
  },
  proteina_alta: {
    titulo: 'PROTEÍNA ALTA',
    cuerpo: 'Cunde rehace la semana con más proteína en cada comida, sin salirse de tu tope. '
      + 'Va con Cunde+.',
  },
  semana_2: {
    titulo: 'CUNDE+',
    cuerpo: 'Lo de esta semana es gratis para siempre: el menú, los precios y la lista. '
      + 'Cunde+ es para cuando quieres cambiar más cosas — platos sin límite y proteína alta.',
  },
};

/**
 * Lo que se cobra por cada plan, en un solo sitio.
 *
 * Estaba escrito como un ternario dentro del botón, y con dos planes daba
 * igual. Con tres, «si no es mes, es el otro» cobra el precio equivocado — un
 * fallo que no se ve en pantalla, se ve en el banco del usuario.
 */
function precioDe(plan: Exclude<Suscripcion, null>): number {
  if (plan === 'semana') return PRECIOS.semana;
  if (plan === 'de-por-vida') return PRECIOS.deporvida;
  return PRECIOS.mes;
}

/** El plan que el muro presenta como el sensato. Ver `PLANES`. */
const RECOMENDADO: Suscripcion = 'mes';

const PLANES: { plan: 'semana' | 'mes' | 'de-por-vida'; clave: Plan; periodo: string; pie: string }[] = [
  { plan: 'semana', clave: 'semana', periodo: 'a la semana', pie: `${eur(AL_ANO.semana)} al año` },
  { plan: 'mes', clave: 'mes', periodo: 'al mes', pie: `${eur(AL_ANO.mes)} al año` },
  /* En el de por vida no cabe «al año»: no hay periodo entre el que dividir. */
  { plan: 'de-por-vida', clave: 'deporvida', periodo: 'una vez', pie: 'y ya está' },
];

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
 * LO QUE NO SE TOCA, porque es el posicionamiento entero: ningún plan
 * preseleccionado, la salida gratuita en tinta y del mismo tamaño (no en gris
 * pequeño), decir cuándo se cobra y cómo se sale, y ni prueba con cargo
 * automático ni cuenta atrás.
 *
 * El mensual lleva «Recomendado» y no «Más elegido»: lo segundo suena a dato de
 * ventas y no tenemos ninguno. Recomendado es lo que es — una opinión nuestra,
 * y encima verdadera: es el más barato al año de los dos recurrentes.
 */
const MuroDePago: React.FC<MuroDePagoProps> = ({
  logro, origen, onElegirPlan, onSeguirGratis, onRestaurar,
}) => {
  const [plan, setPlan] = useState<Suscripcion>(null);
  const [comprando, setComprando] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const [avisoRestaurar, setAvisoRestaurar] = useState<string | null>(null);

  /**
   * ═══ LOS PRECIOS SALEN DE LA TIENDA, NO DE `PRECIOS` ═══
   *
   * `priceString` viene con la moneda, el formato y los impuestos del país del
   * usuario. Los de `PRECIOS` solo se pintan hasta que la tienda responde, y en
   * desarrollo (donde no hay tienda) para siempre.
   */
  const [deLaTienda, setDeLaTienda] = useState<Partial<Record<Plan, string>>>({});
  useEffect(() => {
    let vivo = true;
    void preciosDeLaTienda().then((p) => { if (vivo) setDeLaTienda(p); });
    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    analitica('paywall_opened', { source: origen });
  }, [origen]);

  /**
   * ═══ UN SUELO PARA LA CIFRA, Y NO ES COSMÉTICO ═══
   *
   * El umbral era 0,01 €, o sea «si hay cualquier cosa, enséñala». Verificado en
   * navegador: el muro abría con **HAS BAJADO LA COMPRA · 0,20 €** como el
   * elemento más grande de la pantalla, justo encima de pedir 3,99 € al mes.
   *
   * Esa cifra es verdad, y por eso es peor: le da al usuario el argumento en
   * contra ya calculado. Y contradice la regla de que la cifra grande es
   * siempre lo que más ayuda a decidir — aquí ayudaba a decidir que no.
   *
   * Con un euro de suelo, la cascada cae sola a «HAS AJUSTADO TU SEMANA · 3
   * veces», que dice lo mismo (esto te sirve) sin ponerle precio a la evidencia.
   * Y si tampoco hay ajustes, no hay cabecera: mejor ninguna cifra que una
   * cifra mala. Eso ya estaba y no cambia.
   *
   * No se sube más: a partir de un euro la cifra ya defiende sola una cuota
   * semanal de 1,49 €, y redondear al alza sería esconder datos reales.
   */
  const MINIMO_PRESUMIBLE = 1;

  const cabecera = (() => {
    if (logro.ahorroDespensa >= MINIMO_PRESUMIBLE) {
      return { et: 'LA DESPENSA TE AHORRÓ', cifra: eur(logro.ahorroDespensa), pie: 'esta semana' };
    }
    if (logro.bajadoConRetoques >= MINIMO_PRESUMIBLE) {
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

  const texto = CABECERA[origen];

  /* `PLANES` solo contiene los tres que se venden, así que `p` nunca puede ser
     `'año'` —el plan viejo que `Suscripcion` sigue aceptando para no dejar sin
     acceso a quien lo tuviera guardado—. El cast lo dice explícitamente en vez
     de ensanchar el tipo del evento. */
  const elegir = (p: 'semana' | 'mes' | 'de-por-vida') => {
    setPlan(p);
    analitica('paywall_plan_selected', { plan: p });
  };

  const continuar = () => {
    if (!plan || comprando) return;
    /* Se bloquea el botón ANTES de nada: sin esto, dos toques rápidos abren dos
       diálogos de compra de Google. */
    setComprando(true);
    onElegirPlan(plan);
  };

  const restaurar = async () => {
    if (!onRestaurar || restaurando) return;
    setRestaurando(true);
    setAvisoRestaurar(null);
    analitica('restore_purchases_started');
    try {
      const tenia = await onRestaurar();
      /* Si no había nada, se dice. Fingir éxito deja a alguien creyendo que ya
         tiene Cunde+ y descubriéndolo al siguiente muro. */
      setAvisoRestaurar(tenia ? null : 'No hay ninguna compra que restaurar.');
      analitica('restore_purchases_completed', { restored: tenia });
    } catch {
      setAvisoRestaurar('No se ha podido comprobar. Inténtalo luego.');
    } finally {
      setRestaurando(false);
    }
  };

  return (
    <BottomSheet>
      {cabecera ? (
        <div className="muro__logro">
          <span className="muro__logro-etiqueta">{cabecera.et}</span>
          <span className="muro__logro-cifra">{cabecera.cifra}</span>
          <span className="muro__logro-pie">{cabecera.pie}</span>
        </div>
      ) : (
        <span className="muro__logro-etiqueta">{texto.titulo}</span>
      )}

      {/* El beneficio contextual. Cuando hay logro arriba, el título va aquí
          para no perderlo: es lo que explica por qué ha salido este muro. */}
      {cabecera && <p className="muro__contexto">{texto.titulo}</p>}
      <p className="muro__cuerpo">{texto.cuerpo}</p>

      {/**
        * ═══ TRES PLANES, NINGUNO SEÑUELO, Y CADA UNO DICE LO QUE SUMA AL AÑO ═══
        *
        * El patrón habitual de tres precios pone uno en medio marcado para que
        * los otros dos parezcan malos. Aquí el mensual lleva «Recomendado»
        * porque de verdad es el más barato al año de los dos recurrentes — es
        * una recomendación comprobable, no un empujón.
        *
        * Y la línea del año no es decoración: sin ella, 1,49 parece tres veces
        * más barato que 3,99 cuando es un 62% más caro. Esa línea es la
        * condición para poder tener un plan semanal sin parecernos a la app que
        * cobra 9,99 a la semana.
        */}
      <div className="muro__planes">
        {PLANES.map((p) => (
          <button
            key={p.plan}
            className={`muro__plan${plan === p.plan ? ' muro__plan--seleccionado' : ''}`}
            onClick={() => elegir(p.plan)}
            aria-pressed={plan === p.plan}
            type="button"
            disabled={comprando}
          >
            <span className="muro__plan-precio">
              {deLaTienda[p.clave] ?? eur(precioDe(p.plan))}
            </span>
            <span className="muro__plan-periodo">{p.periodo}</span>
            <span className="muro__plan-unidad">{p.pie}</span>
            {p.plan === RECOMENDADO && <span className="muro__plan-sello">Recomendado</span>}
          </button>
        ))}
      </div>

      <PrimaryButton disabled={!plan || comprando} onClick={continuar}>
        {(() => {
          if (comprando) return 'Un momento…';
          if (!plan) return 'Elige un plan';
          const clave = PLANES.find((p) => p.plan === plan)!.clave;
          return `Continuar · ${deLaTienda[clave] ?? eur(precioDe(plan))}`;
        })()}
      </PrimaryButton>

      <div className="muro__salida">
        <a
          className="salida-texto"
          href="#!"
          onClick={(e) => {
            e.preventDefault();
            analitica('paywall_closed', { source: origen });
            onSeguirGratis();
          }}
        >
          Seguir gratis
        </a>
      </div>

      {/* Apple la exige, y sin ella el plan de por vida es invendible: quien
          cambia de móvil no tendría forma de recuperarlo. */}
      {onRestaurar && (
        <div className="muro__restaurar">
          <button type="button" className="muro__restaurar-boton" onClick={restaurar} disabled={restaurando}>
            {restaurando ? 'Comprobando…' : 'Restaurar compras'}
          </button>
          {avisoRestaurar && <span className="muro__restaurar-aviso">{avisoRestaurar}</span>}
        </div>
      )}

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
