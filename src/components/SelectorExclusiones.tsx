import { useMemo, useState } from 'react';
import { ALERGIAS, DIETAS } from '../lib/restricciones';
import { recetasQueTeValen, POCAS_RECETAS, TOTAL_RECETAS } from '../lib/consecuencias';
import './SelectorExclusiones.css';

/**
 * Para comparar en el buscador: minúsculas y sin tildes.
 *
 * Nadie escribe "sésamo" con tilde en un campo de búsqueda, y quedarse sin
 * resultados por eso en la pantalla que decide qué come alguien con una
 * alergia no es una molestia de usabilidad.
 */
const normalizar = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

const ALERGENOS = new Set(ALERGIAS);
const TODAS = [...ALERGIAS, ...DIETAS];

interface SelectorExclusionesProps {
  valor: string[];
  onCambiar: (exclusiones: string[]) => void;
}

/**
 * QUÉ SE QUEDA FUERA DEL MENÚ.
 *
 * Vivía dentro de la hoja de ajustes, pero la misma pregunta se hace antes de
 * generar la primera semana, y una alergia contestada en un sitio tiene que
 * verse igual en el otro. Duplicar el marcado habría sido peor que compartirlo:
 * el día que se añada un alérgeno, aparecería en una pantalla y en la otra no.
 *
 * ═══ CHIPS PARA AÑADIR, FILAS PARA LO ELEGIDO ═══
 *
 * No son dos formas de lo mismo. El chip es un objetivo pequeño y barato para
 * una lista larga que se recorre con el ojo. La fila es para lo que ya está
 * dentro, y ahí hace falta sitio para dos cosas que el chip no puede llevar:
 * si eso es alergia o gusto, y cuántas recetas se lleva por delante.
 *
 * ═══ POR QUÉ VAN LOS DOS, CAMPO Y PARRILLA ═══
 *
 * El buscador es mejor para AÑADIR: escribes tres letras y ya está, en vez de
 * barrer quince chips. Pero buscar exige SABER QUÉ BUSCAR, y quien no recuerda
 * que el sulfito le sienta mal deja de verlo. Esto decide qué come alguien con
 * una alergia: no puede depender de la memoria. Con el campo vacío la parrilla
 * está entera y se recorre con el ojo.
 *
 * ═══ LA RAZÓN SE DEDUCE, NO SE PREGUNTA ═══
 *
 * En el prototipo la etiqueta "alergia / no me gusta" es un botón que el
 * usuario cambia. Aquí sale de la lista a la que pertenece cada cosa, y no se
 * puede tocar. Motivo: al motor le da exactamente igual —filtra igual en los
 * dos casos—, así que lo único que decide esa etiqueta es si sale el aviso de
 * "comprueba la etiqueta". Y ese aviso es más barato de más que de menos.
 * Poder marcar el gluten como "no me gusta" solo sirve para apagarse a sí mismo
 * un aviso de seguridad alimentaria.
 */
const SelectorExclusiones: React.FC<SelectorExclusionesProps> = ({ valor, onCambiar }) => {
  const [busqueda, setBusqueda] = useState('');

  const alternar = (nombre: string) =>
    onCambiar(valor.includes(nombre) ? valor.filter((d) => d !== nombre) : [...valor, nombre]);

  const disponibles = TODAS.filter((o) => !valor.includes(o));
  const q = normalizar(busqueda);
  const sugeridos = disponibles.filter((o) => normalizar(o).includes(q));

  /* Lo que se lleva por delante cada exclusión: recetas vivas con ella quitada
     frente a recetas vivas sin ella. Es el único número que dice si "sin
     gluten" cuesta cuatro recetas o cuarenta, y sin él quitar cosas parece
     gratis hasta que el menú sale pobre. */
  const resta = useMemo(() => {
    const conTodo = recetasQueTeValen(valor);
    return Object.fromEntries(
      valor.map((e) => [e, recetasQueTeValen(valor.filter((o) => o !== e)) - conTodo]),
    );
  }, [valor]);

  const vivas = recetasQueTeValen(valor);
  const hayAlergia = valor.some((e) => ALERGENOS.has(e));

  return (
    <div className="fuera">
      <p className="fuera__intro">
        Todo entra por defecto. Añade solo lo que no coméis, sea por alergia o porque no os gusta.
      </p>

      <input
        className="fuera__buscador"
        type="search"
        value={busqueda}
        placeholder="Busca: gluten, pescado, cerdo…"
        aria-label="Buscar entre lo que no comes"
        onChange={(e) => setBusqueda(e.target.value)}
      />

      {sugeridos.length > 0 && (
        <div className="fuera__chips">
          {sugeridos.map((o) => (
            <button key={o} type="button" className="fuera__chip" onClick={() => alternar(o)}>
              <span className="fuera__chip-mas" aria-hidden="true">+</span> {o}
            </button>
          ))}
        </div>
      )}

      {busqueda.trim() !== '' && sugeridos.length === 0 && (
        /* Salida, no callejón: se dice qué se puede hacer, no solo que no hay
           nada. */
        <p className="fuera__vacio">
          No filtro «{busqueda.trim()}». Borra la búsqueda para ver la lista entera.
        </p>
      )}

      <div className="fuera__lista">
        {valor.length === 0 ? (
          <p className="fuera__nada">Nada fuera. Coméis de todo.</p>
        ) : (
          valor.map((e) => (
            <div key={e} className="fuera__fila">
              <span className="fuera__fila-texto">
                <span className="fuera__fila-nombre">{e}</span>
                <span className="fuera__fila-resta">
                  {resta[e] === 0 ? 'no quita ninguna receta' : `quita ${resta[e]} recetas`}
                </span>
              </span>
              <span className={`fuera__razon${ALERGENOS.has(e) ? ' fuera__razon--alergia' : ''}`}>
                {ALERGENOS.has(e) ? 'alergia' : 'por dieta'}
              </span>
              <button
                type="button"
                className="fuera__quitar"
                aria-label={`Quitar ${e}`}
                onClick={() => alternar(e)}
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>

      {hayAlergia && (
        <div className="fuera__alergia">
          <span className="fuera__alergia-rotulo">Alergia marcada</span>
          <p className="fuera__alergia-texto">
            Quito estos ingredientes de tus recetas y de la lista. Comprueba siempre la etiqueta: los
            fabricantes cambian los ingredientes.
          </p>
        </div>
      )}

      {/* En tinta y no en rojo: quitar cosas no es un error, es lo que ha
          pedido. Dice lo único que cambia de verdad, que es repetir plato. */}
      {vivas < POCAS_RECETAS && (
        <p className="fuera__pocas">Con tan pocas recetas vas a repetir plato en la semana.</p>
      )}

      <div className="fuera__recuento">
        <span className="fuera__recuento-texto">Recetas que te valen</span>
        <span className="fuera__recuento-cifra">
          {vivas}
          <span className="fuera__recuento-total"> de {TOTAL_RECETAS}</span>
        </span>
      </div>
    </div>
  );
};

export default SelectorExclusiones;
