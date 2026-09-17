import React from 'react';

interface UserAvatarProps {
  firstName?: string;
  lastName?: string;
  size?: 'sm' | 'md' | 'lg';
  /** Exact pixel size, for the places the three presets do not fit. */
  px?: number;
  /** 'light' for a pale surface (the profile page); 'dark' everywhere else. */
  variant?: 'dark' | 'light';
  imageUrl?: string | null;
}

const UserAvatar: React.FC<UserAvatarProps> = ({
  firstName = 'U', lastName = '', size = 'md', px, variant = 'dark', imageUrl,
}) => {
  const initials = `${(firstName || 'U')[0]}${(lastName || '')[0] || ''}`.toUpperCase();

  const sizeMap = {
    sm: { width: '32px', height: '32px', fontSize: '9px' },
    md: { width: '40px', height: '40px', fontSize: '12px' },
    lg: { width: '80px', height: '80px', fontSize: '20px' },
  };

  const dimensions = px
    ? { width: px + 'px', height: px + 'px', fontSize: Math.round(px * 0.3) + 'px' }
    : sizeMap[size];

  const baseStyle: React.CSSProperties = {
    width: dimensions.width,
    height: dimensions.height,
    borderRadius: '50%',
    border: variant === 'light' ? '2px solid #e0ddd6' : '1px solid #f5f4f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
    letterSpacing: '0.05em',
    fontSize: dimensions.fontSize,
    color: variant === 'light' ? '#1a1a1a' : '#f5f4f0',
    flexShrink: 0,
    fontWeight: 300,
    boxShadow: variant === 'light' ? 'none' : '0 2px 6px rgba(0,0,0,0.5)',
    overflow: 'hidden',
  };

  if (imageUrl) {
    return (
      <div style={{ ...baseStyle, background: '#1a1a1a' }}>
        <img
          src={imageUrl}
          alt={`${firstName} ${lastName}`.trim() || 'Profile'}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        ...baseStyle,
        background: variant === 'light'
          ? '#f0eee9'
          : 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)',
      }}
    >
      {initials}
    </div>
  );
};

export default UserAvatar;
