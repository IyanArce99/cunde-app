/**
 * Los SVG del diseño, inline y sin librería de iconos.
 *
 * `aria-hidden` en todos: nunca van solos. El de Apple y el de Google Play
 * acompañan a un texto que ya dice «App Store» y «Google Play», y el de
 * compartir vive dentro de un mockup decorativo. Un `<title>` aquí haría que un
 * lector de pantalla leyera la marca dos veces.
 */

export function IconoApple({ tam = 22, color = '#fff' }: { tam?: number; color?: string }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill={color} aria-hidden="true">
      <path d="M16.5 12.6c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.6-1.3-.1-2.5.8-3.1.8-.6 0-1.6-.7-2.7-.7-1.4 0-2.7.8-3.4 2-1.5 2.5-.4 6.3 1 8.4.7 1 1.5 2.1 2.6 2.1 1 0 1.4-.7 2.7-.7 1.2 0 1.6.7 2.7.6 1.1 0 1.8-1 2.5-2 .8-1.2 1.1-2.3 1.1-2.3s-2.2-.8-2.2-3.2zM14.5 6.3c.6-.7 1-1.7.9-2.6-.8 0-1.9.6-2.5 1.3-.5.6-1 1.6-.9 2.5.9.1 1.9-.5 2.5-1.2z" />
    </svg>
  );
}

/** El de Google Play va a cuatro colores siempre: es marca registrada. */
export function IconoGooglePlay({ tam = 22 }: { tam?: number }) {
  return (
    <svg width={tam * 0.91} height={tam} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.6 2.3c-.2.2-.3.5-.3.9v17.6c0 .4.1.7.3.9l11.3-9.7L3.6 2.3z" fill="#4285F4" />
      <path d="M18.5 8.9l-3.6-2.1L11.2 10l3.7 3.2 3.6-2.1c1.1-.6 1.1-1.6 0-2.2z" fill="#FBBC04" />
      <path d="M3.6 2.3L14.9 12l-3.7-3.2L3.6 2.3z" fill="#34A853" />
      <path d="M3.6 21.7L14.9 12l-3.7 3.2-7.6 6.5z" fill="#EA4335" />
    </svg>
  );
}

export function IconoCompartir() {
  return (
    <svg
      width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#41434A"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
    </svg>
  );
}

export function IconoFlechaAbajo() {
  return (
    <svg
      width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2E5BFF"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    >
      <path d="M12 5v14M6 13l6 6 6-6" />
    </svg>
  );
}

export function IconoAspa() {
  return (
    <svg
      width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9A9BA0"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function IconoLineas() {
  return (
    <svg
      width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#41434A"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    >
      <path d="M4 6h16M4 12h16M4 18h10" />
    </svg>
  );
}
