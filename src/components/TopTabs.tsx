import { useEffect, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import './TopTabs.css';

interface TopTabsProps {
  activo: 'semana' | 'compra';
}

const TopTabs: React.FC<TopTabsProps> = ({ activo }) => {
  const history = useHistory();
  const activoRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Con texto muy grande (zoom / accesibilidad) las dos pestañas pueden no
    // caber a la vez; la barra hace scroll horizontal, así que nos aseguramos
    // de que la pestaña activa esté siempre a la vista sin gesto extra.
    activoRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activo]);

  return (
    /* aria-current y no aria-selected: son navegación entre dos rutas, no un
       widget de pestañas ARIA —que exigiría role="tablist", flechas para
       moverse y un tabpanel asociado, y esto es un enlace con aspecto de
       pestaña. Sin él, la activa se distinguía solo por el subrayado: un
       lector de pantalla anunciaba "SEMANA, botón" en las dos, y quien navega
       a ciegas no sabía dónde estaba. */
    <nav className="top-tabs" aria-label="Semana y compra">
      <button
        type="button"
        ref={activo === 'semana' ? activoRef : undefined}
        className={`top-tabs__tab${activo === 'semana' ? ' top-tabs__tab--activo' : ''}`}
        aria-current={activo === 'semana' ? 'page' : undefined}
        onClick={() => history.push('/semana')}
      >
        SEMANA
      </button>
      <button
        type="button"
        ref={activo === 'compra' ? activoRef : undefined}
        className={`top-tabs__tab${activo === 'compra' ? ' top-tabs__tab--activo' : ''}`}
        aria-current={activo === 'compra' ? 'page' : undefined}
        onClick={() => history.push('/compra')}
      >
        COMPRA
      </button>
    </nav>
  );
};

export default TopTabs;
