import { useRef, useState } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { useAppState } from '../../state/AppStateContext';
import ElegirSuper, { ZONA_CARGADA } from '../../components/ElegirSuper';
import PrimaryButton from '../../components/PrimaryButton';
import Stepper from '../../components/Stepper';
import { esCodigoPostal, limpiarCodigoPostal } from '../../lib/codigoPostal';
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
 *
 * ═══ EL CÓDIGO POSTAL VUELVE, Y ES OBLIGATORIO ═══
 *
 * Se fue porque no cambiaba nada, y sigue sin cambiar nada: los precios son los
 * de Madrid se ponga lo que se ponga. Vuelve porque sin él no se sabe dónde hay
 * usuarios, y eso es lo que decide qué almacenes merecen catálogo propio.
 *
 * Como se pide a cambio de nada visible, la pantalla lo dice: la nota de debajo
 * cuenta de dónde son los precios hoy. Pedir un dato y callar que todavía no
 * sirve sería la cifra que miente, pero en letra pequeña.
 *
 * Va ARRIBA, antes que las cadenas, por el teclado: esta pantalla no hace
 * scroll, y un campo al fondo queda debajo del teclado en cuanto se toca.
 */
const Super: React.FC = () => {
  const history = useHistory();
  const { estado, dispatch } = useAppState();
  const { super: superElegido, codigoPostal } = estado.perfil;
  const [pedida, setPedida] = useState<string | null>(null);
  const [cp, setCp] = useState(codigoPostal ?? '');
  const [falta, setFalta] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  const valido = esCodigoPostal(cp);

  const escribir = (texto: string) => {
    const limpio = limpiarCodigoPostal(texto);
    setCp(limpio);
    setFalta(false);
    // Solo se guarda uno entero: medio código postal en el estado no es un dato.
    dispatch({
      type: 'SET_CODIGO_POSTAL',
      codigoPostal: esCodigoPostal(limpio) ? limpio : null,
      almacen: null,
    });
  };

  const seguir = () => {
    if (!valido) {
      setFalta(true);
      campo.current?.focus();
      return;
    }
    history.push('/onboarding/datos');
  };

  return (
    <IonPage>
      <IonContent fullscreen scrollY={false} className="pantalla-content">
        <div className="pantalla pantalla--onboarding super">
          <Stepper paso={1} />

          <div className="super__cuerpo">
            <h1 className="super__pregunta">¿Dónde compras?</h1>

            <label className="super__cp">
              <span className="super__cp-rotulo">Tu código postal</span>
              <input
                ref={campo}
                className="super__cp-input"
                type="text"
                inputMode="numeric"
                autoComplete="postal-code"
                enterKeyHint="done"
                maxLength={5}
                placeholder="28001"
                value={cp}
                aria-invalid={falta}
                aria-describedby="super-cp-nota"
                onChange={(e) => escribir(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              />
            </label>
            <p id="super-cp-nota" className={`super__cp-nota${falta ? ' super__cp-nota--falta' : ''}`} role={falta ? 'alert' : undefined}>
              {falta
                ? 'Pon tu código postal, con sus cinco cifras.'
                : `Hoy los precios son los de ${ZONA_CARGADA}. Con tu código sé qué zona cargar después.`}
            </p>

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
            {/* `aria-disabled` y no `disabled`, como las cadenas sin catálogo:
                tocarlo sin código SÍ hace algo — dice qué falta y lleva al campo. */}
            <PrimaryButton aria-disabled={!valido} onClick={seguir}>Seguir</PrimaryButton>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Super;
