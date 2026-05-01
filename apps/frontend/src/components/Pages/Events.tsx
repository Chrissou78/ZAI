import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import { apiService } from '../../services/api';
import Button from '../Common/Button';
import Modal from '../Common/Modal';
import Tabs from '../Common/Tabs';

type EventType = 'demo' | 'factory' | 'partner' | 'community' | 'all';
type EventStatus = 'upcoming' | 'past' | 'all';

interface Event {
  id: string;
  title: string;
  tag: string;
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
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<EventType>('all');
  const [statusFilter, setStatusFilter] = useState<EventStatus>('upcoming');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [registering, setRegistering] = useState(false);

  // Fetch events on mount
  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch upcoming events
      const upcomingResponse = await apiService.get('/events', {
        params: { status: 'upcoming' }
      });

      // Fetch past events
      const pastResponse = await apiService.get('/events', {
        params: { status: 'past' }
      });

      const allEvents = [
        ...(upcomingResponse.data?.data || []).map((event: any) => ({
          ...event,
          status: 'upcoming',
          registered: false,
        })),
        ...(pastResponse.data?.data || []).map((event: any) => ({
          ...event,
          status: 'past',
          registered: true,
        })),
      ];

      setEvents(allEvents);
    } catch (err: any) {
      console.error('Error fetching events:', err);
      setError(err.response?.data?.error || 'Failed to load events');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter events
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (statusFilter !== 'all' && event.status !== statusFilter) return false;
      if (typeFilter !== 'all') {
        const eventType = event.tag?.toLowerCase().split(' ')[0];
        if (eventType !== typeFilter) return false;
      }
      return true;
    });
  }, [typeFilter, statusFilter, events]);

  const upcomingCount = events.filter((e) => e.status === 'upcoming').length;
  const pastCount = events.filter((e) => e.status === 'past').length;

  const handleEventSelect = (event: Event) => {
    setSelectedEvent(event);
    setShowEventModal(true);
  };

  const handleRegister = async () => {
    if (selectedEvent && user?.id) {
      setRegistering(true);
      try {
        const response = await apiService.post(`/events/${selectedEvent.id}/register`);

        if (response.data?.success) {
          setShowEventModal(false);
          // Update event registration status
          setEvents(events.map(e =>
            e.id === selectedEvent.id ? { ...e, registered: true } : e
          ));
          setTimeout(() => {
            setSelectedEvent(null);
            alert('Successfully registered for the event!');
          }, 300);
        }
      } catch (err: any) {
        console.error('Error registering for event:', err);
        alert(err.response?.data?.error || 'Failed to register for event');
      } finally {
        setRegistering(false);
      }
    }
  };

  const getEventTypeEmoji = (tag: string) => {
    const lowerTag = tag?.toLowerCase() || '';
    if (lowerTag.includes('demo')) return '🎿';
    if (lowerTag.includes('factory')) return '🏭';
    if (lowerTag.includes('partner')) return '🤝';
    if (lowerTag.includes('community')) return '👥';
    return '📍';
  };

  const parseDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return {
        day: date.getDate(),
        month: date.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
        full: date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      };
    } catch {
      return { day: '?', month: '?', full: dateStr };
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: '3rem 4rem 5rem', textAlign: 'center' }}>
        <div style={{ fontSize: '16px', color: '#6a6a6a' }}>Loading events...</div>
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
                  borderRight: filter !== 'partner' ? '1px solid #e0ddd6' : 'none',
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
                {filteredEvents.filter((e) => e.status === 'upcoming').length === 0 ? (
                  <div style={{ padding: '3rem', textAlign: 'center', background: '#f0ede6', border: '1px solid #e0ddd6' }}>
                    <p style={{ color: '#6a6a6a' }}>No upcoming events at the moment.</p>
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                      gap: '1px',
                      background: '#e0ddd6',
                      border: '1px solid #e0ddd6',
                    }}
                  >
                    {filteredEvents
                      .filter((e) => e.status === 'upcoming')
                      .map((event) => {
                        const dateInfo = parseDate(event.date);
                        return (
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
                                {getEventTypeEmoji(event.tag)}
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
                                  {dateInfo.day}
                                </div>
                                <div style={{ fontSize: '8px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'white' }}>
                                  {dateInfo.month}
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
                                {event.tag || 'Event'}
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
                                <div style={{ fontSize: '12px', color: '#6a6a6a' }}>
                                  {event.tier === 'all' ? 'Open' : event.tier}
                                </div>
                                <span style={{ fontSize: '12px', color: '#6a6a6a' }}>›</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            ),
          },
          {
            id: 'past',
            label: `Past (${pastCount})`,
            content: (
              <div>
                {filteredEvents.filter((e) => e.status === 'past').length === 0 ? (
                  <div style={{ padding: '3rem', textAlign: 'center', background: '#f0ede6', border: '1px solid #e0ddd6' }}>
                    <p style={{ color: '#6a6a6a' }}>No past events.</p>
                  </div>
                ) : (
                  <div style={{ background: '#f0ede6', padding: '0', borderRadius: '4px', border: '1px solid #e0ddd6' }}>
                    {filteredEvents
                      .filter((e) => e.status === 'past')
                      .map((event, idx) => (
                        <div
                          key={event.id}
                          onClick={() => handleEventSelect(event)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '1rem 1.25rem',
                            borderBottom: idx < filteredEvents.filter((e) => e.status === 'past').length - 1 ? '1px solid #e0ddd6' : 'none',
                            cursor: 'pointer',
                            background: 'white',
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
                )}
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
          title={selectedEvent.tag || 'EVENT'}
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
          {!selectedEvent.registered && (
            <Button
              variant="primary"
              fullWidth
              onClick={handleRegister}
              disabled={registering}
              style={{ marginBottom: '12px' }}
            >
              {registering ? 'Registering...' : 'Register Interest'}
            </Button>
          )}
          <Button
            variant="secondary"
            fullWidth
            onClick={() => setShowEventModal(false)}
          >
            {selectedEvent.registered ? 'Close' : 'Close'}
          </Button>
        </Modal>
      )}
    </div>
  );
};

export default Events;
