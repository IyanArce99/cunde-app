import { IonContent, IonPage } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import type { Comensales, ComidasPref } from '../../state/types';
import { useAppState } from '../../state/AppStateContext';
import { useSuelo } from '../../lib/consecuencias';
import PrimaryButton from '../../components/PrimaryButton';
import Stepper from '../../components/Stepper';
import './Datos.css';

const OPCIONES_COMENSALES: Comensales[] = ['1', '2', '3', '4', '5+'];

/**
 * Las tres formas de resolver la semana, con lo que cada una supone.
 *
 * "Solo comidas" y no "Comidas" a secas: sin el "solo", puesto al lado de
 * "Comidas y cenas", se lee como si fuera un subconjunto de la otra en vez de
 * una alternativa.
 */
const OPCIONES_COMIDAS: { valor: ComidasPref; label: string; meta: string }[] = [
  { valor: 'comidas', label: 'Solo comidas', meta: '7 platos' },
  { valor: 'cenas', label: 'Solo cenas', meta: '7 platos' },
  { valor: 'ambas', label: 'Comidas y cenas', meta: '14 platos' },
];

/**
 * PASO 2 DE 3 · PARA CUÁNTOS Y QUÉ RESUELVO.
 *
 * Una sola pregunta con tres respuestas encadenadas —cuántos sois, qué comidas
 * y si hay postre— porque las tres deciden lo mismo: cuánta comida hay que
 * comprar. Preguntarlas por separado las hacía parecer independientes.
 *
 * LAS ALERGIAS NO ESTÁN AQUÍ, y es deliberado. Quince chips en el paso más
 * frágil del embudo le gritan "esto es complicado" a la inmensa mayoría, que
 * no tiene ninguna. Viven en los ajustes, sobre el menú ya generado, donde
 * además se ve lo que cuestan.
 *
 * Abajo, pegado al botón, lo que cuesta la semana más barata con lo elegido.
 * Se mueve al tocar cualquiera de las tres respuestas y prepara la pregunta
 * siguiente: quien llega al deslizador sabiendo el suelo no lo mueve a ciegas.
 */
const Datos: React.FC = () => {
  const history = useHistory();
  const { estado, dispatch } = useAppState();
  const preferencias = estado.preferencias;
  const { exclusiones, comidas, esfuerzo, proteina, postre } = preferencias;

  const suelo = useSuelo(estado.perfil.comensales, comidas, esfuerzo, exclusiones, proteina, postre);

  const guardar = (cambio: Partial<typeof preferencias>) =>
    dispatch({ type: 'SET_PREFERENCIAS', preferencias: { ...preferencias, ...cambio } });

  return (
    <IonPage>
      <IonContent fullscreen scrollY={false} className="pantalla-content">
        <div className="pantalla pantalla--onboarding datos">
          <Stepper paso={2} />

          <div className="datos__cuerpo">
            <h1 className="datos__pregunta">¿Para cuántos y qué te resuelvo?</h1>

            <div className="datos__grid-comensales">
              {OPCIONES_COMENSALES.map((opcion) => (
                <button
                  key={opcion}
                  type="button"
                  className={`datos__comensal${estado.perfil.comensales === opcion ? ' datos__comensal--seleccionado' : ''}`}
                  aria-pressed={estado.perfil.comensales === opcion}
                  onClick={() => dispatch({ type: 'SET_COMENSALES', comensales: opcion })}
                >
                  {opcion}
                </button>
              ))}
            </div>

            <div className="datos__ranuras">
              {OPCIONES_COMIDAS.map((o) => (
                <button
                  key={o.valor}
                  type="button"
                  className={`datos__ranura${comidas === o.valor ? ' datos__ranura--seleccionado' : ''}`}
                  aria-pressed={comidas === o.valor}
                  onClick={() => guardar({ comidas: o.valor })}
                >
                  <span className="datos__ranura-label">{o.label}</span>
                  <span className="datos__ranura-meta">{o.meta}</span>
                </button>
              ))}
            </div>

            {/* EL POSTRE, BAJO "Y ADEMÁS".
                No es una cuarta opción de la ranura: no compite con "comidas /
                cenas / las dos", se SUMA a lo que se haya elegido. El rótulo
                aparte es lo que hace que se lea así. */}
            <span className="datos__ademas">Y además</span>
            <button
              type="button"
              className={`datos__ranura datos__conmutador${postre ? ' datos__ranura--seleccionado' : ''}`}
              aria-pressed={postre}
              onClick={() => guardar({ postre: !postre })}
            >
              <span className="datos__conmutador-texto">
                <span className="datos__conmutador-titulo">Postre en cada comida</span>
                <span className="datos__conmutador-sub">yogur, fruta, gelatina</span>
              </span>
              <span className={`datos__interruptor${postre ? ' datos__interruptor--on' : ''}`} aria-hidden="true">
                <span className="datos__interruptor-bola" />
              </span>
            </button>
          </div>

          {/* LA CONSECUENCIA, EN TARJETA Y PEGADA AL BOTÓN.
              Estaba como línea de ticket justo debajo de los comensales, y ahí
              solo respondía a una de las tres respuestas. Al pie responde a las
              tres, que es lo que de verdad hace: es el precio de todo lo que se
              acaba de elegir. */}
          <div className="datos__pie">
            <div className="datos__suelo" aria-live="polite">
              <span className="datos__suelo-texto">Lo más barato que te puedo montar</span>
              <span className="datos__suelo-cifra">{suelo === null ? '···' : `${suelo} €`}</span>
            </div>
            <PrimaryButton onClick={() => history.push('/onboarding/presupuesto')}>Seguir</PrimaryButton>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Datos;
