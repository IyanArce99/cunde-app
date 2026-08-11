import { useState } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { useAppState } from '../../state/AppStateContext';
import ElegirSuper from '../../components/ElegirSuper';
import PrimaryButton from '../../components/PrimaryButton';
import Stepper from '../../components/Stepper';
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
  const { super: superElegido } = estado.perfil;
  const [pedida, setPedida] = useState<string | null>(null);

  return (
    <IonPage>
      <IonContent fullscreen scrollY={false} className="pantalla-content">
        <div className="pantalla pantalla--onboarding super">
          <Stepper paso={1} />

          <div className="super__cuerpo">
            <h1 className="super__pregunta">¿Dónde compras?</h1>
            {/* El subtítulo no adorna: explica por qué esta pantalla existe
                antes que el dinero. Sin él, elegir cadena parece un ajuste de
                perfil y no la fuente de los precios. */}
            <p className="super__sub">Elige una: los precios de la lista salen de su catálogo.</p>

            <ElegirSuper
              valor={superElegido}
              onElegir={(cadena) => {
                setPedida(null);
                dispatch({ type: 'SET_SUPER', super: cadena });
              }}
              onSinCatalogo={setPedida}
            />

            {/* Salida, nunca muro. Tocar Lidl no puede terminar en nada: o se
                dice cuándo llega, o el usuario se queda pensando que la app
                está rota. Y se ofrece lo que sí hay, en la misma frase. */}
            {pedida && (
              <div className="super__aviso" role="status">
                <p className="super__aviso-texto">
                  De {pedida} todavía no tengo catálogo, así que no puedo darte precios reales. Empieza con
                  Mercadona y te aviso cuando esté.
                </p>
              </div>
            )}
          </div>

          <div className="super__pie">
            <PrimaryButton onClick={() => history.push('/onboarding/datos')}>Seguir</PrimaryButton>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Super;
