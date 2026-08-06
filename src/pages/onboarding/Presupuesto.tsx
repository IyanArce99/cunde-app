import { IonContent, IonPage } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { useAppState } from '../../state/AppStateContext';

import { numComensales, etiquetaComensales, numHuecos } from '../../state/types';
import { costePorHueco, presupuestoMinimoViable } from '../../lib/derive';
import { eur } from '../../lib/format';
import TicketRow from '../../components/TicketRow';
import BudgetSlider from '../../components/BudgetSlider';
import PrimaryButton from '../../components/PrimaryButton';
import './Presupuesto.css';

/**
 * Una sola decisión: el dinero. Los selectores de variedad y proteína se han
 * ido a los ajustes, sobre el menú ya generado, por dos razones:
 *
 *   · Ninguno de los dos hace el primer menú inservible — tienen valor por
 *     defecto razonable— y cada pregunta antes del menú cuesta conversión.
 *   · Se entienden mejor CON el menú delante: "te sobran 11,83 €, sube la
 *     variedad" es una frase que aquí todavía no se puede decir.
 *
 * De paso, los dos selectores llamaban al motor tres veces cada uno en cada
 * movimiento del deslizador: ~1,2 s en la pantalla más crítica del embudo.
 */
const Presupuesto: React.FC = () => {
  const history = useHistory();
  const { estado, dispatch } = useAppState();
  const { comensales, super: superElegido, presupuestoSemanal } = estado.perfil;
  const { comidas, esfuerzo, proteina, exclusiones } = estado.preferencias;
  const n = numComensales(comensales);
  // El suelo depende de cuántos huecos hay que llenar y de qué se ha quitado,
  // no solo de cuántos son. Lo calcula el motor con el catálogo real.
  const minimoViable = presupuestoMinimoViable(comensales, comidas, esfuerzo, exclusiones, proteina);
  const huecos = numHuecos(comidas);
  const noCuadra = presupuestoSemanal < minimoViable;

  return (
    <IonPage>
      <IonContent fullscreen scrollY={false} className="pantalla-content">
        <div className="pantalla pantalla--onboarding presupuesto">
          {/* El ticket que se va imprimiendo ES el indicador de progreso: cada
              pantalla añade su línea. Nada de barras de progreso. */}
          <div className="presupuesto__cabecera">
            <div className="presupuesto__cabecera-fila">
              <img className="presupuesto__marca" src="/cunde-logotipo.svg" alt="Cunde" />
              <span className="presupuesto__paso">3/3</span>
            </div>
            {/* ═══ ESTE TICKET ES LA PANTALLA DE RESUMEN ═══
                Las tres respuestas anteriores están aquí y cada una vuelve a su
                pregunta de un toque. La cuarta —el presupuesto— es la pantalla:
                repetirla en una línea de 13 px teniendo la misma cifra a 56 px
                treinta píxeles más abajo sería redundancia, no resumen.

                Va aquí y no en una pantalla propia porque una pantalla propia
                cuesta un toque en el punto más frágil del embudo y enseña lo
                mismo que esta ya enseña. Con el ticket pulsable, corregir una
                respuesta cuesta UN toque en vez de dos retrocesos, y ver lo que
                contestaste cuesta cero. */}
            <TicketRow
              label="Comensales"
              value={etiquetaComensales(comensales)}
              onClick={() => history.push('/onboarding/datos')}
            />
            {/* Lleva al paso 1, no a una hoja: la tienda se elige en UN sitio. */}
            <TicketRow
              label="Súper"
              value={`${superElegido}${estado.perfil.codigoPostal ? ` · ${estado.perfil.codigoPostal}` : ''}`}
              onClick={() => history.push('/onboarding/super')}
            />
            <TicketRow
              label="No comemos"
              value={exclusiones.length ? exclusiones.join(', ') : 'de todo'}
              onClick={() => history.push('/onboarding/datos')}
            />
          </div>

          <div className="presupuesto__cuerpo">
            <h2 className="presupuesto__pregunta">
              ¿Cuánto quieres gastar
              <br />
              a la semana?
            </h2>
            <div className="presupuesto__centro">
              <div className="presupuesto__cifra">{presupuestoSemanal} €</div>
              <div className="presupuesto__por-dia">{eur(presupuestoSemanal / 7 / n, 2)} por persona y día</div>

              <div className="presupuesto__slider">
                <BudgetSlider
                  value={presupuestoSemanal}
                  min={30}
                  max={200}
                  etiquetaValor={(v) => `${v} euros a la semana, ${eur(v / 7 / n, 2)} por persona y día`}
                  onChange={(v) => dispatch({ type: 'SET_PRESUPUESTO', presupuesto: v })}
                />
              </div>

              {noCuadra ? (
                <div className="presupuesto__aviso">
                  <p className="presupuesto__aviso-texto">
                    Con {presupuestoSemanal} € no me salen las cuentas para {huecos} comidas de{' '}
                    {etiquetaComensales(comensales)}. Con {minimoViable} € sí.
                  </p>
                  <div className="presupuesto__aviso-acciones">
                    <button
                      type="button"
                      className="presupuesto__aviso-subir"
                      onClick={() => dispatch({ type: 'SET_PRESUPUESTO', presupuesto: minimoViable })}
                    >
                      Subir a {minimoViable} €
                    </button>
                    <button
                      type="button"
                      className="presupuesto__aviso-volver"
                      onClick={() => history.push('/onboarding/datos')}
                    >
                      o compra para menos personas
                    </button>
                  </div>
                </div>
              ) : (
                <div className="presupuesto__resumen">
                  <TicketRow
                    label={`${huecos} comidas · ${etiquetaComensales(comensales)}`}
                    value={`${eur(costePorHueco(presupuestoSemanal, comensales, comidas))}/ración`}
                    color="var(--gris)"
                  />
                </div>
              )}
            </div>
          </div>

          <PrimaryButton onClick={() => history.push('/onboarding/generando')}>Ver mi semana</PrimaryButton>
          <span className="presupuesto__nota">Sin registro. Sin tarjeta.</span>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Presupuesto;
