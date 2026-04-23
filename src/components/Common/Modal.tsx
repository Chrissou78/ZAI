import React, { useEffect } from 'react';
import styles from './Modal.module.css';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  closeOnClickOutside?: boolean;
}

const Modal = React.forwardRef<HTMLDivElement, ModalProps>(
  (
    {
      isOpen,
      onClose,
      title,
      subtitle,
      children,
      size = 'md',
      closeOnClickOutside = true,
    },
    ref
  ) => {
    // Close on escape key
    useEffect(() => {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && isOpen) {
          onClose();
        }
      };

      if (isOpen) {
        document.addEventListener('keydown', handleEscape);
        document.body.style.overflow = 'hidden';
      }

      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.body.style.overflow = 'unset';
      };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
      <div className="zai-modal-overlay" onClick={(e) => {
        if (closeOnClickOutside && e.target === e.currentTarget) {
          onClose();
        }
      }}>
        <div ref={ref} className={`zai-modal zai-modal--${size}`}>
          {/* Header */}
          {(title || subtitle) && (
            <div className="zai-modal-header">
              <div>
                {title && <h2 className="zai-modal-title">{title}</h2>}
                {subtitle && <p className="zai-modal-subtitle">{subtitle}</p>}
              </div>
              <button
                className="zai-modal-close"
                onClick={onClose}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>
          )}

          {/* Body */}
          <div className="zai-modal-body">
            {children}
          </div>
        </div>
      </div>
    );
  }
);

Modal.displayName = 'Modal';
export default Modal;
