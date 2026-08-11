import './PanelAjustar.css';

/**
 * LA HOJA «AJUSTAR LA SEMANA», SOBRE LA SECCIÓN OSCURA.
 *
 * Reproduce el panel real de la app, con los mismos controles y en el mismo
 * orden: Empieza · Sois · Tu tope · Variedad · Proteína · Guardar.
 *
 * Las cifras son las que da el motor: 63,77 € con «sube 3,73 €» respecto a la
 * cesta anterior, y la variedad enseñando 63,77 € «repites 4 platos» contra
 * 59,88 € «nunca repites plato». Esa segunda pareja es literal de la app y dice
 * algo incómodo a propósito —la opción que no repite sale MÁS BARATA— porque es
 * lo que mide el motor. Cambiarla aquí para que «cuadre» sería la primera
 * mentira de la página.
 *
 * `aria-hidden`: es una ilustración. Lo que hay que leer son los tres checks de
 * al lado, que sí son texto.
 */
export default function PanelAjustar() {
  return (
    <div className="panel" aria-hidden="true">
      <div className="panel__cabecera">
        <span className="panel__titulo">AJUSTAR LA SEMANA</span>
        <span className="panel__cerrar">✕</span>
      </div>

      <div className="panel__cesta">
        <div className="panel__rotulo">TU CESTA</div>
        <div className="panel__cesta-fila">
          <span className="panel__cifra cifra">
            63,77<span className="panel__euro">€</span>
          </span>
          <span className="panel__delta">sube 3,73 €</span>
        </div>
      </div>

      <div className="panel__empieza">
        <span>
          <span className="panel__empieza-titulo">Empieza</span>
          <span className="panel__empieza-fecha">Hoy · MAR · 11 AGO</span>
        </span>
        <span className="panel__chevron">›</span>
      </div>

      <div className="panel__seccion panel__seccion--punteada">
        <div className="panel__etiqueta">Sois</div>
        <div className="panel__comensales">
          {['1', '2', '3', '4', '5+'].map((n) => (
            <div key={n} className={`panel__comensal${n === '2' ? ' panel__comensal--activo' : ''}`}>{n}</div>
          ))}
        </div>
      </div>

      <div className="panel__seccion">
        <div className="panel__etiqueta">Tu tope</div>
        <div className="panel__tope">
          <span className="panel__tope-cifra cifra">65</span>
          <span className="panel__tope-euro">€</span>
          <span className="panel__tope-nota">a la semana · 4,64 € por persona y día</span>
        </div>
        <div className="panel__carril">
          <div className="panel__carril-recorrido" />
          <div className="panel__pulgar" />
        </div>
        <div className="panel__extremos">
          <span>AJUSTADO</span>
          <span>HOLGADO</span>
        </div>
      </div>

      <div className="panel__seccion">
        <div className="panel__etiqueta">Variedad</div>
        <div className="panel__opciones panel__opciones--2">
          <div className="panel__opcion panel__opcion--activa">
            <div className="panel__opcion-precio cifra">63,77 €</div>
            <div className="panel__opcion-nota">repites 4 platos</div>
          </div>
          <div className="panel__opcion">
            <div className="panel__opcion-precio cifra">59,88 €</div>
            <div className="panel__opcion-nota panel__opcion-nota--tenue">nunca repites plato</div>
          </div>
        </div>
      </div>

      <div className="panel__seccion">
        <div className="panel__etiqueta">Proteína</div>
        <div className="panel__opciones panel__opciones--3">
          <div className="panel__opcion">
            <div className="panel__opcion-titulo">Básica</div>
            <div className="panel__opcion-nota panel__opcion-nota--tenue">legumbre y huevo</div>
          </div>
          <div className="panel__opcion panel__opcion--activa">
            <div className="panel__opcion-titulo">Normal</div>
            <div className="panel__opcion-nota">carne 3 días</div>
          </div>
          <div className="panel__opcion">
            <div className="panel__opcion-titulo">Alta</div>
            <div className="panel__opcion-nota panel__opcion-nota--tenue">carne casi a diario</div>
          </div>
        </div>
      </div>

      <div className="panel__guardar">Guardar ajustes</div>
    </div>
  );
}
