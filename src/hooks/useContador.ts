import { useCallback, useEffect, useRef } from 'react';
import { eur } from '../lib/format';

interface OpcionesContador {
  decimales?: number;
  duracionMs?: number;
  formatear?: (valor: number) => string;
}

/**
 * Anima un número hacia `valor` escribiendo directamente en el nodo vía rAF,
 * sin pasar por useState (evita repintar el árbol de React en cada frame).
 *
 * Usa un callback ref: si el <span> aparece/desaparece del DOM (p. ej. una
 * pantalla condicional que se monta más tarde), pinta el valor actual al
 * momento de montarse en vez de depender de que `valor` cambie para hacerlo.
 */
export function useContador(valor: number, opciones: OpcionesContador = {}) {
  const { decimales = 2, duracionMs = 400, formatear = (n: number) => eur(n, decimales) } = opciones;
  const nodoRef = useRef<HTMLSpanElement | null>(null);
  const mostradoRef = useRef(valor);
  const frameRef = useRef<number | undefined>(undefined);
  const formatearRef = useRef(formatear);
  formatearRef.current = formatear;

  const asignarNodo = useCallback((nodo: HTMLSpanElement | null) => {
    nodoRef.current = nodo;
    if (nodo) {
      mostradoRef.current = valor;
      nodo.textContent = formatearRef.current(valor);
    }
    // Solo debe ejecutarse al montar/desmontar el nodo, no en cada cambio de valor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const nodo = nodoRef.current;
    if (!nodo || mostradoRef.current === valor) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      mostradoRef.current = valor;
      nodo.textContent = formatearRef.current(valor);
      return;
    }

    const inicio = mostradoRef.current;
    const delta = valor - inicio;
    const tInicio = performance.now();

    if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);

    const paso = (ahora: number) => {
      const progreso = Math.min(1, (ahora - tInicio) / duracionMs);
      const suavizado = 1 - Math.pow(1 - progreso, 3);
      const actual = inicio + delta * suavizado;
      mostradoRef.current = actual;
      if (nodo.isConnected) nodo.textContent = formatearRef.current(actual);
      if (progreso < 1) {
        frameRef.current = requestAnimationFrame(paso);
      }
    };
    frameRef.current = requestAnimationFrame(paso);

    return () => {
      if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
    };
  }, [valor, duracionMs]);

  return asignarNodo;
}
