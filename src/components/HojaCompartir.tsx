import { useEffect, useRef, useState } from 'react';
import BottomSheet from './BottomSheet';
import PrimaryButton from './PrimaryButton';
import TicketCompartible from './TicketCompartible';
import { analitica } from '../lib/analitica';
import { tramoDeDiferencia } from '../lib/compartible';
import type { DatosCompartibles } from '../lib/compartible';
import { compartirImagen, puedeDescargar } from '../lib/compartir';
import { pngDelTicket } from '../lib/imagen';
import './HojaCompartir.css';

interface HojaCompartirProps {
  datos: DatosCompartibles;
  onCerrar: () => void;
}

type Estado = 'listo' | 'preparando' | 'error';

/** Qué se dice bajo la previsualización en cada estado. */
const NOTA: Record<Estado, string> = {
  listo: 'Se comparte una imagen. Ni tu presupuesto ni tus platos salen de aquí de otra forma.',
  preparando: 'Preparando la imagen.',
  error: 'No he podido preparar la imagen. Inténtalo otra vez.',
};

/**
 * Lo que dice el botón.
 *
 * En web sin hoja del sistema el resultado es una descarga, y llamarlo
 * «Compartir» sería prometer algo que no pasa: el usuario pulsa, se le baja un
 * fichero y no ha compartido nada. La regla de la casa es que una acción
 * conserva su nombre en todo el recorrido, así que se dice lo que va a ocurrir.
 */
function rotuloBoton(estado: Estado): string {
  if (estado === 'preparando') return 'Preparando…';
  return puedeDescargar() ? 'Guardar la imagen' : 'Compartir';
}

/** Cada final de compartir tiene su evento. Sin ifs encadenados que se leen mal. */
const EVENTO = {
  compartido: 'share_completed',
  descargado: 'share_downloaded',
  cancelado: 'share_dismissed',
  fallo: 'share_image_failed',
} as const;

/**
 * ═══ COMPARTIR ═══
 *
 * Se ve primero, se fabrica después.
 *
 * La previsualización es HTML y aparece al abrir la hoja, sin esperar a nada.
 * El PNG —que en un móvil viejo puede tardar cientos de milisegundos— solo se
 * genera cuando el usuario pulsa. Al revés, la hoja abriría en blanco con un
 * cargador, para una cosa que la mitad de la gente va a cerrar sin usar.
 *
 * ═══ QUÉ SE COMPARTE ═══
 *
 * Una imagen y una frase. Sin enlace: un enlace a nada es una promesa rota, y
 * uno con identificador dentro convierte compartir en rastrear a quien lo
 * recibe. Cuando haya una web que enseñe algo, se añade.
 */
const HojaCompartir: React.FC<HojaCompartirProps> = ({ datos, onCerrar }) => {
  const [estado, setEstado] = useState<Estado>('listo');
  /* Para no llamar a `setState` sobre una hoja que el usuario ya cerró: la
     generación es asíncrona y él puede irse en medio. */
  const vivo = useRef(true);
  useEffect(() => () => { vivo.current = false; }, []);

  const tramo = tramoDeDiferencia(datos);
  const comunes = {
    share_type: datos.tipo,
    has_extras: (datos.extras ?? 0) > 0 || (datos.extrasSinPrecio ?? 0) > 0,
    ...(tramo ? { diff_bucket: tramo } : {}),
  } as const;

  useEffect(() => {
    analitica('share_sheet_opened', comunes);
    // Al abrir, una vez. Las dependencias harían que se repitiera el evento
    // cada vez que el estado cambia dentro de la misma hoja.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const compartir = async () => {
    if (estado === 'preparando') return;
    setEstado('preparando');
    const arranque = performance.now();
    let base64: string;
    try {
      base64 = await pngDelTicket(datos);
    } catch {
      /* Sin canvas no hay imagen y no hay plan B: se dice y se deja la hoja
         abierta con el botón otra vez pulsable. Cerrarla sola dejaría al
         usuario sin saber si compartió o no. */
      if (vivo.current) setEstado('error');
      analitica('share_image_failed', comunes);
      return;
    }
    analitica('share_image_generated', {
      ...comunes,
      generation_ms: Math.round((performance.now() - arranque) / 100) * 100,
    });

    /**
     * «PREPARANDO» ACABA AQUÍ, Y NO CUANDO EL USUARIO ELIGE DÓNDE MANDARLO.
     *
     * Visto en el navegador: con la hoja del sistema abierta, `share()` no
     * resuelve hasta que el usuario elige —y si no hay hoja que abrir, no
     * resuelve NUNCA—. Dejando el estado en «preparando» hasta entonces, el
     * botón se quedaba desactivado y el rótulo decía «Preparando…» para
     * siempre, mintiendo sobre algo que ya había terminado.
     *
     * Y no se arregla con un temporizador: elegir destinatario en WhatsApp
     * puede llevar un minuto legítimamente, así que cualquier plazo o corta
     * comparticiones buenas o no arregla nada. Lo que estaba mal era el
     * alcance del estado: preparar es fabricar la imagen. Eso ya está hecho.
     */
    if (vivo.current) setEstado('listo');

    const { estado: fin } = await compartirImagen(base64, texto(datos));
    if (vivo.current) setEstado(fin === 'fallo' ? 'error' : 'listo');
    analitica(EVENTO[fin], { ...comunes, share_result: fin });

    /* Se cierra al compartir, no al cancelar. Cancelar es «esta no»: dejarle la
       hoja abierta es lo que le permite volver a intentarlo o cerrarla él. */
    if (fin === 'compartido' || fin === 'descargado') onCerrar();
  };

  return (
    <BottomSheet onDismiss={onCerrar}>
      <div className="ajustes__cabecera">
        <span className="ajustes__titulo">COMPARTIR</span>
        <button type="button" className="ajustes__cerrar" aria-label="Cerrar" onClick={onCerrar}>
          ✕
        </button>
      </div>

      <div className="compartir__marco">
        <TicketCompartible datos={datos} />
      </div>

      {/* Región viva para que quien no ve la pantalla se entere de que está
          fabricándose la imagen y de que ha fallado, sin robarle el foco.
          `output` en vez de `role=status`: es el elemento que ya significa
          esto y lo anuncian bien todos los lectores. */}
      <output className="compartir__nota">{NOTA[estado]}</output>

      <PrimaryButton disabled={estado === 'preparando'} onClick={compartir}>
        {rotuloBoton(estado)}
      </PrimaryButton>
    </BottomSheet>
  );
};

/**
 * La frase que acompaña a la imagen.
 *
 * Corta y sin cifras: el importe ya está en la imagen y repetirlo en el texto
 * hace que se cuele en sitios donde la imagen no se ve —una previsualización de
 * notificación, un asunto de correo—. Sin exclamaciones y sin invitación:
 * «¡Descárgate Cunde!» convierte lo que alguien manda a un amigo en publicidad
 * que el amigo no ha pedido, y eso es justo lo que hace que no se comparta.
 */
export function texto(d: DatosCompartibles): string {
  return d.tipo === 'semana' ? 'Mi compra de la semana' : 'Lo que me costó la compra';
}

export default HojaCompartir;
