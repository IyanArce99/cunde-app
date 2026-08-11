import './Stepper.css';

const TOTAL = 3;

/**
 * LA CABECERA DE LOS TRES PASOS: marca, tres segmentos y el número.
 *
 * Sustituye a la cabecera de ticket —logo, "2/3" y un filete discontinuo— que
 * era la firma del diseño anterior. Los segmentos hacen lo que aquella no
 * hacía: decir cuánto queda de un vistazo, sin tener que leer una fracción.
 *
 * Un componente y no tres copias porque el número de pasos va a cambiar en
 * cuanto se añada o se quite una pregunta, y tres cabeceras que se copian a
 * mano se desincronizan a la primera.
 */
const Stepper: React.FC<{ paso: number }> = ({ paso }) => (
  <div className="stepper">
    <span className="stepper__marca">cunde</span>
    {/* Los segmentos son decoración de un dato que ya está escrito al lado, así
        que para un lector de pantalla sobran: se anuncia el "2 de 3" y basta. */}
    <div className="stepper__barras" aria-hidden="true">
      {Array.from({ length: TOTAL }, (_, i) => (
        <span key={i} className={`stepper__barra${i < paso ? ' stepper__barra--hecho' : ''}`} />
      ))}
    </div>
    <span className="stepper__paso" aria-label={`Paso ${paso} de ${TOTAL}`}>
      {paso}/{TOTAL}
    </span>
  </div>
);

export default Stepper;
