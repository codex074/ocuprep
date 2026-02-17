import type { ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
  variant?: 'default' | 'clean';
}

export default function Modal({ isOpen, onClose, title, children, footer, width, variant = 'default' }: ModalProps) {
  const isClean = variant === 'clean';

  return (
    <div className={`modal-overlay${isOpen ? ' show' : ''}`} onClick={onClose}>
      <div 
        className={`modal ${isClean ? 'clean' : ''}`} 
        style={{ 
          width: width ? width : undefined,
          background: isClean ? 'transparent' : undefined,
          boxShadow: isClean ? 'none' : undefined,
          border: isClean ? 'none' : undefined,
          padding: isClean ? 0 : undefined
        }} 
        onClick={e => e.stopPropagation()}
      >
        {!isClean && (
          <div className="modal-header">
            <h3>{title}</h3>
            <button className="modal-close" onClick={onClose}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}
        
        {isClean ? children : <div className="modal-body">{children}</div>}
        
        {!isClean && footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
