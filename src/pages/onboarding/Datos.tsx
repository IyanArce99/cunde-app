import { useState } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import type { Comensales } from '../../state/types';
import { etiquetaComensales } from '../../state/types';
import { useAppState } from '../../state/AppStateContext';
import { ALERGIAS, DIETAS } from '../../lib/restricciones';
import { useSuelo, estadoDelRecetario } from '../../lib/consecuencias';
import OptionButton from '../../components/OptionButton';
import PrimaryButton from '../../components/PrimaryButton';
import TicketRow from '../../components/TicketRow';
import './Datos.css';

const OPCIONES_COMENSALES: Comensales[] = ['1', '2', '3', '4', '5+'];

/**
 * Lo único que se pregunta antes de enseñar el menú es lo que, si falta, hace
 * que ese primer menú sea INSERVIBLE: cuántos sois y qué no podéis comer.
 *
 * La lista de restricciones va detrás de un toque, y no por adorno: la
 * inmensa mayoría no tiene ninguna, y enseñarles quince filtros en el punto
 * más frágil del embudo grita "esto es complicado" a quien solo quería saber
 * cuánto va a gastar. Con la lista plegada, quien no tiene restricciones lee
 * una línea —ya marcada— y sigue: cero toques.
 *
 * No queda escondida: el botón que la abre dice "alergias" con todas sus
 * letras y está al mismo nivel visual que el otro. Es una capa, no tres.
 */
const Datos: React.FC = () => {
  const history = useHistory();
  const { estado, dispatch } = useAppState();
  const { exclusiones, comidas, esfuerzo, proteina } = estado.preferencias;
  // Abierta si ya había algo elegido: al volver atrás no se pierde de vista.
  const [abierta, setAbierta] = useState(exclusiones.length > 0);

  // Las dos consecuencias vivas. La del recetario es un filtro sobre 112
  // recetas y sale en el render; la del suelo monta una semana entera y llega
  // un par de marcos tarde. Ver lib/consecuencias.ts.
  const suelo = useSuelo(estado.perfil.comensales, comidas, esfuerzo, exclusiones, proteina);
  const recetario = estadoDelRecetario(exclusiones);

  const guardar = (siguiente: string[]) =>
    dispatch({ type: 'SET_PREFERENCIAS', preferencias: { ...estado.preferencias, exclusiones: siguiente } });

  const alternar = (que: string) =>
    guardar(exclusiones.includes(que) ? exclusiones.filter((e) => e !== que) : exclusiones.concat(que));

  const chip = (que: string) => (
    <button
      key={que}
      type="button"
      className={`datos__chip${exclusiones.includes(que) ? ' datos__chip--seleccionado' : ''}`}
      aria-pressed={exclusiones.includes(que)}
      onClick={() => alternar(que)}
    >
      {que}
    </button>
  );

  return (
    <IonPage>
      <IonContent fullscreen scrollY={false} className="pantalla-content">
        <div className="pantalla pantalla--onboarding datos">
          <div className="datos__cabecera">
            <img className="datos__marca" src="/cunde-logotipo.svg" alt="Cunde" />
            <span className="datos__paso">2/3</span>
          </div>

          {/* EL TICKET IMPRIME LO QUE YA ESTÁ CONTESTADO, Y NADA MÁS.
              Aquí eso es una sola línea: la del paso 1.

              Antes salían las tres, y las otras dos eran las preguntas de ESTA
              pantalla — el mismo dato dos veces con 300 px por medio, y 50 px
              de alto para conseguirlo. Además rompía el mecanismo: un ticket
              que imprime la respuesta antes de que la des no está registrando
              nada, está adelantándose.

              Las dos que faltan aparecen en 3/3, que es donde ya son pasado.
              Lo que da la sensación de que la respuesta queda registrada, que
              era el otro trabajo de estas líneas, ahora lo hacen mejor las
              consecuencias vivas de más abajo. */}
          <div className="datos__ticket">
            {/* Ninguna línea es pulsable AQUÍ, y no por descuido. Dos de las
                tres se contestan en esta misma pantalla treinta píxeles más
                abajo, y la tercera —el súper— es la pantalla de la que se
                acaba de venir. Probado pulsable: la fila crece a 44 px para
                cumplir el área de toque y deja el ticket con una línea alta y
                dos bajas, que se lee como un fallo de maquetación.
                El resumen pulsable vive en 3/3, que es donde ya no se ve
                ninguna de las tres preguntas. */}
            <TicketRow
              label="Súper"
              value={estado.perfil.codigoPostal
                ? `${estado.perfil.super} · ${estado.perfil.codigoPostal}`
                : estado.perfil.super}
            />
          </div>

          <div className="datos__cuerpo">
            {/* Sin pictograma. Las tres viñetas eran el MISMO rectángulo
                dentado con tres o cuatro trazos distintos dentro: a 48 px el
                contorno se come el peso visual y lo que las diferencia queda a
                25 px, así que las tres se leían igual — "una caja con
                garabatos". No es un problema de dibujo, y por eso rehacer el
                interior no lo arreglaba.

                Y de fondo: un ticket no tiene iconos. Papel térmico es
                tipografía, filetes y números. La pregunta se explica sola y
                cualquier pictograma al lado es un cuerpo extraño en un sistema
                que no tiene vocabulario para ellos. */}
            <h2 className="datos__pregunta">¿Cuántos sois?</h2>
            <div className="datos__grid-comensales">
              {OPCIONES_COMENSALES.map((opcion) => (
                <OptionButton
                  key={opcion}
                  label={opcion}
                  variante="grid"
                  seleccionado={estado.perfil.comensales === opcion}
                  onClick={() => dispatch({ type: 'SET_COMENSALES', comensales: opcion })}
                />
              ))}
            </div>

            {/* Debajo del control y no encima de él: se toca el 4 y se mueve lo
                que hay justo debajo del dedo. Puesta entre pregunta y botones,
                lo que cambia queda por encima de la mano. */}
            <div className="datos__consecuencia" aria-live="polite">
              <TicketRow
                label={`Semana más barata para ${etiquetaComensales(estado.perfil.comensales)}`}
                value={suelo === null ? '···' : `${suelo} €`}
                color="var(--gris)"
              />
            </div>

            <h2 className="datos__pregunta datos__pregunta--segunda">¿Hay algo que no podáis comer?</h2>

            <button
              type="button"
              className={`datos__salida${!abierta ? ' datos__salida--seleccionado' : ''}`}
              aria-pressed={!abierta}
              onClick={() => { setAbierta(false); guardar([]); }}
            >
              Nada, comemos de todo
            </button>

            <button
              type="button"
              className={`datos__salida${abierta ? ' datos__salida--seleccionado' : ''}`}
              onClick={() => setAbierta(true)}
              aria-expanded={abierta}
            >
              Sí, hay alergias o dietas
            </button>

            {abierta && (
              <div className="datos__restricciones">
                {/* Alergia y preferencia son cosas distintas y aquí se ven
                    distintas: es la misma línea que decide si las trazas
                    bloquean o no. */}
                <span className="datos__grupo">Alergias e intolerancias</span>
                <div className="datos__chips">{ALERGIAS.map(chip)}</div>

                <span className="datos__grupo">Por dieta</span>
                <div className="datos__chips">{DIETAS.map(chip)}</div>
              </div>
            )}

            {/* La misma línea que arriba, con el número que de verdad importa
                aquí: cuántas recetas sobreviven a los filtros. Se mueve a cada
                chip. El aviso solo aparece cuando aprieta de verdad —ver
                POCAS_RECETAS, medido— y dice lo único que es cierto: que vas a
                repetir. No dice que no se pueda montar la semana, porque se
                puede: ni con el peor caso posible queda un hueco vacío. */}
            {/* PEGADA ABAJO CUANDO LA LISTA ESTÁ ABIERTA.
                Los quince chips no caben en 844 px, así que el cuerpo hace
                scroll. Con la línea al final del flujo, tocabas un chip y el
                número que ese chip acaba de mover estaba fuera de la pantalla:
                una consecuencia viva que no se ve no es una consecuencia. */}
            <div
              className={`datos__consecuencia${abierta ? ' datos__consecuencia--fija' : ''}`}
              aria-live="polite"
            >
              <TicketRow
                label="Recetas que te valen"
                // "112 de 112" no dice nada. El denominador solo importa cuando
                // hay algo que comparar, que es en cuanto se quita la primera.
                value={exclusiones.length ? `${recetario.vivas} de ${recetario.total}` : `${recetario.vivas}`}
                color={recetario.aprieta ? 'var(--tinta)' : 'var(--gris)'}
              />
              {recetario.aprieta && (
                <p className="datos__aprieta">Con tan pocas vas a repetir plato en la semana.</p>
              )}
            </div>

          </div>

          <PrimaryButton onClick={() => history.push('/onboarding/presupuesto')}>Seguir</PrimaryButton>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Datos;
