import type { ButtonHTMLAttributes } from 'react';
import './PrimaryButton.css';

type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: 'azulete' | 'contorno';
};

const PrimaryButton: React.FC<PrimaryButtonProps> = ({ variante = 'azulete', className, ...rest }) => {
  const clase = `primary-button primary-button--${variante}${className ? ' ' + className : ''}`;
  return <button className={clase} {...rest} />;
};

export default PrimaryButton;
