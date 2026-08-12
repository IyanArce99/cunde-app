import { IonContent, IonPage } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import PrimaryButton from '../../components/PrimaryButton';
import { eur, eurSinSimbolo } from '../../lib/format';
import { analitica } from '../../lib/analitica';
import muestra from '../../data/muestra-portada.json';
import './Portada.css';

/**
 * LA PORTADA ES UNA CIFRA CON DOS DATOS QUE LA SOSTIENEN.
 *
 * Antes era un rollo de ticket con tres productos y su total. La idea era
 * buena —la prueba y la promesa siendo el mismo objeto— pero dependía entera
 * de la metáfora de papel térmico, y el rediseño la retira. Sin ella, tres
 * líneas de producto sobre papel crema no son una prueba: son una lista.
 *
 * Lo que queda dice lo mismo con menos: el total de una semana real, y debajo
 * las dos cifras que lo hacen creíble —cuántas comidas y a cuánto sale la
 * ración—. Ese "2,28 € la ración" es el número con el que el usuario compara
 * con un menú del día, y es lo que convierte un total abstracto en una
 * afirmación que puede juzgar.
 *
 * La cifra sigue siendo el elemento mayor de la pantalla, que es la regla que
 * no se toca en ninguna pantalla de esta app.
 *
 * Los datos salen del MISMO motor que la app (ver EJEMPLO en
 * catalogo/generar.ts), así que es una semana que la app sabe producir y no
 * una maqueta con cifras bonitas. Y no se lee motor-datos.json aquí: son
 * 289 KB parseados antes del primer pintado, y el porcentaje que llega a ver
 * su menú es la métrica que decide el producto.
 */
const { ticket } = muestra;

const Portada: React.FC = () => {
  const history = useHistory();

  return (
    <IonPage>
      <IonContent fullscreen scrollY={false} className="pantalla-content">
        <div className="pantalla pantalla--onboarding portada">
          <div className="portada__cabecera">
            <span className="portada__marca">cunde</span>
          </div>

          {/* ═══ SE VA EL ROLLO DE TICKET ═══
              Era la firma del diseño anterior: papel crema, tres líneas de
              productos con su guía de puntos y un borde dentado abajo. El
              rediseño retira esa metáfora, así que lo que queda es lo que el
              rollo estaba diciendo — el total de una semana de verdad, con dos
              datos que lo hacen creíble.

              La cifra sigue siendo lo más grande de la pantalla, que es la
              regla que no se toca. Y el rótulo de arriba sigue llevando súper y
              comensales: un total sin ellos no afirma nada, porque 63,89 € para
              dos y para cinco son dos cosas distintas. */}
          <div className="portada__centro">
            <span className="portada__rotulo">
              Una semana para {ticket.personas} · Mercadona
            </span>

            <div className="portada__cifra">
              <span className="portada__cifra-numero">{eurSinSimbolo(ticket.total)}</span>
              <span className="portada__cifra-moneda">€</span>
            </div>

            <div className="portada__tarjetas">
              <div className="portada__tarjeta">
                <span className="portada__tarjeta-rotulo">Comidas</span>
                <span className="portada__tarjeta-dato">{ticket.comidas}</span>
              </div>
              <div className="portada__tarjeta">
                <span className="portada__tarjeta-rotulo">Por ración</span>
                <span className="portada__tarjeta-dato">
                  {eur(ticket.total / ticket.comidas / ticket.personas)}
                </span>
              </div>
            </div>

            <h1 className="portada__titular">
              Tú pones el tope. Yo pongo las {ticket.comidas} comidas y la lista.
            </h1>
            <p className="portada__sub">Con los precios de tu súper, los de hoy.</p>
          </div>

          <div className="portada__acciones">
            {/* LA NOTA VA ENCIMA DEL BOTÓN, no debajo.
                Debajo, el botón quedaba a distinta altura que en las otras
                pantallas del onboarding y el pie bailaba al avanzar. Encima, el
                botón se apoya siempre en el mismo sitio. */}
            <span className="portada__nota">Un minuto. Sin registro. Sin tarjeta.</span>
            {/* El primer escalón del embudo. Va en el TOQUE y no al montar la
                portada: quien abre la app y no toca nada ya está contado por
                `app_opened`, y contarlo aquí también inflaría la conversión de
                onboarding hasta hacerla inútil. */}
            <PrimaryButton onClick={() => {
              history.push('/onboarding/super');
              analitica('onboarding_started', { screen: 'onboarding_portada' });
            }}
            >
              Cuadrar mi semana
            </PrimaryButton>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Portada;
