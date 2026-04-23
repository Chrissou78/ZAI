import React from 'react';

export interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
  message?: string;
}

const Loading: React.FC<LoadingProps> = ({ 
  size = 'md', 
  fullScreen = false, 
  message 
}) => {
  const sizeMap = {
    sm: '24px',
    md: '40px',
    lg: '64px',
  };

  return (
    <div
      style={{
        ...(fullScreen && {
          position: 'fixed',
          inset: 0,
          background: 'rgba(255, 255, 255, 0.95)',
          zIndex: 9999,
        }),
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        padding: '2rem',
      }}
    >
      <div
        style={{
          width: sizeMap[size],
          height: sizeMap[size],
          border: '3px solid #e0ddd6',
          borderTopColor: '#7D1E2C',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      {message && (
        <p
          style={{
            fontSize: '14px',
            color: '#6a6a6a',
            margin: 0,
          }}
        >
          {message}
        </p>
      )}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Loading;
