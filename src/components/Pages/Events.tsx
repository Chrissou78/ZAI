import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import Button from '../Common/Button';
import Modal from '../Common/Modal';
import Tabs from '../Common/Tabs';

type EventType = 'demo' | 'factory' | 'partner' | 'community' | 'all';
type EventStatus = 'upcoming' | 'past' | 'all';

interface Event {
  id: string;
  title: string;
  type: EventType;
  location: string;
  date: string;
  description: string;
  imageUrl?: string;
  tier: string;
  status: 'upcoming' | 'past';
  registered: boolean;
}

const Events: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAppContext();
  const [typeFilter, setTypeFilter] = useState<EventType>('all');
  const [statusFilter, setStatusFilter] = useState<EventStatus>('upcoming');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);

  // Mock events data
  const mockEvents: Event[] = [
    {
      id: '1',
      title: 'Winter Test Camp — Engadin',
      type: 'demo',
      location: 'St. Moritz, Switzerland',
      date: '14 Feb 2025',
      description: 'Three days on the Corvatsch glacier with the complete 2025 N-series lineup. One-on-one fitting sessions with zai engineers.',
      tier: 'all',
      status: 'upcoming',
      registered: false,
    },
    {
      id: '2',
      title: 'zai × Ikon Pass Rider Days',
      type: 'partner',
      location: 'Zermatt, Switzerland',
      date: '3 Mar 2025',
      description: 'A curated weekend with Ikon Pass holders. Guided freeriding and an exclusive preview of the 2026 N3 prototype.',
      tier: 'silver',
      status: 'upcoming',
      registered: false,
    },
    {
      id: '3',
      title: 'Factory Open Day — Pontresina',
      type: 'factory',
      location: 'Pontresina, Switzerland',
      date: '22 Apr 2025',
      description: 'Tour the atelier. Meet the craftspeople. Commission your bespoke piece.',
      tier: 'platinum',
      status: 'upcoming',
      registered: false,
    },
    {
      id: '4',
      title: 'Engadin Demo Day 2024',
      type: 'demo',
      location: 'St. Moritz, Switzerland',
      date: '28 Nov 2024',
      description: 'Test the full 2024 lineup on world-class terrain.',
      tier: 'all',
      status: 'past',
      registered: true,
    },
    {
      id: '5',
      title: 'Quarry Visit — Maloja',
      type: 'factory',
      location: 'Maloja, Switzerland',
      date: '5 Jul 2024',
      description: 'Visit our stone quarry and learn about our materials sourcing.',
      tier: 'gold',
      status: 'past',
      registered: true,
    },
  ];

  // Filter events
  const filteredEvents = useMemo(() => {
    return mockEvents.filter((event) => {
      if (statusFilter !== 'all' && event.status !== statusFilter) return false;
      if (typeFilter !== 'all' && event.type !== typeFilter) return false;
      return true;
    });
  }, [typeFilter, statusFilter]);

  const upcomingCount = mockEvents.filter((e) => e.status === 'upcoming').length;
  const pastCount = mockEvents.filter((e) => e.status === 'past').length;

  const handleEventSelect = (event: Event) => {
    setSelectedEvent(event);
    setShowEventModal(true);
  };

  const handleRegister = () => {
    if (selectedEvent) {
      setShowEventModal(false);
      // API call would go here
      setTimeout(() => {
        setSelectedEvent(null);
      }, 300);
    }
  };

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
            upcoming events
          </div>
          <h1
            style={{
              fontSize: 'clamp(24px, 3.5vw, 40px)',
              fontWeight: 300,
              lineHeight: 1.15,
              margin: '0 0 0.3rem',
            }}
          >
            Exclusive zai experiences
          </h1>
          <p style={{ color: '#6a6a6a', fontSize: '13px', maxWidth: '520px', margin: 0 }}>
            Experience card holders receive priority access to exclusive events.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 0, border: '1px solid #e0ddd6' }}>
            {(['all', 'demo', 'factory', 'partner'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setTypeFilter(filter)}
                style={{
                  padding: '9px 18px',
                  fontSize: '11px',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  background: typeFilter === filter ? '#1a1a1a' : '#ffffff',
                  color: typeFilter === filter ? '#ffffff' : '#6a6a6a',
                  border: 'none',
                  borderRight: '1px solid #e0ddd6',
                  fontFamily: "'Inter', sans-serif",
                  transition: 'all 0.2s',
                }}
                style={{
                  padding: '9px 18px',
                  fontSize: '11px',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  background: typeFilter === filter ? '#1a1a1a' : '#ffffff',
                  color: typeFilter === filter ? '#ffffff' : '#6a6a6a',
                  border: 'none',
                  borderRight: filter === 'partner' ? 'none' : '1px solid #e0ddd6',
                  fontFamily: "'Inter', sans-serif",
                  transition: 'all 0.2s',
                }}
              >
                {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs for status */}
      <Tabs
        tabs={[
          {
            id: 'upcoming',
            label: `Upcoming (${upcomingCount})`,
            content: (
              <div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '1px',
                    background: '#e0ddd6',
                    border: '1px solid #e0ddd6',
                  }}
                >
                  {filteredEvents
                    .filter((e) => e.status === 'upcoming')
                    .map((event) => (
                      <div
                        key={event.id}
                        onClick={() => handleEventSelect(event)}
                        style={{
                          background: '#ffffff',
                          cursor: 'pointer',
                          overflow: 'hidden',
                          display: 'flex',
                          flexDirection: 'column',
                          transition: 'background 0.2s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#f0ede6')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
                      >
                        {/* Image */}
                        <div
                          style={{
                            position: 'relative',
                            overflow: 'hidden',
                            height: '160px',
                            background: '#0d0d0d',
                          }}
                        >
                          <div
                            style={{
                              width: '100%',
                              height: '100%',
                              background: '#f0ede6',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '48px',
                            }}
                          >
                            {event.type === 'demo' && '🎿'}
                            {event.type === 'factory' && '🏭'}
                            {event.type === 'partner' && '🤝'}
                            {event.type === 'community' && '👥'}
                          </div>
                          {/* Date Badge */}
                          <div
                            style={{
                              position: 'absolute',
                              top: '0.75rem',
                              left: '0.75rem',
                              background: '#c8102e',
                              padding: '5px 8px',
                              textAlign: 'center',
                            }}
                          >
                            <div style={{ fontSize: '16px', fontWeight: 200, lineHeight: 1, color: 'white' }}>
                              {event.date.split(' ')[0]}
                            </div>
                            <div style={{ fontSize: '8px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'white' }}>
                              {event.date.split(' ')[1]}
                            </div>
                          </div>
                        </div>

                        {/* Info */}
                        <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                          <div
                            style={{
                              fontSize: '11px',
                              letterSpacing: '0.3em',
                              textTransform: 'uppercase',
                              color: '#c8102e',
                              marginBottom: '5px',
                            }}
                          >
                            {event.type}
                          </div>
                          <h3
                            style={{
                              fontSize: '13px',
                              fontWeight: 500,
                              margin: '0 0 4px',
                              lineHeight: 1.35,
                            }}
                          >
                            {event.title}
                          </h3>
                          <div
                            style={{
                              fontSize: '11px',
                              color: '#6a6a6a',
                              marginBottom: '5px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            📍 {event.location}
                          </div>
                          <p
                            style={{
                              fontSize: '11px',
                              color: '#6a6a6a',
                              lineHeight: 1.6,
                              flex: 1,
                              margin: 0,
                            }}
                          >
                            {event.description}
                          </p>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginTop: '10px',
                              paddingTop: '10px',
                              borderTop: '1px solid #e0ddd6',
                            }}
                          >
                            <div style={{ fontSize: '12px', color: '#6a6a6a' }}>{event.tier}</div>
                            <span style={{ fontSize: '12px', color: '#6a6a6a' }}>›</span>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ),
          },
          {
            id: 'past',
            label: `Past (${pastCount})`,
            content: (
              <div style={{ background: '#f0ede6', padding: '1.5rem', borderRadius: '4px' }}>
                {filteredEvents
                  .filter((e) => e.status === 'past')
                  .map((event) => (
                    <div
                      key={event.id}
                      onClick={() => handleEventSelect(event)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '1rem 1.25rem',
                        borderBottom: '1px solid #e0ddd6',
                        cursor: 'pointer',
                        background: 'white',
                        marginBottom: '1px',
                      }}
                    >
                      <div style={{ width: '4px', height: '4px', background: '#c8102e', borderRadius: '50%', marginRight: '12px', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '12px', fontWeight: 500 }}>{event.title}</div>
                        <div style={{ fontSize: '10px', color: '#6a6a6a' }}>
                          {event.date} · {event.location}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            ),
          },
        ]}
        defaultTab="upcoming"
        onChange={(tabId) => setStatusFilter(tabId as EventStatus)}
      />

      {/* CTA Banner */}
      <div
        style={{
          marginTop: '2rem',
          padding: '2rem',
          background: '#1a1a1a',
          border: '1px solid #2a2a2a',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: '#ffffff',
        }}
      >
        <div>
          <div style={{ fontSize: '10px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#555', marginBottom: '5px' }}>
            Unlock more events
          </div>
          <div style={{ fontSize: '18px', fontWeight: 200 }}>
            Reach <span style={{ color: '#b8a06a' }}>Atelier</span> for factory visits & private sessions
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '11px', color: '#555', marginBottom: '8px' }}>Discover what's next</div>
          <Button variant="primary">Learn More</Button>
        </div>
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <Modal
          isOpen={showEventModal}
          onClose={() => setShowEventModal(false)}
          title={selectedEvent.type.toUpperCase()}
          size="md"
        >
          <h2 style={{ fontSize: '20px', fontWeight: 300, margin: '0 0 5px' }}>
            {selectedEvent.title}
          </h2>
          <div style={{ fontSize: '12px', color: '#6a6a6a', marginBottom: '1.25rem' }}>
            {selectedEvent.date} · {selectedEvent.location}
          </div>
          <p style={{ fontSize: '14px', lineHeight: 1.8, color: '#6a6a6a', marginBottom: '1.25rem' }}>
            {selectedEvent.description}
          </p>
          <div
            style={{
              padding: '10px 12px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid #e0ddd6',
              marginBottom: '1.25rem',
              fontSize: '12px',
              color: '#6a6a6a',
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
            }}
          >
            <div style={{ width: '4px', height: '4px', background: '#b8a06a', borderRadius: '50%' }} />
            {selectedEvent.tier === 'all' ? 'Open to all members' : `Requires ${selectedEvent.tier} tier`}
          </div>
          <Button
            variant="primary"
            fullWidth
            onClick={handleRegister}
            style={{ marginBottom: '12px' }}
          >
            Register Interest
          </Button>
          <Button
            variant="secondary"
            fullWidth
            onClick={() => setShowEventModal(false)}
          >
            Close
          </Button>
        </Modal>
      )}
    </div>
  );
};

export default Events;
