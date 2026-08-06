import { IonContent, IonPage } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { useAppState } from '../../state/AppStateContext';
import ElegirSuper, { CADENAS_QUE_VIENEN, cpValido } from '../../components/ElegirSuper';
import PrimaryButton from '../../components/PrimaryButton';
import './Super.css';

/**
 * PASO 1 DE 3 · DÓNDE COMPRAS.
 *
 * Esto vivía detrás de una fila tocable en la pantalla del presupuesto
 * ("Súper ···· Mercadona ›") y ahí no funcionaba: una fila con una flecha en
 * una cabecera de ticket no se toca, así que el código postal no se ponía
 * nunca — y sin código postal la lista manda a buscar referencias que la
 * tienda del usuario no usa (ver ElegirSuper.tsx para los datos).
 *
 * Va PRIMERO, y no es un capricho de orden: un ticket empieza por la tienda.
 * La cabecera del rollo de la portada dice "MERCADONA · 28 JUL · 2 PERSONAS",
 * así que la primera línea que se imprime aquí tiene que ser la misma.
 *
 * Cuesta una pantalla de embudo, que es real y va contra la métrica 1. Se paga
 * porque el dato entra en la clase de los que hacen el primer menú
 * INSERVIBLE —la regla de Datos.tsx—: con la zona equivocada, los productos
 * de la lista no existen en el lineal que el usuario tiene delante.
 */
const Super: React.FC = () => {
  const history = useHistory();
  const { estado, dispatch } = useAppState();
  const { super: superElegido, codigoPostal } = estado.perfil;

  // Sin CP se puede seguir: es mejor un menú con precios de Madrid que un
  // muro. Lo que no se puede es medio código postal.
  const puedeSeguir = codigoPostal === null || cpValido(codigoPostal);

  return (
    <IonPage>
      <IonContent fullscreen scrollY={false} className="pantalla-content">
        <div className="pantalla pantalla--onboarding super">
          <div className="super__cabecera">
            <img className="super__marca" src="/cunde-logotipo.svg" alt="Cunde" />
            <span className="super__paso">1/3</span>
          </div>

          <div className="super__cuerpo">
            <h2 className="super__pregunta">¿Dónde compras?</h2>
            <ElegirSuper
              valor={superElegido}
              codigoPostal={codigoPostal}
              onElegir={(cadena) => dispatch({ type: 'SET_SUPER', super: cadena })}
              onCodigoPostal={(cp) => dispatch({ type: 'SET_CODIGO_POSTAL', codigoPostal: cp, almacen: null })}
            />
            {/* Ahora que las cadenas sin catálogo ya no salen como tarjetas,
                esta línea es lo único que dice que vienen — así que las nombra
                todas en vez de tres y "alguna más". La coletilla de "solo doy
                precios de las cadenas cuyo catálogo tengo" se cae: con una sola
                opción en la lista, eso ya no hay que explicarlo. */}
            <p className="super__proximamente">
              {CADENAS_QUE_VIENEN.slice(0, -1).join(', ')} y {CADENAS_QUE_VIENEN.at(-1)}, próximamente.
            </p>
          </div>

          <PrimaryButton disabled={!puedeSeguir} onClick={() => history.push('/onboarding/datos')}>
            Seguir
          </PrimaryButton>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Super;
