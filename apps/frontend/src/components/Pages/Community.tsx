import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { apiService } from '../../services/api';
import Button from '../Common/Button';

interface Member {
  id: string;
  name: string;
  avatar: string;
  location: string;
  joinedAt: string;
  productsCount: number;
}

interface FeedItem {
  id: string;
  userName: string;
  userHandle: string;
  userAvatar: string;
  caption: string;
  media_url: string;
  timestamp: string;
  permalink?: string;
}

interface CommunityStats {
  totalMembers: number;
  connectedInstagram: number;
  totalPhotos: number;
}

const Community: React.FC = () => {
  const { user } = useAppContext();
  const [members, setMembers] = useState<Member[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [stats, setStats] = useState<CommunityStats>({
    totalMembers: 0,
    connectedInstagram: 0,
    totalPhotos: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [whatsappLoading, setWhatsappLoading] = useState(false);

  // Fetch community data on mount
  useEffect(() => {
    fetchCommunityData();
  }, []);

  const fetchCommunityData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch members
      const membersResponse = await apiService.get('/community/members', {
        params: { limit: 50, offset: 0 }
      });

      // Fetch feed
      const feedResponse = await apiService.get('/community/feed', {
        params: { limit: 30, offset: 0 }
      });

      // Fetch stats
      const statsResponse = await apiService.get('/community/stats');

      if (membersResponse.data?.success) {
        setMembers(membersResponse.data.data || []);
      }

      if (feedResponse.data?.success) {
        setFeed(feedResponse.data.data || []);
      }

      if (statsResponse.data?.success) {
        setStats(statsResponse.data.data);
      }
    } catch (err: any) {
      console.error('Error fetching community data:', err);
      setError(err.response?.data?.error || 'Failed to load community');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubscribeWhatsApp = async () => {
    if (!user?.id) return;

    setWhatsappLoading(true);
    try {
      const phoneNumber = user.phoneNumber || ''; // Get from user profile
      
      if (!phoneNumber) {
        alert('Please update your phone number in your profile first');
        setWhatsappLoading(false);
        return;
      }

      const response = await apiService.post('/community/whatsapp/subscribe', {
        phoneNumber,
      });

      if (response.data?.success) {
        alert('Redirecting to WhatsApp channel...');
        // In production, open WhatsApp link
        window.open('https://whatsapp.com/channel/...');
      }
    } catch (err: any) {
      console.error('Error subscribing to WhatsApp:', err);
      alert(err.response?.data?.error || 'Failed to subscribe');
    } finally {
      setWhatsappLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: '3rem 4rem 5rem', textAlign: 'center' }}>
        <div style={{ fontSize: '16px', color: '#6a6a6a' }}>Loading community...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '3rem 4rem 5rem' }}>
      {/* Header */}
      <div
        style={{
          marginBottom: '2.5rem',
          paddingBottom: '2rem',
          borderBottom: '1px solid #e0ddd6',
        }}
      >
        <div
          style={{
            fontSize: '11px',
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            color: '#c8102e',
            marginBottom: '0.4rem',
          }}
        >
          zai ecosystem
        </div>
        <h1
          style={{
            fontSize: 'clamp(24px, 3.5vw, 40px)',
            fontWeight: 300,
            lineHeight: 1.15,
            margin: '0 0 0.3rem',
          }}
        >
          Community
        </h1>
        <p style={{ color: '#6a6a6a', fontSize: '13px', maxWidth: '520px', margin: 0 }}>
          A global family of zai owners — connected by the mountain.
        </p>
      </div>

      {/* Two Column Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '2rem',
          marginBottom: '3rem',
        }}
      >
        {/* Member List */}
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1rem',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                letterSpacing: '0.25em',
                textTransform: 'uppercase',
                color: '#1a1a1a',
              }}
            >
              zai Members
            </div>
            <div style={{ fontSize: '11px', color: '#6a6a6a' }}>
              {members.length} of {stats.totalMembers} registered
            </div>
          </div>

          <div
            style={{
              border: '1px solid #e0ddd6',
              borderRadius: '4px',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr',
                gap: 0,
                borderBottom: '1px solid #e0ddd6',
                background: '#f0ede6',
              }}
            >
              {['Member', 'Location', 'Since'].map((header) => (
                <div
                  key={header}
                  style={{
                    padding: '10px 14px',
                    fontSize: '10px',
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    color: '#6a6a6a',
                  }}
                >
                  {header}
                </div>
              ))}
            </div>

            {/* Rows */}
            <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
              {members.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#6a6a6a' }}>
                  No members found
                </div>
              ) : (
                members.map((member, i) => (
                  <div
                    key={member.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 1fr',
                      gap: 0,
                      borderBottom: i < members.length - 1 ? '1px solid #e0ddd6' : 'none',
                      alignItems: 'center',
                      transition: 'background 0.15s',
                      background: i % 2 === 0 ? '#ffffff' : '#f9f8f6',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f0ede6')}
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = i % 2 === 0 ? '#ffffff' : '#f9f8f6')
                    }
                  >
                    <div
                      style={{
                        padding: '11px 14px',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                      }}
                    >
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: '#1a1a1a',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '10px',
                          letterSpacing: '0.05em',
                          color: '#b8a06a',
                          flexShrink: 0,
                          fontWeight: 500,
                        }}
                      >
                        {member.avatar}
                      </div>
                      {member.name}
                    </div>
                    <div style={{ padding: '11px 14px', fontSize: '11px', color: '#6a6a6a' }}>
                      {member.location}
                    </div>
                    <div style={{ padding: '11px 14px', fontSize: '11px', color: '#6a6a6a' }}>
                      {member.joinedAt}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: '12px 14px',
                fontSize: '11px',
                color: '#6a6a6a',
                borderTop: '1px solid #e0ddd6',
                background: '#f0ede6',
              }}
            >
              Showing {members.length} of {stats.totalMembers} members
            </div>
          </div>
        </div>

        {/* WhatsApp Connect */}
        <div>
          {/* WhatsApp */}
          <div
            style={{
              border: '1px solid #e0ddd6',
              padding: '2rem',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                letterSpacing: '0.25em',
                textTransform: 'uppercase',
                color: '#1a1a1a',
                marginBottom: '0.4rem',
              }}
            >
              Stay in the loop
            </div>
            <p style={{ fontSize: '13px', color: '#6a6a6a', lineHeight: 1.6, marginBottom: '1.25rem' }}>
              Follow our WhatsApp channel for event announcements, new product drops, and
              exclusive updates from the zai team.
            </p>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 14px',
                background: '#f0ede6',
                border: '1px solid #e0ddd6',
                marginBottom: '1rem',
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: '#25D366',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontSize: '18px',
                }}
              >
                💬
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#1a1a1a', fontWeight: 500 }}>
                  zai Experience Channel
                </div>
                <div style={{ fontSize: '11px', color: '#6a6a6a' }}>
                  {stats.totalMembers} followers · Updated weekly
                </div>
              </div>
            </div>

            <Button
              variant="primary"
              fullWidth
              onClick={handleSubscribeWhatsApp}
              disabled={whatsappLoading}
              style={{ background: '#25D366' }}
            >
              {whatsappLoading ? 'Opening...' : 'Follow WhatsApp Channel'}
            </Button>
            <p style={{ fontSize: '10px', color: '#999', marginTop: '0.75rem', lineHeight: 1.5 }}>
              You will be redirected to WhatsApp to follow the official zai channel.
            </p>
          </div>
        </div>
      </div>

      {/* Community Feed */}
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem',
          }}
        >
          <div
            style={{
              fontSize: '11px',
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              color: '#1a1a1a',
            }}
          >
            Community Feed
          </div>
          <div style={{ fontSize: '11px', color: '#6a6a6a' }}>
            {stats.connectedInstagram} members connected · {stats.totalPhotos} photos
          </div>
        </div>

        {feed.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', background: '#f0ede6', border: '1px solid #e0ddd6' }}>
            <p style={{ color: '#6a6a6a' }}>No posts yet. Be the first to share your zai moment!</p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '3px',
            }}
          >
            {feed.map((item) => (
              <div
                key={item.id}
                style={{
                  position: 'relative',
                  aspectRatio: '1',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  background: '#1a1a1a',
                }}
                onClick={() => {
                  if (item.permalink) window.open(item.permalink, '_blank');
                }}
              >
                <img
                  src={item.media_url}
                  alt={item.caption}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                    transition: 'transform 0.4s',
                  }}
                  onMouseEnter={(e) => {
                    (e.target as HTMLImageElement).style.transform = 'scale(1.04)';
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLImageElement).style.transform = 'scale(1)';
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background:
                      'linear-gradient(to top,rgba(0,0,0,0.82) 0%,rgba(0,0,0,0.45) 55%,transparent 100%)',
                    padding: '2rem 0.85rem 0.85rem',
                    opacity: 0,
                    transition: 'opacity 0.25s',
                    pointerEvents: 'none',
                  }}
                  onMouseEnter={(e) => {
                    const parent = (e.currentTarget as HTMLDivElement).parentElement;
                    if (parent) parent.style.opacity = '1';
                    (e.currentTarget as HTMLDivElement).style.opacity = '1';
                  }}
                  onMouseLeave={(e) => {
                    const parent = (e.currentTarget as HTMLDivElement).parentElement;
                    if (parent) parent.style.opacity = '0';
                    (e.currentTarget as HTMLDivElement).style.opacity = '0';
                  }}
                >
                  <div
                    style={{
                      fontSize: '10px',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: 'rgba(255,255,255,0.6)',
                      marginBottom: '3px',
                    }}
                  >
                    {item.userName}
                  </div>
                  <div style={{ fontSize: '12px', color: '#fff', lineHeight: 1.4, marginBottom: '4px' }}>
                    {item.caption?.substring(0, 80)}
                    {item.caption && item.caption.length > 80 ? '...' : ''}
                  </div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)' }}>
                    {item.timestamp}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Community;
