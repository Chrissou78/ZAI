import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import { apiService } from '../../services/api';

// ─── Types ───

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

// ─── Design tokens ───

const C = {
  black: '#0a0a0a', white: '#f5f4f0', red: '#c8102e', burgundy: '#7D1E2C',
  gray: '#1a1a1a', mid: '#2e2e2e', muted: '#6a6a6a', border: '#e0ddd6',
  borderDark: '#2a2a2a', surface: '#f0ede6', surface2: '#e8e5de', pureWhite: '#ffffff',
  cardBody: '#f7f7f5',
};

const bdr = `1px solid ${C.border}`;

const lbl: React.CSSProperties = {
  fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase',
  color: C.muted, fontWeight: 500,
};

const sectionLabel: React.CSSProperties = {
  fontSize: '11px', letterSpacing: '0.3em', textTransform: 'uppercase',
  fontWeight: 600,
};

const EVENT_DOT_COLORS = ['#c8102e', '#f59e0b', '#2563eb', '#10b981', '#8b5cf6', '#ec4899'];

/* ── Carousel side-arrow style ── */
const sideArrowBase: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  zIndex: 10,
  width: 36,
  height: 36,
  borderRadius: '50%',
  border: 'none',
  background: 'rgba(255,255,255,0.92)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  fontSize: 18,
  color: C.mid,
  transition: 'all 0.2s',
  padding: 0,
};

// ─── Shimmer ───

const SHIMMER_ID = 'zai-events-shimmer';
function ensureShimmer() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(SHIMMER_ID)) return;
  const s = document.createElement('style');
  s.id = SHIMMER_ID;
  s.textContent = `@keyframes zaiShimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}`;
  document.head.appendChild(s);
}
const shimmer: React.CSSProperties = {
  background: `linear-gradient(90deg,${C.surface} 25%,${C.surface2} 50%,${C.surface} 75%)`,
  backgroundSize: '800px 100%', animation: 'zaiShimmer 1.6s infinite ease-in-out',
};
const Sk: React.FC<{w?:string;h?:string;s?:React.CSSProperties}> = ({w='100%',h='14px',s}) =>
  <div style={{...shimmer,width:w,height:h,...s}} />;

// ─── Helpers ───

function parseDate(dateStr: string) {
  try {
    const date = new Date(dateStr);
    return {
      day: date.getDate(),
      month: date.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
      year: date.getFullYear(),
      full: date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      short: `${date.getDate()} ${date.toLocaleString('en-US', { month: 'long' })} ${date.getFullYear()}`,
    };
  } catch {
    return { day: '?', month: '?', year: '', full: dateStr, short: dateStr };
  }
}

function getTagLabel(tag: string) {
  const t = tag?.toLowerCase() || '';
  if (t.includes('demo')) return 'DEMO DAY';
  if (t.includes('factory')) return 'FACTORY · INVITE ONLY';
  if (t.includes('partner')) return 'PARTNER EVENT';
  if (t.includes('community')) return 'COMMUNITY';
  return tag?.toUpperCase() || 'EVENT';
}

function getTagColor(tag: string) {
  const t = tag?.toLowerCase() || '';
  if (t.includes('demo')) return C.red;
  if (t.includes('factory')) return C.muted;
  if (t.includes('partner')) return '#f59e0b';
  return C.muted;
}

function parseProgramLines(program?: string): string[] {
  if (!program) return [];
  let lines: string[] = [];
  try {
    const raw = typeof program === 'string' ? program : '';
    if (raw.trim().startsWith('[')) {
      const blocks = JSON.parse(raw);
      lines = blocks
        .map((block: any) => {
          if (!block.content || block.content.length === 0) return '';
          return block.content.map((node: any) => node.text || '').join('');
        })
        .filter((line: string) => line.trim() !== '');
    }
  } catch {}
  if (lines.length === 0) {
    const raw = typeof program === 'string' ? program : '';
    lines = raw.split('\n').filter((l: string) => l.trim());
  }
  return lines;
}

// ═══════════════════════════════
//  COMPONENT
// ═══════════════════════════════

const Events: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAppContext();
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [registering, setRegistering] = useState(false);

  // Carousel state
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollPage, setScrollPage] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const totalUpcomingPages = useMemo(() => {
    const upcoming = events.filter(e => e.status === 'upcoming');
    return Math.max(1, Math.ceil(upcoming.length / 3));
  }, [events]);

  useEffect(() => { ensureShimmer(); }, []);
  useEffect(() => { fetchEvents(); }, []);

  // Scroll tracking
  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 5);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 5);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const pageWidth = el.clientWidth;
      const page = Math.round(el.scrollLeft / pageWidth);
      setScrollPage(page);
      updateScrollButtons();
    };
    // Initial check
    updateScrollButtons();
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [events, updateScrollButtons]);

  const scrollToPage = (page: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: page * el.clientWidth, behavior: 'smooth' });
  };

  const scrollByPage = (direction: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth, behavior: 'smooth' });
  };

  const fetchEvents = async () => {
    try {
      setIsLoading(true); setError(null);
      const response = await apiService.get('/events');
      setEvents(response.data?.data || []);
    } catch (err: any) {
      console.error('Error fetching events:', err);
      setError(err.response?.data?.error || 'Failed to load events');
    } finally { setIsLoading(false); }
  };

  const upcomingEvents = useMemo(() => events.filter(e => e.status === 'upcoming'), [events]);
  const pastEvents = useMemo(() => events.filter(e => e.status === 'past'), [events]);

  const needsCarousel = upcomingEvents.length > 3;

  const handleRegister = async () => {
    if (selectedEvent && user?.id) {
      setRegistering(true);
      try {
        const response = await apiService.post(`/events/${selectedEvent.id}/register`);
        if (response.data?.success) {
          setEvents(events.map(e => e.id === selectedEvent.id ? { ...e, registered: true, totalAttendees: (e.totalAttendees || 0) + 1 } : e));
          setSelectedEvent(prev => prev ? { ...prev, registered: true, totalAttendees: (prev.totalAttendees || 0) + 1 } : null);
        }
      } catch (err: any) { alert(err.response?.data?.error || 'Failed to register'); }
      finally { setRegistering(false); }
    }
  };

  const handleUnregister = async () => {
    if (selectedEvent && user?.id) {
      setRegistering(true);
      try {
        const response = await apiService.delete(`/events/${selectedEvent.id}/register`);
        if (response.data?.success) {
          setEvents(events.map(e => e.id === selectedEvent.id ? { ...e, registered: false, totalAttendees: Math.max((e.totalAttendees || 1) - 1, 0) } : e));
          setSelectedEvent(prev => prev ? { ...prev, registered: false, totalAttendees: Math.max((prev.totalAttendees || 1) - 1, 0) } : null);
        }
      } catch (err: any) { alert(err.response?.data?.error || 'Failed to unregister'); }
      finally { setRegistering(false); }
    }
  };

  // ─── Event Card ───
  const EventCard = ({ event, isLast, stretch }: { event: Event; isLast: boolean; stretch?: boolean }) => {
    const d = parseDate(event.startDate || event.date);
    return (
      <div
        onClick={() => setSelectedEvent(event)}
        style={{
          flex: stretch ? '1 1 0%' : '0 0 calc(100% / 3)',
          minWidth: 0,
          background: C.pureWhite, cursor: 'pointer', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          borderRight: isLast ? 'none' : bdr,
          transition: 'background .15s',
          boxSizing: 'border-box',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = C.surface)}
        onMouseLeave={e => (e.currentTarget.style.background = C.pureWhite)}
      >
        {/* Cover image */}
        <div style={{ position: 'relative', height: 160, background: C.black, overflow: 'hidden' }}>
          {event.coverImage ? (
            <img src={event.coverImage} alt={event.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          ) : (
            <div style={{
              width: '100%', height: '100%',
              background: `linear-gradient(135deg, ${C.gray} 0%, ${C.mid} 100%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: '11px', color: '#555', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                {getTagLabel(event.tag)}
              </span>
            </div>
          )}
          {/* Date badge */}
          <div style={{
            position: 'absolute', top: 12, left: 12,
            background: C.red, padding: '6px 10px', textAlign: 'center',
            minWidth: 38, borderRadius: 4,
          }}>
            <div style={{ fontSize: '18px', fontWeight: 600, lineHeight: 1, color: '#fff' }}>{d.day}</div>
            <div style={{ fontSize: '8px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>{d.month}</div>
          </div>
          {/* Registered badge */}
          {event.registered && (
            <div style={{
              position: 'absolute', top: 12, right: 12,
              background: 'rgba(42,157,78,0.9)', color: '#fff',
              fontSize: '8px', fontWeight: 600, letterSpacing: '0.1em',
              padding: '4px 8px', textTransform: 'uppercase', borderRadius: 3,
            }}>Registered</div>
          )}
        </div>

        {/* Card body */}
        <div style={{ padding: '18px 20px', flex: 1, display: 'flex', flexDirection: 'column', background: C.cardBody }}>
          <div style={{
            fontSize: '9px', letterSpacing: '0.25em', textTransform: 'uppercase',
            color: getTagColor(event.tag), marginBottom: 8, fontWeight: 600,
          }}>
            {getTagLabel(event.tag)}
          </div>
          <h3 style={{ fontSize: '14px', fontWeight: 500, margin: '0 0 8px', lineHeight: 1.35, color: C.black }}>
            {event.title}
          </h3>
          <div style={{ fontSize: '11px', color: C.muted, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ color: C.red, fontSize: '6px' }}>●</span>
            {event.location}
          </div>
          <p style={{
            fontSize: '11px', color: C.muted, lineHeight: 1.65, flex: 1, margin: 0,
            fontWeight: 300,
            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {event.description}
          </p>
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: bdr }}>
            <span style={{ fontSize: '14px', color: C.muted }}>→</span>
          </div>
        </div>
      </div>
    );
  };

  // ─── Loading ───

  if (isLoading) {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 48px 80px', fontFamily: "'Inter',sans-serif" }}>
        <Sk w="120px" h="10px" s={{ marginBottom: 10 }} />
        <Sk w="320px" h="38px" s={{ marginBottom: 8 }} />
        <Sk w="400px" h="13px" s={{ marginBottom: 36 }} />
        <div style={{ display: 'flex', border: bdr, borderRadius: 8, overflow: 'hidden' }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ flex: '1 1 0%', borderRight: i < 2 ? bdr : 'none' }}>
              <div style={{ ...shimmer, width: '100%', height: 160 }} />
              <div style={{ padding: 20 }}>
                <Sk w="60%" h="10px" s={{ marginBottom: 8 }} />
                <Sk w="80%" h="14px" s={{ marginBottom: 6 }} />
                <Sk w="50%" h="11px" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Group upcoming into pages of 3 (only used for carousel mode) ───
  const upcomingPages: Event[][] = [];
  for (let i = 0; i < upcomingEvents.length; i += 3) {
    upcomingPages.push(upcomingEvents.slice(i, i + 3));
  }

  // ═══════════════════════════════
  //  RENDER
  // ═══════════════════════════════

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 48px 80px', fontFamily: "'Inter',sans-serif", color: C.gray }}>

      {/* ══════ HEADER ══════ */}
      <div style={{
        marginBottom: '2.5rem', paddingBottom: '2rem', borderBottom: bdr,
      }}>
        <div style={{ ...sectionLabel, color: C.red, letterSpacing: '0.3em', marginBottom: 8, fontSize: '10px' }}>
          experiences
        </div>
        <h1 style={{ fontSize: 'clamp(32px, 4vw, 40px)', fontWeight: 300, lineHeight: 1.1, margin: '0 0 8px', color: C.black }}>
          Exclusive zai experiences
        </h1>
        <p style={{ color: C.muted, fontSize: '13px', margin: 0, fontWeight: 300, maxWidth: 520 }}>
          Experience card holders receive priority access to exclusive events.
        </p>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(200,16,46,0.06)', border: '1px solid rgba(200,16,46,0.15)', marginBottom: 20, fontSize: '13px', color: C.red, borderRadius: 6 }}>
          {error}
        </div>
      )}

      {/* ══════ UPCOMING EVENTS ══════ */}
      <div style={{ ...sectionLabel, color: C.black, marginBottom: 16, fontSize: '11px' }}>
        upcoming events
      </div>

      {upcomingEvents.length === 0 ? (
        <div style={{ padding: '48px 24px', textAlign: 'center', background: C.surface, border: bdr, marginBottom: 48, borderRadius: 8 }}>
          <div style={{ fontSize: '15px', fontWeight: 300, color: C.black, marginBottom: 4 }}>No upcoming events</div>
          <p style={{ color: C.muted, fontSize: '12px', margin: 0 }}>Check back soon for new experiences.</p>
        </div>
      ) : !needsCarousel ? (
        /* ── ≤3 events → stretch to fill, no carousel ── */
        <div style={{ marginBottom: 48 }}>
          <div style={{
            display: 'flex', border: bdr, borderRadius: 8, overflow: 'hidden',
          }}>
            {upcomingEvents.map((event, idx) => (
              <EventCard
                key={event.id}
                event={event}
                isLast={idx === upcomingEvents.length - 1}
                stretch
              />
            ))}
          </div>
        </div>
      ) : (
        /* ── >3 events → carousel with side arrows ── */
        <div style={{ marginBottom: 48, position: 'relative' }}>

          {/* LEFT ARROW */}
          {canScrollLeft && (
            <button
              onClick={() => scrollByPage(-1)}
              style={{ ...sideArrowBase, left: -18 }}
              onMouseEnter={e => { e.currentTarget.style.background = C.pureWhite; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.22)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.92)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'; }}
              aria-label="Scroll left"
            >
              ‹
            </button>
          )}

          {/* RIGHT ARROW */}
          {canScrollRight && (
            <button
              onClick={() => scrollByPage(1)}
              style={{ ...sideArrowBase, right: -18 }}
              onMouseEnter={e => { e.currentTarget.style.background = C.pureWhite; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.22)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.92)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'; }}
              aria-label="Scroll right"
            >
              ›
            </button>
          )}

          <div
            ref={scrollRef}
            style={{
              display: 'flex', overflow: 'hidden', overflowX: 'auto',
              border: bdr, borderRadius: 8,
              scrollSnapType: 'x mandatory',
              scrollbarWidth: 'none',
            }}
          >
            {upcomingPages.map((page, pageIdx) => (
              <div
                key={pageIdx}
                style={{
                  display: 'flex', flex: '0 0 100%', scrollSnapAlign: 'start',
                }}
              >
                {page.map((event, idx) => {
                  const isLastInPage = idx === page.length - 1;
                  return (
                    <EventCard key={event.id} event={event} isLast={isLastInPage} />
                  );
                })}
                {/* Fill remaining slots if page has <3 cards */}
                {page.length < 3 && Array.from({ length: 3 - page.length }).map((_, i) => (
                  <div key={`empty-${i}`} style={{ flex: '0 0 calc(100% / 3)', background: C.cardBody }} />
                ))}
              </div>
            ))}
          </div>

          {/* Carousel dots */}
          {upcomingPages.length > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 16 }}>
              {upcomingPages.map((_, i) => (
                <button
                  key={i}
                  onClick={() => scrollToPage(i)}
                  style={{
                    width: scrollPage === i ? 24 : 8, height: 8,
                    borderRadius: 4, border: 'none', cursor: 'pointer',
                    background: scrollPage === i ? C.black : C.border,
                    transition: 'all .25s ease', padding: 0,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════ PAST EVENTS ══════ */}
      <div style={{ ...sectionLabel, color: C.black, marginBottom: 16, fontSize: '11px' }}>
        past events
      </div>

      {pastEvents.length === 0 ? (
        <div style={{
          border: bdr, borderRadius: 6, overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '16px 20px', background: C.pureWhite,
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
              background: C.border,
            }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 400, color: C.muted, fontStyle: 'italic' }}>
                No past events yet
              </div>
              <div style={{ fontSize: '10px', color: C.border, marginTop: 3 }}>
                Events you attend will appear here
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ border: bdr, borderRadius: 6, overflow: 'hidden' }}>
          {pastEvents.map((event, idx) => {
            const d = parseDate(event.startDate || event.date);
            return (
              <div key={event.id} onClick={() => setSelectedEvent(event)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '16px 20px',
                  borderBottom: idx < pastEvents.length - 1 ? bdr : 'none',
                  cursor: 'pointer', background: C.pureWhite, transition: 'background .15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = C.surface)}
                onMouseLeave={e => (e.currentTarget.style.background = C.pureWhite)}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: EVENT_DOT_COLORS[idx % EVENT_DOT_COLORS.length],
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: C.black }}>{event.title}</div>
                  <div style={{ fontSize: '10px', color: C.muted, marginTop: 3 }}>
                    {d.short} · {event.location}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════ EVENT DETAIL MODAL ══════ */}
      {selectedEvent && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.8)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '2rem',
        }}
          onClick={() => setSelectedEvent(null)}>
          <div onClick={e => e.stopPropagation()}
            style={{
              background: C.white, maxWidth: 640, width: '100%', maxHeight: '90vh', overflowY: 'auto',
              boxShadow: '0 24px 80px rgba(0,0,0,0.5)', borderRadius: 8,
            }}>

            {/* Cover */}
            {selectedEvent.coverImage && (
              <div style={{ height: 240, overflow: 'hidden', borderRadius: '8px 8px 0 0' }}>
                <img src={selectedEvent.coverImage} alt={selectedEvent.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
            )}

            {/* Content */}
            <div style={{ padding: '28px 32px 32px' }}>
              <div style={{
                fontSize: '9px', letterSpacing: '0.25em', textTransform: 'uppercase',
                color: getTagColor(selectedEvent.tag), marginBottom: 6, fontWeight: 600,
              }}>
                {getTagLabel(selectedEvent.tag)}
              </div>

              <h2 style={{ fontSize: 22, fontWeight: 400, margin: '0 0 12px', color: C.black, lineHeight: 1.3 }}>
                {selectedEvent.title}
              </h2>

              <div style={{ display: 'flex', gap: 24, marginBottom: 20, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: C.red, fontSize: '8px' }}>●</span>
                  <span style={{ fontSize: 12, color: C.muted }}>
                    {parseDate(selectedEvent.startDate || selectedEvent.date).full}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: C.muted }}>{selectedEvent.location}</div>
              </div>

              <p style={{ fontSize: 13, lineHeight: 1.7, color: C.mid, margin: '0 0 20px', fontWeight: 300 }}>
                {selectedEvent.description}
              </p>

              {/* Program */}
              {(() => {
                const lines = parseProgramLines(selectedEvent.program);
                if (lines.length === 0) return null;
                return (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ ...lbl, marginBottom: 10 }}>Program</div>
                    <div style={{ background: C.surface, borderRadius: 6, padding: '14px 18px' }}>
                      {lines.map((line, i) => (
                        <div key={i} style={{
                          fontSize: 12, lineHeight: 1.6, color: C.mid,
                          padding: '4px 0', borderBottom: i < lines.length - 1 ? `1px solid ${C.border}` : 'none',
                        }}>
                          {line}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Price section */}
              {selectedEvent.price != null && selectedEvent.price > 0 && (
                <div style={{
                  padding: '16px 20px', background: C.surface, borderRadius: 6, marginBottom: 20,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={lbl}>Price</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                      {selectedEvent.discountPrice != null ? (
                        <>
                          <span style={{ fontSize: 18, fontWeight: 600, color: C.red }}>
                            {selectedEvent.currency || 'CHF'} {selectedEvent.discountPrice}
                          </span>
                          <span style={{ fontSize: 13, color: C.muted, textDecoration: 'line-through' }}>
                            {selectedEvent.currency || 'CHF'} {selectedEvent.price}
                          </span>
                        </>
                      ) : (
                        <span style={{ fontSize: 18, fontWeight: 600, color: C.black }}>
                          {selectedEvent.currency || 'CHF'} {selectedEvent.price}
                        </span>
                      )}
                    </div>
                  </div>
                  {selectedEvent.discountPercentage != null && (
                    <div style={{
                      background: C.red, color: '#fff', padding: '4px 10px',
                      fontSize: 11, fontWeight: 600, borderRadius: 4,
                    }}>
                      -{selectedEvent.discountPercentage}%
                    </div>
                  )}
                </div>
              )}

              {/* Attendees */}
              {selectedEvent.maxAttendees && (
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 20 }}>
                  {selectedEvent.totalAttendees || 0} / {selectedEvent.maxAttendees} attendees
                </div>
              )}

              {/* Register / Unregister */}
              <div style={{ display: 'flex', gap: 12 }}>
                {selectedEvent.registered ? (
                  <button
                    onClick={handleUnregister}
                    disabled={registering}
                    style={{
                      flex: 1, padding: '14px 24px', background: C.surface, border: bdr,
                      fontSize: 12, fontWeight: 600, cursor: registering ? 'wait' : 'pointer',
                      fontFamily: "'Inter',sans-serif", letterSpacing: '0.1em', textTransform: 'uppercase',
                      transition: 'all .15s',
                    }}
                  >
                    {registering ? 'Processing…' : 'Cancel Registration'}
                  </button>
                ) : (
                  <button
                    onClick={handleRegister}
                    disabled={registering}
                    style={{
                      flex: 1, padding: '14px 24px', background: C.red, color: '#fff', border: 'none',
                      fontSize: 12, fontWeight: 600, cursor: registering ? 'wait' : 'pointer',
                      fontFamily: "'Inter',sans-serif", letterSpacing: '0.1em', textTransform: 'uppercase',
                      borderRadius: 4, transition: 'background .15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = C.burgundy)}
                    onMouseLeave={e => (e.currentTarget.style.background = C.red)}
                  >
                    {registering ? 'Processing…' : 'Register'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Events;
