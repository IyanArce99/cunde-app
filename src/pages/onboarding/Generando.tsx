import { useEffect } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { useAppState } from '../../state/AppStateContext';
import { numHuecos } from '../../state/types';
import { diaConFecha } from '../../lib/format';
import './Generando.css';

/**
 * LA ESPERA, SIN IMPRESORA.
 *
 * Se va el ticket que se imprimía y el cursor que parpadeaba: eran la metáfora
 * de papel térmico que el rediseño retira entera. Lo que queda es una carga
 * tranquila —rótulo, titular y una barra fina— porque lo único que esta
 * pantalla tiene que hacer en dos segundos es no dar la sensación de que la
 * app se ha colgado.
 *
 * Y se va también la cabecera con las tres líneas de resumen. Devolvían al
 * usuario los datos que acababa de meter, en la única pantalla donde no puede
 * hacer nada con ellos.
 */
const Generando: React.FC = () => {
  const history = useHistory();
  const { estado, dispatch } = useAppState();
  const { presupuestoSemanal } = estado.perfil;

  /**
   * El número de platos se calcula, no se escribe.
   *
   * Estaba fijo en "14 platos" y quien elegía solo comidas —o solo cenas—
   * leía una cifra que no era la suya justo antes de ver su semana de 7.
   */
  const platos = numHuecos(estado.preferencias.comidas);

  useEffect(() => {
    const temporizador = setTimeout(() => {
      dispatch({ type: 'COMPLETAR_ONBOARDING' });
      history.replace('/semana');
    }, 2200);
    return () => clearTimeout(temporizador);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <IonPage>
      <IonContent fullscreen scrollY={false} className="pantalla-content">
        <div className="pantalla pantalla--onboarding generando">
          <div className="generando__cabecera">
            <span className="generando__marca">cunde</span>
          </div>

          <div className="generando__centro">
            <span className="generando__rotulo">Cuadrando tu semana</span>
            <h1 className="generando__titular">
              Encadenando los ingredientes para que no sobre nada.
            </h1>
            <div className="generando__barra">
              <div className="generando__barra-relleno" />
            </div>
            {/**
              * «Desde el VIE · 7 AGO» y no «7 días»: siete días lo dice ya la
              * palabra "semana", y el dato que el usuario no tiene —y que acaba
              * de decidir sin darse cuenta, porque va por defecto— es desde
              * cuándo. Es además la última pantalla antes de ver el menú: si
              * la fecha no es la que quiere, aquí todavía no ha invertido nada.
              */}
            <span className="generando__resumen">
              Desde el {diaConFecha(estado.perfil.fechaInicioSemana)} · {platos} platos · {presupuestoSemanal} €
            </span>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Generando;
