import { EXCLUSIONES_ALERGIA } from '../motor/seleccionar.ts';
import './AvisoAlergenos.css';

/** Las exclusiones activas que son de salud, no de gusto. */
export function alergiasActivas(exclusiones: string[]): string[] {
  return exclusiones.filter((e) => EXCLUSIONES_ALERGIA.includes(e));
}

/**
 * El sistema de alérgenos dejó de ser una preferencia y pasó a ser una
 * funcionalidad de seguridad, y su base son datos raspados de una web. Los
 * agujeros son conocidos: 19 SKU sin lista de ingredientes (fresco a granel,
 * cubiertos solo por la red por nombre), dos canónicos sin entrada de EAN,
 * fabricantes que reformulan y Mercadona que sustituye referencias sin
 * avisar. El primer parser dio 37 falsos positivos.
 *
 * Con eso detrás no se le puede decir a alguien alérgico al cacahuete que su
 * semana es segura y callarse.
 *
 * Va donde está el riesgo —el súper y el momento de cocinar—, no en ajustes.
 * Y solo con filtros de ALERGIA: a quien excluye el cerdo por gusto este
 * aviso no le dice nada y le gasta la atención.
 *
 * Es una advertencia, no un error: nada de rojo ni de iconos de alerta. Una
 * franja de papel, que es lo que es.
 *
 * ═══ EN COMPRA VA EN UNA LÍNEA ═══
 *
 * Dentro de una hoja hay sitio y se dice entero. En Compra no: ahí la franja se
 * comía 150 px FIJOS de la cabecera —dos productos menos a la vista— en la
 * pantalla que se recorre de pie, con una mano y empujando un carro, y en cada
 * visita, no una vez.
 *
 * Lo que se recorta es "los fabricantes cambian los ingredientes", que es la
 * JUSTIFICACIÓN. Lo que se conserva es "comprueba la etiqueta", que es la
 * INSTRUCCIÓN, y es lo único que hay que hacer delante del lineal. El motivo
 * entero sigue escrito donde se marca la alergia (ver SelectorExclusiones), que
 * es donde el usuario tiene tiempo de leerlo.
 */
const AvisoAlergenos: React.FC<{ exclusiones: string[]; compacto?: boolean }> = ({ exclusiones, compacto }) => {
  const alergias = alergiasActivas(exclusiones);
  if (!alergias.length) return null;

  return (
    <div className={`aviso-alergenos${compacto ? ' aviso-alergenos--compacto' : ''}`} role="note">
      <span className="aviso-alergenos__que">Sin {alergias.join(', ').toLowerCase()}</span>
      <span className="aviso-alergenos__texto">
        Comprueba siempre la etiqueta.
        {compacto && ' Los fabricantes cambian los ingredientes.'}
      </span>
    </div>
  );
};

export default AvisoAlergenos;
