/**
 * ═══ TRAMOS, NO CIFRAS ═══
 *
 * La analítica necesita patrones; el importe exacto de la compra de alguien no
 * es un patrón, es su compra. Un presupuesto de 63,27 € junto a un número de
 * semana y una plataforma empieza a señalar a una persona concreta, y esa
 * información ya la tiene el usuario en su móvil: no hace falta una segunda
 * copia en un servidor.
 *
 * Los tramos viven aquí y solo aquí. Repartidos por los componentes, a la
 * tercera semana habría tres definiciones distintas de «poco» y las consultas
 * de SQL dejarían de poder agrupar.
 */

/** Presupuesto semanal. Los cortes son los del deslizador del onboarding. */
export function tramoPresupuesto(euros: number): string {
  if (!Number.isFinite(euros) || euros <= 0) return 'desconocido';
  if (euros < 30) return '<30';
  if (euros < 50) return '30-50';
  if (euros < 75) return '50-75';
  if (euros < 100) return '75-100';
  if (euros < 150) return '100-150';
  return '150+';
}

/**
 * Cuánto se desvió el ticket real de lo previsto, en porcentaje y con signo.
 *
 * Con signo a propósito: pasarse 8% y ahorrar 8% son resultados opuestos para
 * el producto —uno es una promesa incumplida y el otro un margen— y un tramo
 * sin signo los mezclaría en la misma celda.
 */
export function tramoDiferencia(previsto: number, pagado: number): string {
  if (!Number.isFinite(previsto) || previsto <= 0 || !Number.isFinite(pagado)) return 'desconocido';
  const pct = ((pagado - previsto) / previsto) * 100;
  const signo = pct < 0 ? '-' : '+';
  const abs = Math.abs(pct);
  if (abs < 2) return 'clavado';
  if (abs < 5) return `${signo}2-5pct`;
  if (abs < 10) return `${signo}5-10pct`;
  if (abs < 20) return `${signo}10-20pct`;
  return `${signo}20pct+`;
}

/** Lo que cambia un precio real respecto al del catálogo. Mismo criterio. */
export function tramoDeltaPrecio(esperado: number, real: number): string {
  if (!Number.isFinite(esperado) || esperado <= 0 || !Number.isFinite(real)) return 'desconocido';
  const pct = ((real - esperado) / esperado) * 100;
  const signo = pct < 0 ? '-' : '+';
  const abs = Math.abs(pct);
  if (abs < 1) return 'igual';
  if (abs < 10) return `${signo}0-10pct`;
  if (abs < 25) return `${signo}10-25pct`;
  return `${signo}25pct+`;
}
