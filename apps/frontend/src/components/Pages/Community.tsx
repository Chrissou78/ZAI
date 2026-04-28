import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import Button from '../Common/Button';
import Tabs from '../Common/Tabs';

interface Member {
  id: string;
  name: string;
  avatar: string;
  location: string;
  joinedDate: string;
  products: number;
}

interface FeedItem {
  id: string;
  author: string;
  caption: string;
  imageUrl: string;
  timestamp: string;
  likes: number;
}

const Community: React.FC = () => {
  const { user } = useAppContext();
  const [igConnected, setIgConnected] = useState(true);

  const mockMembers: Member[] = [
    {
      id: '1',
      name: 'Anna Kirchner',
      avatar: 'AK',
      location: 'Zürich, CH',
      joinedDate: 'Jan 2023',
      products: 4,
    },
    {
      id: '2',
      name: 'Markus Steinberg',
      avatar: 'MS',
      location: 'Munich, DE',
      joinedDate: 'Mar 2023',
      products: 2,
    },
    {
      id: '3',
      name: 'Luca Visconti',
      avatar: 'LV',
      location: 'Milan, IT',
      joinedDate: 'Jun 2023',
      products: 3,
    },
    {
      id: '4',
      name: 'Sophie Perret',
      avatar: 'SP',
      location: 'Geneva, CH',
      joinedDate: 'Sep 2023',
      products: 2,
    },
    {
      id: '5',
      name: 'Thomas Huber',
      avatar: 'TH',
      location: 'Innsbruck, AT',
      joinedDate: 'Nov 2023',
      products: 5,
    },
  ];

  const mockFeed: FeedItem[] = [
    {
      id: '1',
      author: 'Anna K.',
      caption: 'First run of the season on the N3 — nothing compares to Corvatsch in January.',
      imageUrl: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=400&q=80',
      timestamp: '2 hours ago',
      likes: 42,
    },
    {
      id: '2',
      author: 'Markus S.',
      caption: 'Testing the new Stone Black Marble in fresh powder at Zermatt. Unreal.',
      imageUrl: 'https://images.unsplash.com/photo-1516132006923-6cf348e5dee2?w=400&q=80',
      timestamp: '5 hours ago',
      likes: 38,
    },
    {
      id: '3',
      author: 'Luca V.',
      caption: 'The view from the summit before dropping in. Worth every early morning.',
      imageUrl: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400&q=80',
      timestamp: '1 day ago',
      likes: 56,
    },
  ];

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
              {mockMembers.length} registered
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
              {mockMembers.map((member, i) => (
                <div
                  key={member.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 1fr',
                    gap: 0,
                    borderBottom: i < mockMembers.length - 1 ? '1px solid #e0ddd6' : 'none',
                    alignItems: 'center',
                    transition: 'background 0.15s',
                    background: i % 2 === 0 ? '#ffffff' : '#f9f8f6',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f0ede6')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? '#ffffff' : '#f9f8f6')}
                >
                  <div style={{ padding: '11px 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                        color: '#6a6a6a',
                        flexShrink: 0,
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
                    {member.joinedDate}
                  </div>
                </div>
              ))}
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
              Showing {mockMembers.length} of 247 members
            </div>
          </div>
        </div>

        {/* Instagram & WhatsApp Connect */}
        <div>
          <div
            style={{
              border: '1px solid #e0ddd6',
              padding: '2rem',
              marginBottom: '1rem',
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
              Your Instagram
            </div>
            <p style={{ fontSize: '13px', color: '#6a6a6a', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              Link your Instagram to contribute your mountain photos to the community feed. Only
              your tagged zai posts will appear.
            </p>

            {igConnected && (
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
                    background: 'linear-gradient(135deg,#f9ce34,#ee2a7b,#6228d7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    flexShrink: 0,
                  }}
                >
                  📷
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#1a1a1a', fontWeight: 500 }}>
                    anna.kirchner
                  </div>
                  <div style={{ fontSize: '11px', color: '#6a6a6a' }}>
                    @anna.kirchner · 3 posts shared
                  </div>
                </div>
                <div
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: '#2a8a5a',
                    marginLeft: 'auto',
                    flexShrink: 0,
                  }}
                />
              </div>
            )}

            <Button
              variant="primary"
              fullWidth
              onClick={() => setIgConnected(!igConnected)}
            >
              {igConnected ? 'Manage Connection' : 'Connect Instagram'}
            </Button>
            <p style={{ fontSize: '10px', color: '#999', marginTop: '0.75rem', lineHeight: 1.5 }}>
              Your privacy is protected. Only posts you explicitly share will be visible to the
              community.
            </p>
          </div>

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
                }}
              >
                💬
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#1a1a1a', fontWeight: 500 }}>
                  zai Experience Channel
                </div>
                <div style={{ fontSize: '11px', color: '#6a6a6a' }}>
                  1,240 followers · Updated weekly
                </div>
              </div>
            </div>

            <Button
              variant="primary"
              fullWidth
              style={{ background: '#25D366' }}
            >
              Follow WhatsApp Channel
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
            84 members connected · 312 photos
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '3px',
          }}
        >
          {mockFeed.map((item) => (
            <div
              key={item.id}
              style={{
                position: 'relative',
                aspectRatio: '1',
                overflow: 'hidden',
                cursor: 'pointer',
                background: '#1a1a1a',
              }}
            >
              <img
                src={item.imageUrl}
                alt=""
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
                  background: 'linear-gradient(to top,rgba(0,0,0,0.82) 0%,rgba(0,0,0,0.45) 55%,transparent 100%)',
                  padding: '2rem 0.85rem 0.85rem',
                  opacity: 0,
                  transition: 'opacity 0.25s',
                  pointerEvents: 'none',
                }}
                onMouseEnter={(e) => {
                  (e as any).style.opacity = '1';
                }}
                onMouseLeave={(e) => {
                  (e as any).style.opacity = '0';
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
                  {item.author}
                </div>
                <div style={{ fontSize: '12px', color: '#fff', lineHeight: 1.4 }}>
                  {item.caption}
                </div>
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', marginTop: '4px' }}>
                  {item.timestamp}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Community;
