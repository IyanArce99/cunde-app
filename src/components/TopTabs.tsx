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
    <div className="top-tabs">
      <button
        ref={activo === 'semana' ? activoRef : undefined}
        className={`top-tabs__tab${activo === 'semana' ? ' top-tabs__tab--activo' : ''}`}
        onClick={() => history.push('/semana')}
      >
        SEMANA
      </button>
      <button
        ref={activo === 'compra' ? activoRef : undefined}
        className={`top-tabs__tab${activo === 'compra' ? ' top-tabs__tab--activo' : ''}`}
        onClick={() => history.push('/compra')}
      >
        COMPRA
      </button>
    </div>
  );
};

export default TopTabs;
