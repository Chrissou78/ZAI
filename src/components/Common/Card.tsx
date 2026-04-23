import React from 'react';
import styles from './Card.module.css';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'outlined';
  children: React.ReactNode;
  className?: string;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', children, className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`zai-card zai-card--${variant} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
export default Card;
