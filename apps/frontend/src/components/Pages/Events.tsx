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
  name?: string;
  tag: string;
  location: string;
  date: string;
  startDate?: string;
  endDate?: string;
  description: string;
  program?: string;
  coverImage?: string | null;
  galleryImages?: string[];
  imageUrl?: string;
  tier: string;
  status: 'upcoming' | 'past';
  registered: boolean;
  maxAttendees?: number | null;
  totalAttendees?: number;
  price?: number;
  currency?: string;
  discountPrice?: number | null;
  discountPercentage?: number | null;
  contractRequiredToAttend?: string[];
  contractRequiredToDiscount?: string[];
  chainId?: number | null;
}

// ── Style constants ──
const accent = '#c8102e';
const textDark = '#1a1a1a';
const textMuted = '#6a6a6a';
const bgMuted = '#f0ede6';
const borderColor = '#e0ddd6';
const gold = '#b8a06a';

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

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiService.get('/events');
      setEvents(response.data?.data || []);
    } catch (err: any) {
      console.error('Error fetching events:', err);
      setError(err.response?.data?.error || 'Failed to load events');
    } finally {
      setIsLoading(false);
    }
  };

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
          setEvents(events.map(e =>
            e.id === selectedEvent.id
              ? { ...e, registered: true, totalAttendees: (e.totalAttendees || 0) + 1 }
              : e
          ));
          setSelectedEvent(prev => prev ? { ...prev, registered: true, totalAttendees: (prev.totalAttendees || 0) + 1 } : null);
          alert('Successfully registered for the event!');
        }
      } catch (err: any) {
        console.error('Error registering for event:', err);
        alert(err.response?.data?.error || 'Failed to register for event');
      } finally {
        setRegistering(false);
      }
    }
  };

  const handleUnregister = async () => {
    if (selectedEvent && user?.id) {
      setRegistering(true);
      try {
        const response = await apiService.delete(`/events/${selectedEvent.id}/register`);
        if (response.data?.success) {
          setEvents(events.map(e =>
            e.id === selectedEvent.id
              ? { ...e, registered: false, totalAttendees: Math.max((e.totalAttendees || 1) - 1, 0) }
              : e
          ));
          setSelectedEvent(prev => prev ? { ...prev, registered: false, totalAttendees: Math.max((prev.totalAttendees || 1) - 1, 0) } : null);
          alert('Successfully unregistered from the event.');
        }
      } catch (err: any) {
        console.error('Error unregistering from event:', err);
        alert(err.response?.data?.error || 'Failed to unregister');
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
        year: date.getFullYear(),
        full: date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      };
    } catch {
      return { day: '?', month: '?', year: '', full: dateStr };
    }
  };

  const formatPrice = (event: Event) => {
    if (event.price === undefined || event.price === null) return null;
    if (event.price === 0) return 'Free';
    return `${event.price} ${event.currency || 'EUR'}`;
  };

  if (isLoading) {
    return (
      <div style={{ padding: '3rem 4rem 5rem', textAlign: 'center' }}>
        <div style={{ fontSize: '16px', color: textMuted }}>Loading events...</div>
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
          borderBottom: `1px solid ${borderColor}`,
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
              color: accent,
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
          <p style={{ color: textMuted, fontSize: '13px', maxWidth: '520px', margin: 0 }}>
            Experience card holders receive priority access to exclusive events.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 0, border: `1px solid ${borderColor}` }}>
            {(['all', 'demo', 'factory', 'partner', 'community'] as const).map((filter, i, arr) => (
              <button
                key={filter}
                onClick={() => setTypeFilter(filter)}
                style={{
                  padding: '9px 18px',
                  fontSize: '11px',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  background: typeFilter === filter ? textDark : '#ffffff',
                  color: typeFilter === filter ? '#ffffff' : textMuted,
                  border: 'none',
                  borderRight: i < arr.length - 1 ? `1px solid ${borderColor}` : 'none',
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

      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(200,16,46,0.06)', border: `1px solid rgba(200,16,46,0.15)`, marginBottom: '1.5rem', fontSize: '13px', color: accent }}>
          {error}
        </div>
      )}

      {/* Tabs for status */}
      <Tabs
        tabs={[
          {
            id: 'upcoming',
            label: `Upcoming (${upcomingCount})`,
            content: (
              <div>
                {filteredEvents.filter((e) => e.status === 'upcoming').length === 0 ? (
                  <div style={{ padding: '3rem', textAlign: 'center', background: bgMuted, border: `1px solid ${borderColor}` }}>
                    <p style={{ color: textMuted }}>No upcoming events at the moment.</p>
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                      gap: '1px',
                      background: borderColor,
                      border: `1px solid ${borderColor}`,
                    }}
                  >
                    {filteredEvents
                      .filter((e) => e.status === 'upcoming')
                      .map((event) => {
                        const dateInfo = parseDate(event.startDate || event.date);
                        const priceLabel = formatPrice(event);
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
                            onMouseEnter={(e) => (e.currentTarget.style.background = bgMuted)}
                            onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
                          >
                            {/* Cover image or emoji fallback */}
                            <div
                              style={{
                                position: 'relative',
                                overflow: 'hidden',
                                height: '180px',
                                background: '#0d0d0d',
                              }}
                            >
                              {event.coverImage ? (
                                <img
                                  src={event.coverImage}
                                  alt={event.title}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                />
                              ) : (
                                <div
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    background: bgMuted,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '48px',
                                  }}
                                >
                                  {getEventTypeEmoji(event.tag)}
                                </div>
                              )}
                              {/* Date Badge */}
                              <div
                                style={{
                                  position: 'absolute',
                                  top: '0.75rem',
                                  left: '0.75rem',
                                  background: accent,
                                  padding: '6px 10px',
                                  textAlign: 'center',
                                  minWidth: '44px',
                                }}
                              >
                                <div style={{ fontSize: '18px', fontWeight: 300, lineHeight: 1, color: 'white' }}>
                                  {dateInfo.day}
                                </div>
                                <div style={{ fontSize: '8px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)' }}>
                                  {dateInfo.month}
                                </div>
                              </div>
                              {/* Registration badge */}
                              {event.registered && (
                                <div
                                  style={{
                                    position: 'absolute',
                                    top: '0.75rem',
                                    right: '0.75rem',
                                    background: 'rgba(42,157,78,0.9)',
                                    color: '#fff',
                                    fontSize: '10px',
                                    fontWeight: 600,
                                    letterSpacing: '0.1em',
                                    padding: '4px 10px',
                                    textTransform: 'uppercase',
                                  }}
                                >
                                  Registered
                                </div>
                              )}
                            </div>

                            {/* Info */}
                            <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                              <div
                                style={{
                                  fontSize: '11px',
                                  letterSpacing: '0.3em',
                                  textTransform: 'uppercase',
                                  color: accent,
                                  marginBottom: '5px',
                                }}
                              >
                                {event.tag || 'Event'}
                              </div>
                              <h3
                                style={{
                                  fontSize: '14px',
                                  fontWeight: 500,
                                  margin: '0 0 6px',
                                  lineHeight: 1.35,
                                  color: textDark,
                                }}
                              >
                                {event.title}
                              </h3>
                              <div
                                style={{
                                  fontSize: '11px',
                                  color: textMuted,
                                  marginBottom: '6px',
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
                                  color: textMuted,
                                  lineHeight: 1.6,
                                  flex: 1,
                                  margin: 0,
                                  display: '-webkit-box',
                                  WebkitLineClamp: 3,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                }}
                              >
                                {event.description}
                              </p>
                              {/* Attendees + Price bar */}
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  marginTop: '12px',
                                  paddingTop: '10px',
                                  borderTop: `1px solid ${borderColor}`,
                                  fontSize: '11px',
                                  color: textMuted,
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  {event.totalAttendees !== undefined && (
                                    <span>
                                      👥 {event.totalAttendees}
                                      {event.maxAttendees ? `/${event.maxAttendees}` : ''}
                                    </span>
                                  )}
                                  {priceLabel && (
                                    <span style={{ color: priceLabel === 'Free' ? '#2a9d4e' : textMuted, fontWeight: priceLabel === 'Free' ? 600 : 400 }}>
                                      {priceLabel === 'Free' ? '✓ Free' : `💰 ${priceLabel}`}
                                    </span>
                                  )}
                                </div>
                                <span style={{ fontSize: '14px', color: textMuted }}>›</span>
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
                  <div style={{ padding: '3rem', textAlign: 'center', background: bgMuted, border: `1px solid ${borderColor}` }}>
                    <p style={{ color: textMuted }}>No past events.</p>
                  </div>
                ) : (
                  <div style={{ background: bgMuted, borderRadius: '4px', border: `1px solid ${borderColor}` }}>
                    {filteredEvents
                      .filter((e) => e.status === 'past')
                      .map((event, idx, arr) => {
                        const dateInfo = parseDate(event.startDate || event.date);
                        return (
                          <div
                            key={event.id}
                            onClick={() => handleEventSelect(event)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              padding: '1rem 1.25rem',
                              borderBottom: idx < arr.length - 1 ? `1px solid ${borderColor}` : 'none',
                              cursor: 'pointer',
                              background: 'white',
                              transition: 'background 0.15s',
                              gap: '14px',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = bgMuted)}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
                          >
                            {/* Mini cover or emoji */}
                            <div style={{
                              width: '48px', height: '48px', borderRadius: '4px', overflow: 'hidden',
                              background: bgMuted, display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0, fontSize: '20px',
                            }}>
                              {event.coverImage ? (
                                <img src={event.coverImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                getEventTypeEmoji(event.tag)
                              )}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '12px', fontWeight: 500, color: textDark }}>{event.title}</div>
                              <div style={{ fontSize: '10px', color: textMuted, marginTop: '2px' }}>
                                {dateInfo.full} · {event.location}
                              </div>
                            </div>
                            {event.totalAttendees !== undefined && (
                              <div style={{ fontSize: '10px', color: textMuted }}>
                                👥 {event.totalAttendees}
                              </div>
                            )}
                            <span style={{ fontSize: '14px', color: textMuted }}>›</span>
                          </div>
                        );
                      })}
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
          background: textDark,
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
            Reach <span style={{ color: gold }}>Atelier</span> for factory visits & private sessions
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '11px', color: '#555', marginBottom: '8px' }}>Discover what's next</div>
          <Button variant="primary">Learn More</Button>
        </div>
      </div>

      {/* ─── Event Detail Modal ─── */}
      {selectedEvent && (
        <Modal
          isOpen={showEventModal}
          onClose={() => { setShowEventModal(false); setTimeout(() => setSelectedEvent(null), 300); }}
          title={selectedEvent.tag?.toUpperCase() || 'EVENT'}
          size="lg"
        >
          {/* Cover image */}
          {selectedEvent.coverImage && (
            <div style={{ margin: '-1.5rem -1.5rem 1.5rem', overflow: 'hidden' }}>
              <img
                src={selectedEvent.coverImage}
                alt={selectedEvent.title}
                style={{ width: '100%', height: '260px', objectFit: 'cover', display: 'block' }}
              />
            </div>
          )}

          <h2 style={{ fontSize: '22px', fontWeight: 300, margin: '0 0 8px', color: textDark }}>
            {selectedEvent.title}
          </h2>

          {/* Date, location, attendees row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '12px', color: textMuted, marginBottom: '1.25rem' }}>
            <span>
              📅 {new Date(selectedEvent.startDate || selectedEvent.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
            {selectedEvent.endDate && selectedEvent.endDate !== (selectedEvent.startDate || selectedEvent.date) && (
              <span>→ {new Date(selectedEvent.endDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
            )}
            <span>📍 {selectedEvent.location}</span>
            {selectedEvent.totalAttendees !== undefined && (
              <span>👥 {selectedEvent.totalAttendees}{selectedEvent.maxAttendees ? `/${selectedEvent.maxAttendees}` : ''} attendees</span>
            )}
          </div>

          {/* Price block */}
          {selectedEvent.price !== undefined && (
            <div style={{
              padding: '10px 14px', background: bgMuted, border: `1px solid ${borderColor}`,
              marginBottom: '1.25rem', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px',
            }}>
              {selectedEvent.price === 0 ? (
                <span style={{ color: '#2a9d4e', fontWeight: 600 }}>Free Event</span>
              ) : (
                <>
                  <span style={{ fontWeight: 600 }}>{selectedEvent.price} {selectedEvent.currency || 'EUR'}</span>
                  {selectedEvent.discountPrice != null && (
                    <span style={{ color: accent, fontSize: '11px' }}>
                      Discount: {selectedEvent.discountPrice} {selectedEvent.currency || 'EUR'}
                      {selectedEvent.discountPercentage ? ` (-${selectedEvent.discountPercentage}%)` : ''}
                    </span>
                  )}
                </>
              )}
            </div>
          )}

          {/* Description */}
          <p style={{ fontSize: '14px', lineHeight: 1.8, color: textMuted, marginBottom: '1.25rem' }}>
            {selectedEvent.description}
          </p>

          {/* Program */}
          {selectedEvent.program && (() => {
            // Parse BlockNote JSON format from WalletTwo
            let programLines: string[] = [];
            try {
              const raw = typeof selectedEvent.program === 'string' ? selectedEvent.program : '';
              if (raw.trim().startsWith('[')) {
                const blocks = JSON.parse(raw);
                programLines = blocks
                  .map((block: any) => {
                    if (!block.content || block.content.length === 0) return '';
                    return block.content.map((node: any) => node.text || '').join('');
                  })
                  .filter((line: string) => line.trim() !== '');
              }
            } catch {}

            // Fallback: plain text split by newlines
            if (programLines.length === 0) {
              const raw = typeof selectedEvent.program === 'string' ? selectedEvent.program : '';
              programLines = raw.split('\n').filter((l: string) => l.trim());
            }

            // Try to detect time-prefixed lines (e.g. "09.00 Welcome")
            const timeRegex = /^(\d{1,2}[.:h]\d{2})\s+(.+)$/;
            const hasTimeLines = programLines.some(l => timeRegex.test(l.trim()));

            return (
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{
                  fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase',
                  color: '#1a1a1a', marginBottom: '8px', fontWeight: 600,
                }}>
                  Program
                </div>

                <div style={{ border: '1px solid #e0ddd6', overflow: 'hidden' }}>
                  {programLines.map((line, idx) => {
                    const trimmed = line.trim();
                    const timeMatch = trimmed.match(timeRegex);

                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          gap: '14px',
                          padding: '12px 14px',
                          borderBottom: idx < programLines.length - 1 ? '1px solid #e0ddd6' : 'none',
                          background: idx % 2 === 0 ? '#fff' : '#fafaf8',
                          alignItems: 'baseline',
                        }}
                      >
                        {hasTimeLines && timeMatch ? (
                          <>
                            <div style={{
                              minWidth: '50px', fontSize: '12px', fontWeight: 600,
                              color: '#c8102e', flexShrink: 0,
                            }}>
                              {timeMatch[1]}
                            </div>
                            <div style={{ fontSize: '13px', color: '#1a1a1a', lineHeight: 1.5 }}>
                              {timeMatch[2]}
                            </div>
                          </>
                        ) : (
                          <div style={{ fontSize: '13px', color: '#1a1a1a', lineHeight: 1.5 }}>
                            {trimmed}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Gallery carousel */}
          {selectedEvent.galleryImages && selectedEvent.galleryImages.length > 0 && (
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: textDark, marginBottom: '8px', fontWeight: 600 }}>
                Gallery
              </div>
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                {selectedEvent.galleryImages.map((img, idx) => (
                  <img key={idx} src={img} alt={`Gallery ${idx + 1}`}
                    style={{ width: '140px', height: '95px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0, border: `1px solid ${borderColor}` }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Tier info */}
          <div
            style={{
              padding: '10px 12px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: `1px solid ${borderColor}`,
              marginBottom: '1.25rem',
              fontSize: '12px',
              color: textMuted,
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
            }}
          >
            <div style={{ width: '4px', height: '4px', background: gold, borderRadius: '50%' }} />
            {selectedEvent.tier === 'all' || !selectedEvent.tier ? 'Open to all members' : `Requires ${selectedEvent.tier} tier`}
          </div>

          {/* Registration / Unregistration */}
          {selectedEvent.registered ? (
            <>
              <div style={{
                padding: '12px 14px', background: 'rgba(42, 157, 78, 0.08)', border: '1px solid rgba(42, 157, 78, 0.2)',
                marginBottom: '12px', fontSize: '13px', color: '#2a9d4e', fontWeight: 500, textAlign: 'center',
              }}>
                ✓ You are registered for this event
              </div>
              {selectedEvent.status === 'upcoming' && (
                <button
                  onClick={handleUnregister}
                  disabled={registering}
                  style={{
                    width: '100%', padding: '10px', marginBottom: '12px',
                    background: 'transparent', border: `1px solid ${borderColor}`,
                    color: textMuted, fontSize: '12px', cursor: registering ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.color = accent; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = borderColor; e.currentTarget.style.color = textMuted; }}
                >
                  {registering ? 'Processing...' : 'Cancel Registration'}
                </button>
              )}
            </>
          ) : selectedEvent.status === 'upcoming' ? (
            <Button
              variant="primary"
              fullWidth
              onClick={handleRegister}
              disabled={registering}
              style={{ marginBottom: '12px' }}
            >
              {registering ? 'Registering...' : 'Register Interest'}
            </Button>
          ) : null}

          <Button variant="secondary" fullWidth onClick={() => { setShowEventModal(false); setTimeout(() => setSelectedEvent(null), 300); }}>
            Close
          </Button>
        </Modal>
      )}
    </div>
  );
};

export default Events;
