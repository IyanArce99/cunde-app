import { IconoApple, IconoGooglePlay } from './Iconos';
import './BotonesStore.css';

/**
 * Los dos botones de descarga. Salen en el hero, en el CTA final y —en móvil—
 * dentro de la sección oscura, así que van en un componente y no copiados tres
 * veces: son el único enlace que de verdad convierte y tienen que decir lo
 * mismo en los tres sitios.
 *
 * `claro` los invierte para la sección oscura del móvil: fondo papel y tinta
 * negra, en vez de al revés.
 *
 * Son `<a>`, no `<div>`: en el prototipo eran divs porque no navegaban a ningún
 * sitio. Aquí tienen que ser enlaces de verdad o no se pueden pulsar con
 * teclado.
 */
export default function BotonesStore({
  tam = 'normal',
  claro = false,
  ancho = false,
}: {
  tam?: 'normal' | 'grande';
  claro?: boolean;
  ancho?: boolean;
}) {
  const clase = [
    'stores',
    tam === 'grande' ? 'stores--grande' : '',
    claro ? 'stores--claro' : '',
    ancho ? 'stores--ancho' : '',
  ].filter(Boolean).join(' ');

  /* TODO al publicar: las URL reales de App Store y Google Play. Se dejan en
     '#' como en el handoff, pero con `aria-disabled` para no prometer un
     destino que todavía no existe. */
  return (
    <div className={clase}>
      <a className="store" href="#" aria-label="Descargar en la App Store">
        <IconoApple tam={tam === 'grande' ? 22 : 20} color={claro ? '#17181A' : '#fff'} />
        <span className="store__texto">
          <span className="store__sobre">Descárgala en</span>
          <span className="store__marca">App Store</span>
        </span>
      </a>
      <a className="store" href="#" aria-label="Descargar en Google Play">
        <IconoGooglePlay tam={tam === 'grande' ? 22 : 20} />
        <span className="store__texto">
          <span className="store__sobre">Disponible en</span>
          <span className="store__marca">Google Play</span>
        </span>
      </a>
    </div>
  );
}
