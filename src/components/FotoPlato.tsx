import './FotoPlato.css';

/**
 * LA FOTO DEL PLATO.
 *
 * Fotos de móvil hechas cocinando de verdad, sin producción. Es lo único que
 * ninguna máquina puede fingir y lo que ningún competidor tiene: los suyos son
 * de estudio y se nota. Nada de banco de imágenes ni generadas — eso es
 * exactamente lo que hace que algo parezca MÁS generado.
 *
 * CUADRADA porque son fotos de mano alzada: el cuadrado perdona el encuadre y
 * no obliga a acertar la proporción al disparar. Se recorta con object-fit, así
 * que da igual si la original viene vertical.
 *
 * Y si no hay foto, este componente no existe: quien llama no pinta nada. No
 * hay marco vacío ni cuadrado gris — un hueco reservado es peor que ninguna
 * imagen, porque promete algo que no está.
 */
const FotoPlato: React.FC<{ foto?: string; alt: string }> = ({ foto, alt }) => {
  if (!foto) return null;
  return (
    <figure className="foto-plato">
      <img src={`/recetas/${foto}`} alt={alt} loading="lazy" decoding="async" />
    </figure>
  );
};

export default FotoPlato;
