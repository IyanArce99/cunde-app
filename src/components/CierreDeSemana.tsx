import { useState } from 'react';
import { eur, eurConSigno } from '../lib/format';
import TicketRow from './TicketRow';
import PrimaryButton from './PrimaryButton';
import BottomSheet from './BottomSheet';
import './CierreDeSemana.css';

interface CierreDeSemanaProps {
  /** El MENÚ. Lo que Cunde calculó. Nunca lleva extras dentro. */
  previsto: number;
  /** Los extras QUE TIENEN PRECIO. 0 si no hay ninguno. */
  extras: number;
  /** Cuántos extras no tienen precio. Cambia lo que se puede afirmar. */
  extrasSinPrecio: number;
  presupuesto: number;
  onGuardar: (importeReal: number) => void;
  onCerrar: () => void;
}

/**
 * ═══ EL CIERRE CON EXTRAS · QUÉ SE PUEDE AFIRMAR Y QUÉ NO ═══
 *
 * Sin extras, esto compara lo que Cunde dijo con lo que marcó el ticket, y esa
 * diferencia mide UNA cosa: si los precios del catálogo eran buenos.
 *
 * Con extras, esa lectura deja de ser cierta, y hay dos casos distintos:
 *
 *   · TODOS los extras tienen precio → se suma y se compara. La diferencia
 *     sigue midiendo algo real: lo previsto entero contra lo pagado.
 *   · ALGUNO no lo tiene → NO se puede repartir la diferencia. Si el ticket
 *     marca 4,70 € más y hay dos cosas sin precio, no hay forma de saber si
 *     Cunde falló, si el champú costaba 4,70 € o las dos cosas a medias.
 *
 * En ese segundo caso la hoja NO enseña «Diferencia». Enseñarla sería insinuar
 * que Cunde se equivocó en una cantidad que nadie ha medido — exactamente la
 * clase de número que esta app no puede permitirse. Se dice lo que se sabe:
 * cuánto se contaba, cuántas cosas no tenían precio, y lo que marcó el ticket.
 *
 * No se estima el precio de lo que falta, no se reparte la diferencia y no se
 * inventa una métrica de precisión.
 */
const CierreDeSemana: React.FC<CierreDeSemanaProps> = ({
  previsto, extras, extrasSinPrecio, presupuesto, onGuardar, onCerrar,
}) => {
  const [texto, setTexto] = useState('');
  const pagado = parseFloat(texto.replace(',', '.'));
  const hayValor = texto.trim() !== '' && !Number.isNaN(pagado);
  const hayExtras = extras > 0 || extrasSinPrecio > 0;
  const totalPrevisto = previsto + extras;
  /* Solo se compara cuando la suma está completa. Ver la cabecera. */
  const sePuedeComparar = extrasSinPrecio === 0;
  const diferencia = hayValor ? pagado - totalPrevisto : 0;
  /**
   * El tope es de la COMIDA, así que aquí se mide la comida y no el ticket.
   *
   * Con todos los extras valorados, el menú real es `ticket − extras`. Sin
   * ellos valorados esa resta sobra de más —arrastra lo que costaron las cosas
   * sin precio— así que se usa lo previsto del menú, que es lo único que se
   * sabe. Es aproximado y es honesto: la alternativa era decir «te has pasado»
   * a quien se pasó comprando champú.
   */
  const menuReal = sePuedeComparar ? pagado - extras : previsto;
  const dentroPresupuesto = hayValor ? menuReal <= presupuesto : true;

  return (
    <BottomSheet onDismiss={onCerrar}>
      <h2 className="cierre__titulo">
        ¿Qué ha marcado
        <br />
        el ticket?
      </h2>
      <div className="cierre__caja">
        {/* El placeholder desaparece al escribir y no es un nombre accesible:
            para un lector de pantalla este campo era "editar texto, 0,00" y
            nada más. El rótulo va explícito y dice la unidad, que el "0,00"
            solo insinúa. */}
        <input
          className="cierre__input"
          type="text"
          inputMode="decimal"
          placeholder="0,00"
          aria-label="Lo que ha marcado el ticket, en euros"
          value={texto}
          onChange={(e) => setTexto(e.target.value.replace(/[^0-9,]/g, ''))}
          autoFocus
        />
        <span className="cierre__moneda">€</span>
      </div>

      {hayValor && (
        <div className="cierre__cuentas">
          {/* El menú SIEMPRE por su nombre cuando hay extras: sin decirlo,
              «Previsto 61,20 €» junto a un ticket de 74 € parece un fallo de
              Cunde de trece euros, cuando ocho eran champú y detergente. */}
          <TicketRow label={hayExtras ? 'Menú' : 'Previsto'} value={eur(previsto)} size={15} />
          {hayExtras && (
            <TicketRow
              label={extrasSinPrecio > 0 ? 'Otras cosas con precio' : 'Otras cosas'}
              value={eur(extras)}
              size={15}
            />
          )}
          {hayExtras && (
            <TicketRow
              label={sePuedeComparar ? 'Total previsto' : 'Total con precios'}
              value={eur(totalPrevisto)}
              size={15}
            />
          )}
          <TicketRow label="Ticket" value={eur(pagado)} size={15} />

          {/* El color va solo en la cifra, no en la fila: "Diferencia" es un
              rótulo, y en rojo se lee como si el concepto fuese el problema. */}
          {sePuedeComparar ? (
            <div className="cierre__diferencia">
              <TicketRow
                label="Diferencia"
                value={eurConSigno(diferencia)}
                size={15}
                colorValor={Math.abs(diferencia) < 0.005 ? 'var(--tinta)' : 'var(--roja)'}
              />
            </div>
          ) : (
            /**
             * Sin diferencia, y dicho por qué.
             *
             * Es la decisión de producto de esta pantalla: con cosas sin precio
             * no se puede saber qué parte del desfase es de Cunde y cuál del
             * champú, así que no se enseña ningún número que lo insinúe. Se
             * dice cuántas faltaban y se deja ahí.
             */
            <div className="cierre__diferencia">
              <p className="cierre__sin-comparar">
                {extrasSinPrecio} {extrasSinPrecio === 1 ? 'cosa no tenía' : 'cosas no tenían'} precio, así
                que no comparo: no sabría qué parte de la diferencia es del menú.
              </p>
            </div>
          )}

          {/* El tope es de la COMIDA, así que se compara contra el menú y no
              contra el ticket entero. Si no, comprar detergente diría que te
              has pasado del presupuesto de las comidas. */}
          <div className="cierre__sobre">
            <TicketRow
              label={`Sobre ${eur(presupuesto)}`}
              value={dentroPresupuesto ? 'dentro' : 'fuera'}
              size={15}
              colorValor={dentroPresupuesto ? 'var(--tinta)' : 'var(--roja)'}
            />
          </div>
        </div>
      )}

      {/* Decía "Ajusto los precios de tu Mercadona con esto": explicaba lo que
          gana la app, no lo que gana quien está tecleando en la cola del súper.
          Y se callaba lo único que hace volver — que esto no se pierde, que va
          sumando semana a semana. */}
      <p className="cierre__nota">Afino los precios de tu tienda y te llevo la cuenta semana a semana.</p>
      <PrimaryButton disabled={!hayValor} onClick={() => hayValor && onGuardar(pagado)}>
        Guardar esta semana
      </PrimaryButton>
      <div className="cierre__salida">
        <a className="salida-texto" href="#!" onClick={(e) => { e.preventDefault(); onCerrar(); }}>
          Ahora no
        </a>
      </div>
    </BottomSheet>
  );
};

export default CierreDeSemana;
