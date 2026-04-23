import React from 'react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
}) => {
  return (
    <div
      style={{
        padding: '3.5rem 2rem',
        textAlign: 'center',
        border: '1px dashed #e0ddd6',
        background: '#f0ede6',
        borderRadius: '8px',
      }}
    >
      {icon && (
        <div
          style={{
            width: '56px',
            height: '56px',
            border: '1px solid #e0ddd6',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem',
            fontSize: '24px',
          }}
        >
          {icon}
        </div>
      )}
      <h3
        style={{
          fontSize: '16px',
          fontWeight: 300,
          margin: '0 0 0.5rem',
          color: '#1a1a1a',
        }}
      >
        {title}
      </h3>
      {description && (
        <p
          style={{
            fontSize: '13px',
            color: '#6a6a6a',
            maxWidth: '360px',
            margin: '0 auto 1.5rem',
            lineHeight: '1.8',
          }}
        >
          {description}
        </p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
};

export default EmptyState;
