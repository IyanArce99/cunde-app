import './OptionButton.css';

interface OptionButtonProps {
  label: string;
  seleccionado: boolean;
  onClick: () => void;
  variante: 'grid' | 'pill';
}

const OptionButton: React.FC<OptionButtonProps> = ({ label, seleccionado, onClick, variante }) => {
  const clase = `option-button option-button--${variante}${seleccionado ? ' option-button--seleccionado' : ''}`;
  return (
    /* aria-pressed y no role="radio": el mismo recurso que ya usa
       SelectorCoste, y no obliga a montar radiogroup con flechas. Sin él,
       "seleccionado" solo existía como color de borde — un lector de pantalla
       leía los cinco comensales exactamente igual. */
    <button className={clase} onClick={onClick} type="button" aria-pressed={seleccionado}>
      {label}
    </button>
  );
};

export default OptionButton;
