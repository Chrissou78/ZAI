import React from 'react';

interface UserAvatarProps {
  firstName?: string;
  lastName?: string;
  size?: 'sm' | 'md' | 'lg';
}

const UserAvatar: React.FC<UserAvatarProps> = ({ firstName = 'U', lastName = '', size = 'sm' }) => {
  const initials = `${(firstName || 'U')[0]}${(lastName || '')[0] || ''}`.toUpperCase();

  const sizeMap = {
    sm: { width: '32px', height: '32px', fontSize: '9px' },
    md: { width: '40px', height: '40px', fontSize: '12px' },
    lg: { width: '80px', height: '80px', fontSize: '20px' },
  };

  const dimensions = sizeMap[size];

  return (
    <div
      style={{
        width: dimensions.width,
        height: dimensions.height,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #4a4030 0%, #2a2015 100%)',
        border: `1px solid #b8a06a`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: dimensions.fontSize,
        color: '#b8a06a',
        flexShrink: 0,
        fontWeight: 300,
        boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
      }}
    >
      {initials}
    </div>
  );
};

export default UserAvatar;
