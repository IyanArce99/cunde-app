import { useEffect, useState } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { useAppState } from '../../state/AppStateContext';
import HojaExclusiones from '../../components/HojaExclusiones';

import { numComensales, etiquetaComensales, numHuecos } from '../../state/types';
import { costePorHueco, presupuestoMinimoViable } from '../../lib/derive';
import { estadoDelRecetario } from '../../lib/consecuencias';
import { eur, eurSinSimbolo } from '../../lib/format';
import BudgetSlider from '../../components/BudgetSlider';
import PrimaryButton from '../../components/PrimaryButton';
import Stepper from '../../components/Stepper';
import './Presupuesto.css';

/**
 * PASO 3 DE 3 · EL TOPE.
 *
 * Una sola decisión: el dinero. La variedad y la proteína viven en los ajustes,
 * sobre el menú ya generado, porque ninguna de las dos hace inservible el primer
 * menú y se entienden mucho mejor CON la semana delante — "te sobran 11,83 €,
 * sube la variedad" es una frase que aquí todavía no se puede decir.
 *
 * Debajo del deslizador, la tarjeta de lo que sale: el precio de la ración y
 * cuántas recetas quedan vivas. Es lo que convierte el número del tope en algo
 * con lo que el usuario puede comparar —un menú del día, lo que gastó la semana
 * pasada— en vez de una cifra suelta.
 */
const Presupuesto: React.FC = () => {
  const history = useHistory();
  const { estado, dispatch } = useAppState();
  const { comensales, presupuestoSemanal } = estado.perfil;
  const { comidas, esfuerzo, proteina, exclusiones, postre } = estado.preferencias;
  const n = numComensales(comensales);
  // El suelo depende de cuántos huecos hay que llenar y de qué se ha quitado,
  // no solo de cuántos son. Lo calcula el motor con el catálogo real.
  const minimoViable = presupuestoMinimoViable(comensales, comidas, esfuerzo, exclusiones, proteina, postre);
  const huecos = numHuecos(comidas);
  const recetario = estadoDelRecetario(exclusiones);
  const [abriendoExclusiones, setAbriendoExclusiones] = useState(false);

  /**
   * ═══ EL DESLIZADOR YA NO BAJA DE LO QUE CUESTA COMER ═══
   *
   * Antes empezaba en 30 € y, si no llegaba, aparecía una tarjeta diciendo «con
   * 30 € no me salen las cuentas, con 59 € sí» y un botón para subirlo. Era la
   * salida en vez del muro, que es la regla de la casa, pero funcionaba dejando
   * al usuario llegar primero a un sitio donde no hay nada.
   *
   * Ahora el suelo del carril ES ese número. La consecuencia es la misma —no
   * puedes pedir catorce comidas por 30 €— pero se aprende moviendo el dedo, sin
   * un error de por medio. Y se gana la pantalla entera que ocupaba el aviso.
   *
   * Lo que se pierde: ya no se dice explícitamente «con 30 no, con 59 sí». Se
   * cambia por que el carril empiece en 59, que dice lo mismo sin escribirlo.
   *
   * El suelo se mueve con las exclusiones —quitar pescado y gluten lo sube— así
   * que hay que reajustar el tope cuando el usuario cambia lo que no come: si no,
   * se queda con una cifra por debajo del propio carril.
   */
  useEffect(() => {
    if (presupuestoSemanal < minimoViable) {
      dispatch({ type: 'SET_PRESUPUESTO', presupuesto: minimoViable });
    }
  }, [minimoViable, presupuestoSemanal, dispatch]);

  /* Mientras el efecto no haya corrido, se pinta ya con el suelo: sin esto el
     primer fotograma enseña el pulgar fuera del carril. */
  const tope = Math.max(presupuestoSemanal, minimoViable);

  /**
   * EL TECHO TAMBIÉN SALE DEL RECETARIO, NO ES UN 200 FIJO.
   *
   * Con el suelo en 59 €, un techo de 200 dejaba el pulgar al 4% del carril y
   * dos tercios de recorrido que no compran nada: medido, con 90 € de tope para
   * dos el motor se gasta 71 y de ahí no sube. Y 200 € para dos personas son
   * 14 € por persona y día, que no es un presupuesto, es un número.
   *
   * 2,5 veces el suelo deja sitio de sobra por arriba —hasta donde el motor
   * puede gastar y un poco más— y devuelve resolución al gesto: cada milímetro
   * de dedo mueve euros que significan algo.
   */
  const techo = Math.ceil((minimoViable * 2.5) / 10) * 10;

  return (
    <IonPage>
      <IonContent fullscreen scrollY={false} className="pantalla-content">
        <div className="pantalla pantalla--onboarding presupuesto">
          <Stepper paso={3} />

          <div className="presupuesto__cuerpo">
            <h1 className="presupuesto__pregunta">¿Cuál es tu tope?</h1>

            {/* La cifra a 88 px y el € en volado: es la única decisión de la
                pantalla y la regla de la casa dice que el euro manda. */}
            <div className="presupuesto__cifra">
              <span className="presupuesto__cifra-numero">{eurSinSimbolo(tope, 0)}</span>
              <span className="presupuesto__cifra-moneda">€</span>
            </div>
            {/* «a la semana» delante: sin la unidad de tiempo, 65 € puede ser
                del mes o de la compra de hoy, y el reparto por persona y día
                que va detrás no sitúa por sí solo. */}
            <div className="presupuesto__por-dia">
              a la semana · {eur(tope / 7 / n, 2)} por persona y día
            </div>

            <div className="presupuesto__slider">
              <BudgetSlider
                value={tope}
                min={minimoViable}
                max={techo}
                extremos={['AJUSTADO', 'HOLGADO']}
                etiquetaValor={(v) => `${v} euros a la semana, ${eur(v / 7 / n, 2)} por persona y día`}
                onChange={(v) => dispatch({ type: 'SET_PRESUPUESTO', presupuesto: v })}
              />
            </div>

            {/**
              * LO QUE SALE, EN UNA LÍNEA Y NO EN UNA TARJETA DE DOS FILAS.
              *
              * Eran dos filas dentro de una caja con borde: «14 comidas para 2
              * personas · 2,32 €» y «Recetas que te valen · 88». Dos cifras del
              * mismo peso compitiendo, y la caja separándolas de la pregunta que
              * las produce.
              *
              * Ahora manda una: lo que le sale la ración, que es con lo que se
              * compara por fuera —un menú del día, un táper—. Lo demás baja a
              * una línea de contexto: cuántas comidas, para cuántos, y con
              * cuántas recetas, que es lo único que avisa de que los filtros
              * aprietan.
              */}
            <div className="presupuesto__resultado">
              <div className="presupuesto__resultado-fila">
                <span className="presupuesto__resultado-rotulo">Te sale a</span>
                <span className="presupuesto__resultado-cifra">
                  {eur(costePorHueco(tope, comensales, comidas))}
                </span>
              </div>
              <div className="presupuesto__resultado-detalle">
                la ración · {huecos} comidas para {etiquetaComensales(comensales)} · {recetario.vivas} recetas
              </div>
            </div>
          </div>

          <div className="presupuesto__pie">
            {/* Las alergias, escritas antes de generar. Salieron de 2/3 porque
                quince chips la dejaban con scroll, pero no podían quedarse solo
                dentro de ajustes: allí se llega DESPUÉS de ver un menú, y un
                menú con marisco delante de quien tiene alergia al marisco ya ha
                fallado aunque se pueda corregir. Ver HojaExclusiones.tsx. */}
            <button
              type="button"
              className="presupuesto__fuera"
              onClick={() => setAbriendoExclusiones(true)}
            >
              <span className="presupuesto__fuera-texto">
                <span className="presupuesto__fuera-rotulo">Fuera del menú</span>
                <span className="presupuesto__fuera-resumen">
                  {exclusiones.length ? exclusiones.join(', ') : 'Nada. Como de todo.'}
                </span>
              </span>
              <span className="presupuesto__fuera-cambiar">Cambiar ›</span>
            </button>

            {/* «Sin registro. Sin tarjeta.» se va de aquí: ya lo dice la portada,
                que es donde el usuario decide si entra. Repetirlo en la última
                pantalla del embudo no tranquiliza a nadie que ya está dentro y
                mete una línea entre la decisión y el botón. */}
            <PrimaryButton onClick={() => history.push('/onboarding/generando')}>Ver mi semana</PrimaryButton>
          </div>
        </div>

        {abriendoExclusiones && (
          <HojaExclusiones
            valor={exclusiones}
            onCerrar={() => setAbriendoExclusiones(false)}
            onGuardar={(nuevas) => {
              dispatch({ type: 'SET_PREFERENCIAS', preferencias: { ...estado.preferencias, exclusiones: nuevas } });
              setAbriendoExclusiones(false);
            }}
          />
        )}
      </IonContent>
    </IonPage>
  );
};

export default Presupuesto;
