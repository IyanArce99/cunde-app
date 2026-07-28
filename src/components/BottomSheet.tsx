import type { ReactNode } from 'react';
import './BottomSheet.css';

interface BottomSheetProps {
  children: ReactNode;
  onDismiss?: () => void;
}

const BottomSheet: React.FC<BottomSheetProps> = ({ children, onDismiss }) => {
  return (
    <div className="bottom-sheet__velo" onClick={onDismiss}>
      <div className="bottom-sheet__hoja" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
};

export default BottomSheet;
