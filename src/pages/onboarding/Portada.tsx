import { IonContent, IonPage } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import PrimaryButton from '../../components/PrimaryButton';
import { eur, fechaCorta } from '../../lib/format';
import muestra from '../../data/muestra-portada.json';
import './Portada.css';

/**
 * LA PORTADA ES UN TICKET.
 *
 * De cinco primeras pantallas comparadas —titular con una línea de prueba, la
 * cifra sola, el ticket, la pregunta con el deslizador, y la semana como
 * gráfico de barras— esta sale de mezclar dos:
 *
 *   · la ESTRUCTURA del ticket, porque hace que la prueba y la promesa sean el
 *     mismo objeto. Era el problema que quedaba abierto en la versión
 *     anterior: enseñaba el precio de una bandeja de pollo y no había manera de
 *     decir por qué. Aquí no hay nada que explicar — un ticket con su total
 *     dice a la vez "sé precios de productos concretos" y "esto es lo que te va
 *     a costar comer".
 *
 *   · la JERARQUÍA de la cifra sola. La escala del proyecto dice que la 56 "se
 *     reserva al total de la semana", y el total de este ticket ES un total de
 *     semana: junto con la pantalla Semana, es el único sitio donde ese tamaño
 *     está en su lugar. La portada anterior incumplía la regla de que la cifra
 *     en euros es el elemento más grande de la pantalla — el suyo era un
 *     párrafo de cuatro líneas.
 *
 * Descartados con razón, no por gusto: el gráfico de los siete días, porque con
 * precios de 7,96 a 9,60 € las barras salen todas iguales y era decoración con
 * forma de dato; y la pregunta con el deslizador, porque ahorra un toque pero
 * enseña el coste por persona antes de saber cuántas personas hay, y no dice en
 * ningún momento qué es esto.
 *
 * Tres líneas y "y N productos más", no cinco: esta pantalla solo tiene que
 * conseguir un toque y cada línea es una oportunidad de no darlo.
 *
 * El ticket lo genera el MISMO motor que la app (ver EJEMPLO en
 * catalogo/generar.ts), así que es un ticket que la app sabe producir y no una
 * maqueta con cifras bonitas. Y no se lee motor-datos.json aquí: son 289 KB
 * parseados antes del primer pintado, y el porcentaje que llega a ver su menú
 * es la métrica que decide el producto.
 */
const { ticket } = muestra;

const Portada: React.FC = () => {
  const history = useHistory();

  return (
    <IonPage>
      <IonContent fullscreen scrollY={false} className="pantalla-content">
        <div className="pantalla pantalla--onboarding portada">
          <div className="portada__rollo">
            {/* El SVG lleva el texto convertido a trazados, así que no depende
                de que la fuente haya cargado. */}
            <img className="portada__marca" src="/cunde-logotipo.svg" alt="Cunde" />
            {/* La cabecera lleva fecha y comensales porque un total sin ellos no
                afirma nada: 61,92 € para dos y para cinco son dos cosas
                distintas. */}
            <span className="portada__rollo-fuente">
              MERCADONA · {fechaCorta(muestra.capturadoEn)} · {ticket.personas} PERSONAS
            </span>

            <div className="portada__lineas">
              {ticket.lineas.map((l) => (
                <div className="portada__linea" key={l.nombre}>
                  <span className="portada__linea-nombre">{l.nombre}</span>
                  <span className="portada__linea-detalle">
                    <span>{l.formato}</span>
                    <span className="portada__linea-guia" />
                    <span>{eur(l.precio)}</span>
                  </span>
                </div>
              ))}
              <div className="portada__linea portada__linea--resto">
                <span className="portada__linea-detalle">
                  <span>y {ticket.restoProductos} productos más</span>
                  <span className="portada__linea-guia" />
                  <span>{eur(ticket.restoImporte)}</span>
                </span>
              </div>
            </div>

            <div className="portada__total">
              {/* Rótulo encima y cifra debajo, como en la pantalla Semana. Al
                  lado, en 360 px de ancho la etiqueta se partía en tres líneas
                  peleando por el sitio con una cifra de 56 px. */}
              <span className="portada__total-etiqueta">TOTAL · {ticket.comidas} COMIDAS</span>
              <span className="portada__total-cifra">{eur(ticket.total)}</span>
            </div>
          </div>

          <div className="portada__acciones">
            {/* El titular va DEBAJO del ticket. El objeto ya ha dicho de qué va
                esto; aquí solo queda decirle al usuario qué tiene que hacer.

                "Tú pones el presupuesto. Yo cuadro la semana." era simétrico y
                sonaba bien, pero no decía qué recibe: "cuadrar la semana" no es
                un entregable, es una metáfora. El titular nombra las dos cosas
                que se lleva —las comidas y la lista— porque la segunda es la
                única que la competencia gratuita no puede dar con precios de
                verdad. Y "tope" en vez de "presupuesto": es más corto, es la
                palabra que usa la gente, y dice que es un techo. */}
            <h1 className="portada__titular">
              Tú pones el tope. Yo pongo las {ticket.comidas} comidas y la lista.
            </h1>
            <PrimaryButton onClick={() => history.push('/onboarding/super')}>Empezar</PrimaryButton>
            <span className="portada__nota">Sin registro. Sin tarjeta.</span>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Portada;
