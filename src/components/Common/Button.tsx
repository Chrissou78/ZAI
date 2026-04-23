import React from 'react';
import styles from './Button.module.css';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'burgundy' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  isLoading?: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      disabled = false,
      isLoading = false,
      fullWidth = false,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`
          zai-button
          zai-button--${variant}
          zai-button--${size}
          ${fullWidth ? 'zai-button--full-width' : ''}
          ${disabled ? 'zai-button--disabled' : ''}
          ${className}
        `}
        {...props}
      >
        {isLoading ? (
          <>
            <span className="zai-spinner" />
            {children}
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
export default Button;
