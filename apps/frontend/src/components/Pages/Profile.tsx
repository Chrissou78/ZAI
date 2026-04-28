import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import Button from '../Common/Button';
import { apiService } from '../../services/api';

const Profile: React.FC = () => {
  const { user } = useAppContext();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    givenName: user?.givenName || '',
    familyName: user?.familyName || '',
    email: user?.email || '',
    phoneNumber: user?.phoneNumber || '',
    address: user?.address || '',
    city: user?.city || '',
    country: user?.country || '',
    postalCode: user?.postalCode || '',
    birthdate: user?.birthdate || '',
    isPublic: user?.isPublic || false,
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  };

  const handleSave = async () => {
    if (user) {
      setIsLoading(true);
      try {
        const response = await apiService.put('/auth/profile', formData);
        if (response.data?.success) {
          console.log('Profile updated successfully');
          setIsEditing(false);
        }
      } catch (error) {
        console.error('Error updating profile:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  if (!user) {
    return <div style={{ padding: '3rem 4rem' }}>Loading profile...</div>;
  }

  const firstName = user.givenName || 'User';
  const lastName = user.familyName || '';
  const initials = `${firstName[0]}${lastName[0] || ''}`;

  return (
    <div style={{ padding: '3rem 4rem 5rem' }}>
      {/* Header */}
      <div
        style={{
          marginBottom: '2.5rem',
          paddingBottom: '2rem',
          borderBottom: '1px solid #e0ddd6',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '11px',
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              color: '#c8102e',
              marginBottom: '0.4rem',
            }}
          >
            account
          </div>
          <h1
            style={{
              fontSize: 'clamp(24px, 3.5vw, 40px)',
              fontWeight: 300,
              lineHeight: 1.15,
              margin: '0 0 0.3rem',
            }}
          >
            Profile
          </h1>
          <p style={{ color: '#6a6a6a', fontSize: '13px', maxWidth: '520px', margin: 0 }}>
            Manage your personal details and account preferences.
          </p>
        </div>
        {isEditing && (
          <Button variant="primary" onClick={handleSave} disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        )}
      </div>

      {/* Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '280px 1fr',
          gap: '0px',
          background: '#e0ddd6',
          border: '1px solid #e0ddd6',
        }}
      >
        {/* Sidebar */}
        <div
          style={{
            background: '#f0ede6',
            padding: '2rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: '#e8e5de',
              border: '2px solid #b8a06a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              fontWeight: 200,
              margin: '0 0 1rem',
              color: '#1a1a1a',
            }}
          >
            {initials}
          </div>
          <div style={{ fontSize: '16px', fontWeight: 300, marginBottom: '3px' }}>
            {firstName} {lastName}
          </div>
          <div style={{ fontSize: '10px', color: '#6a6a6a', marginBottom: '1.25rem' }}>
            {user.email}
          </div>

          {/* Tier Pill */}
          <div
            style={{
              padding: '6px 14px',
              background: 'rgba(184,160,106,0.08)',
              border: '1px solid rgba(184,160,106,0.3)',
              fontSize: '10px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: '#b8a06a',
              marginBottom: '1.5rem',
              borderRadius: '20px',
            }}
          >
            ● {user.role || 'user'}
          </div>

          {/* Info */}
          <div style={{ width: '100%', textAlign: 'left' }}>
            {[
              ...(user.city ? [{ label: 'City', value: user.city }] : []),
              ...(user.country ? [{ label: 'Country', value: user.country }] : []),
              ...(user.wallet ? [{ label: 'Wallet', value: user.wallet.slice(0, 6) + '...' + user.wallet.slice(-4) }] : []),
            ].map((item, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 0',
                  borderBottom: i < 2 ? '1px solid #e0ddd6' : 'none',
                  fontSize: '11px',
                  color: '#6a6a6a',
                }}
              >
                <div
                  style={{
                    width: '4px',
                    height: '4px',
                    background: '#c8102e',
                    borderRadius: '50%',
                    flexShrink: 0,
                  }}
                />
                {item.value}
              </div>
            ))}
          </div>
        </div>

        {/* Main Form */}
        <div style={{ background: '#ffffff', padding: '2rem' }}>
          <div
            style={{
              fontSize: '10px',
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              color: '#1a1a1a',
              marginBottom: '1.25rem',
              paddingBottom: '0.75rem',
              borderBottom: '1px solid #e0ddd6',
            }}
          >
            Personal Information
          </div>

          {/* Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0px', background: '#e0ddd6', border: '1px solid #e0ddd6' }}>
            {/* Given Name & Family Name */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0px',
                background: '#e0ddd6',
              }}
            >
              {[
                { name: 'givenName', label: 'First Name' },
                { name: 'familyName', label: 'Last Name' },
              ].map((field) => (
                <div key={field.name} style={{ background: '#ffffff', padding: '1rem 1.25rem' }}>
                  <label
                    style={{
                      fontSize: '11px',
                      letterSpacing: '0.2em',
                      textTransform: 'uppercase',
                      color: '#6a6a6a',
                      marginBottom: '5px',
                      display: 'block',
                    }}
                  >
                    {field.label}
                  </label>
                  <input
                    type="text"
                    name={field.name}
                    value={(formData[field.name as keyof typeof formData] as string) || ''}
                    onChange={handleChange}
                    disabled={!isEditing}
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: '1px solid #e0ddd6',
                      color: '#1a1a1a',
                      fontFamily: "'Inter', sans-serif",
                      fontSize: '13px',
                      padding: '4px 0',
                      outline: 'none',
                      cursor: isEditing ? 'text' : 'default',
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Other fields */}
            {[
              { name: 'email', label: 'Email Address', type: 'email' },
              { name: 'phoneNumber', label: 'Phone Number', type: 'tel' },
              { name: 'address', label: 'Address', type: 'text' },
              { name: 'city', label: 'City', type: 'text' },
              { name: 'country', label: 'Country', type: 'text' },
              { name: 'postalCode', label: 'Postal Code', type: 'text' },
              { name: 'birthdate', label: 'Date of Birth', type: 'date' },
            ].map((field) => (
              <div key={field.name} style={{ background: '#ffffff', padding: '1rem 1.25rem' }}>
                <label
                  style={{
                    fontSize: '11px',
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    color: '#6a6a6a',
                    marginBottom: '5px',
                    display: 'block',
                  }}
                >
                  {field.label}
                </label>
                <input
                  type={field.type}
                  name={field.name}
                  value={(formData[field.name as keyof typeof formData] as string) || ''}
                  onChange={handleChange}
                  disabled={!isEditing}
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid #e0ddd6',
                    color: '#1a1a1a',
                    fontFamily: "'Inter', sans-serif",
                    fontSize: '13px',
                    padding: '4px 0',
                    outline: 'none',
                    cursor: isEditing ? 'text' : 'default',
                  }}
                  placeholder="Not provided"
                />
              </div>
            ))}

            {/* Public Profile Toggle */}
            <div style={{ background: '#ffffff', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label
                style={{
                  fontSize: '11px',
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  color: '#6a6a6a',
                }}
              >
                Public Profile
              </label>
              <input
                type="checkbox"
                name="isPublic"
                checked={formData.isPublic || false}
                onChange={handleChange}
                disabled={!isEditing}
                style={{
                  cursor: isEditing ? 'pointer' : 'default',
                }}
              />
            </div>
          </div>

          {/* Edit Button */}
          <div style={{ marginTop: '2rem' }}>
            {!isEditing ? (
              <Button
                variant="primary"
                onClick={() => setIsEditing(true)}
              >
                Edit Profile
              </Button>
            ) : (
              <div style={{ display: 'flex', gap: '1rem' }}>
                <Button 
                  variant="primary" 
                  onClick={handleSave}
                  disabled={isLoading}
                >
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button 
                  variant="secondary" 
                  onClick={() => {
                    setFormData({
                      givenName: user?.givenName || '',
                      familyName: user?.familyName || '',
                      email: user?.email || '',
                      phoneNumber: user?.phoneNumber || '',
                      address: user?.address || '',
                      city: user?.city || '',
                      country: user?.country || '',
                      postalCode: user?.postalCode || '',
                      birthdate: user?.birthdate || '',
                      isPublic: user?.isPublic || false,
                    });
                    setIsEditing(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
