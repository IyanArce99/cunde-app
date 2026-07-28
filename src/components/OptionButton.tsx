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
    <button className={clase} onClick={onClick} type="button">
      {label}
    </button>
  );
};

export default OptionButton;
