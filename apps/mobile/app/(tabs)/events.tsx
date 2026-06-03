import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  ActivityIndicator, RefreshControl, Modal, Pressable, Dimensions,
} from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { apiService } from '@/services/api';
import ScreenBackground from '@/components/ScreenBackground';
import { DARK_THEME } from '@/theme/colors';

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
  tier: string;
  status: 'upcoming' | 'past';
  registered: boolean;
  maxAttendees?: number | null;
  totalAttendees?: number;
  price?: number;
  currency?: string;
  discountPrice?: number | null;
  discountPercentage?: number | null;
}

// ─── Helpers ───

function parseDate(dateStr: string) {
  try {
    const d = new Date(dateStr);
    return {
      day: d.getDate(),
      month: d.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
      year: d.getFullYear(),
      full: d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      short: `${d.getDate()} ${d.toLocaleString('en-US', { month: 'long' })} ${d.getFullYear()}`,
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
  if (t.includes('demo')) return DARK_THEME.primary;
  if (t.includes('factory')) return DARK_THEME.textSecondary;
  if (t.includes('partner')) return '#f59e0b';
  return DARK_THEME.textSecondary;
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

const DOT_COLORS = ['#7A222E', '#f59e0b', '#2563eb', '#10b981', '#8b5cf6', '#ec4899'];
const { width: SCREEN_W } = Dimensions.get('window');

// ═══════════════════════════════
//  COMPONENT
// ═══════════════════════════════

export default function EventsScreen() {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [registering, setRegistering] = useState(false);

  const fetchEvents = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    setError(null);
    try {
      const res = await apiService.get('/events');
      setEvents(res.data?.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load events');
    } finally {
      if (!background) setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchEvents(true);
    setRefreshing(false);
  };

  const upcomingEvents = useMemo(() => events.filter(e => e.status === 'upcoming'), [events]);
  const pastEvents = useMemo(() => events.filter(e => e.status === 'past'), [events]);

  const handleRegister = async () => {
    if (!selectedEvent || !user?.id) return;
    setRegistering(true);
    try {
      const res = await apiService.post(`/events/${selectedEvent.id}/register`);
      if (res.data?.success) {
        setEvents(prev => prev.map(e =>
          e.id === selectedEvent.id
            ? { ...e, registered: true, totalAttendees: (e.totalAttendees || 0) + 1 }
            : e
        ));
        setSelectedEvent(prev =>
          prev ? { ...prev, registered: true, totalAttendees: (prev.totalAttendees || 0) + 1 } : null
        );
      }
    } catch (err: any) {
      // show inline
    } finally { setRegistering(false); }
  };

  const handleUnregister = async () => {
    if (!selectedEvent || !user?.id) return;
    setRegistering(true);
    try {
      const res = await apiService.delete(`/events/${selectedEvent.id}/register`);
      if (res.data?.success) {
        setEvents(prev => prev.map(e =>
          e.id === selectedEvent.id
            ? { ...e, registered: false, totalAttendees: Math.max((e.totalAttendees || 1) - 1, 0) }
            : e
        ));
        setSelectedEvent(prev =>
          prev ? { ...prev, registered: false, totalAttendees: Math.max((prev.totalAttendees || 1) - 1, 0) } : null
        );
      }
    } catch (err: any) {
      // show inline
    } finally { setRegistering(false); }
  };

  // ─── Loading ───

  if (loading) {
    return (
      <ScreenBackground variant="content">
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={DARK_THEME.primary} />
        </View>
      </ScreenBackground>
    );
  }

  // ═══════════════════════════════
  //  RENDER
  // ═══════════════════════════════

  return (
    <ScreenBackground variant="content">
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
      >
        {/* ── Header ── */}
        <Text style={styles.sectionLabel}>EXPERIENCES</Text>
        <Text style={styles.title}>Exclusive zai experiences</Text>
        <Text style={styles.subtitle}>
          Experience card holders receive priority access to exclusive events.
        </Text>

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* ══════ UPCOMING EVENTS ══════ */}
        <Text style={styles.groupLabel}>UPCOMING EVENTS</Text>

        {upcomingEvents.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No upcoming events</Text>
            <Text style={styles.emptyDesc}>Check back soon for new experiences.</Text>
          </View>
        ) : (
          upcomingEvents.map((event) => {
            const d = parseDate(event.startDate || event.date);
            return (
              <TouchableOpacity
                key={event.id}
                style={styles.eventCard}
                activeOpacity={0.85}
                onPress={() => setSelectedEvent(event)}
              >
                {/* Cover image */}
                <View style={styles.coverWrap}>
                  {event.coverImage ? (
                    <Image source={{ uri: event.coverImage }} style={styles.coverImage} />
                  ) : (
                    <View style={styles.coverPlaceholder}>
                      <Text style={styles.coverPlaceholderText}>{getTagLabel(event.tag)}</Text>
                    </View>
                  )}
                  {/* Date badge */}
                  <View style={styles.dateBadge}>
                    <Text style={styles.dateDay}>{d.day}</Text>
                    <Text style={styles.dateMonth}>{d.month}</Text>
                  </View>
                  {/* Registered badge */}
                  {event.registered && (
                    <View style={styles.registeredBadge}>
                      <Text style={styles.registeredText}>REGISTERED</Text>
                    </View>
                  )}
                </View>

                {/* Card body */}
                <View style={styles.cardBody}>
                  <Text style={[styles.tagLabel, { color: getTagColor(event.tag) }]}>
                    {getTagLabel(event.tag)}
                  </Text>
                  <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
                  <View style={styles.locationRow}>
                    <View style={styles.locationDot} />
                    <Text style={styles.locationText}>{event.location}</Text>
                  </View>
                  <Text style={styles.eventDesc} numberOfLines={3}>{event.description}</Text>
                  <View style={styles.cardFooter}>
                    <Text style={styles.arrowText}>→</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {/* ══════ PAST EVENTS ══════ */}
        <Text style={[styles.groupLabel, { marginTop: 36 }]}>PAST EVENTS</Text>

        {pastEvents.length === 0 ? (
          <View style={styles.pastEmptyCard}>
            <View style={[styles.pastDot, { backgroundColor: DARK_THEME.border }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.pastEmptyTitle}>No past events yet</Text>
              <Text style={styles.pastEmptyDesc}>Events you attend will appear here</Text>
            </View>
          </View>
        ) : (
          <View style={styles.pastList}>
            {pastEvents.map((event, idx) => {
              const d = parseDate(event.startDate || event.date);
              return (
                <TouchableOpacity
                  key={event.id}
                  style={[styles.pastRow, idx < pastEvents.length - 1 && styles.pastRowBorder]}
                  activeOpacity={0.75}
                  onPress={() => setSelectedEvent(event)}
                >
                  <View style={[styles.pastDot, { backgroundColor: DOT_COLORS[idx % DOT_COLORS.length] }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pastTitle}>{event.title}</Text>
                    <Text style={styles.pastSub}>{d.short} · {event.location}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ══════ EVENT DETAIL MODAL ══════ */}
      {selectedEvent && (
        <Modal transparent visible animationType="slide" onRequestClose={() => setSelectedEvent(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
                {/* Close button */}
                <TouchableOpacity style={styles.modalClose} onPress={() => setSelectedEvent(null)}>
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>

                {/* Cover */}
                {selectedEvent.coverImage && (
                  <Image source={{ uri: selectedEvent.coverImage }} style={styles.modalCover} />
                )}

                <View style={styles.modalBody}>
                  <Text style={[styles.tagLabel, { color: getTagColor(selectedEvent.tag), marginBottom: 6 }]}>
                    {getTagLabel(selectedEvent.tag)}
                  </Text>

                  <Text style={styles.modalTitle}>{selectedEvent.title}</Text>

                  <View style={styles.modalMeta}>
                    <View style={styles.locationRow}>
                      <View style={[styles.locationDot, { backgroundColor: DARK_THEME.primary }]} />
                      <Text style={styles.modalMetaText}>
                        {parseDate(selectedEvent.startDate || selectedEvent.date).full}
                      </Text>
                    </View>
                    <Text style={styles.modalMetaText}>{selectedEvent.location}</Text>
                  </View>

                  <Text style={styles.modalDesc}>{selectedEvent.description}</Text>

                  {/* Program */}
                  {(() => {
                    const lines = parseProgramLines(selectedEvent.program);
                    if (lines.length === 0) return null;
                    return (
                      <View style={styles.programSection}>
                        <Text style={styles.programLabel}>PROGRAM</Text>
                        {lines.map((line, i) => (
                          <Text key={i} style={styles.programLine}>{line}</Text>
                        ))}
                      </View>
                    );
                  })()}

                  {/* Price */}
                  {selectedEvent.price != null && selectedEvent.price > 0 && (
                    <View style={styles.priceCard}>
                      <View>
                        <Text style={styles.priceLabel}>PRICE</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                          {selectedEvent.discountPrice != null ? (
                            <>
                              <Text style={styles.priceValue}>
                                {selectedEvent.currency || 'CHF'} {selectedEvent.discountPrice}
                              </Text>
                              <Text style={styles.priceOriginal}>
                                {selectedEvent.currency || 'CHF'} {selectedEvent.price}
                              </Text>
                            </>
                          ) : (
                            <Text style={[styles.priceValue, { color: DARK_THEME.text }]}>
                              {selectedEvent.currency || 'CHF'} {selectedEvent.price}
                            </Text>
                          )}
                        </View>
                      </View>
                      {selectedEvent.discountPercentage != null && (
                        <View style={styles.discountBadge}>
                          <Text style={styles.discountText}>-{selectedEvent.discountPercentage}%</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Attendees */}
                  {selectedEvent.maxAttendees && (
                    <Text style={styles.attendeesText}>
                      {selectedEvent.totalAttendees || 0} / {selectedEvent.maxAttendees} attendees
                    </Text>
                  )}

                  {/* Register / Unregister */}
                  {selectedEvent.registered ? (
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={handleUnregister}
                      disabled={registering}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.cancelBtnText}>
                        {registering ? 'PROCESSING…' : 'CANCEL REGISTRATION'}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.registerBtn}
                      onPress={handleRegister}
                      disabled={registering}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.registerBtnText}>
                        {registering ? 'PROCESSING…' : 'REGISTER'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </ScreenBackground>
  );
}

// ═══════════════════════════════
//  STYLES
// ═══════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 24, paddingTop: 64, paddingBottom: 48 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  sectionLabel: { fontSize: 10, letterSpacing: 4, color: DARK_THEME.primary, fontWeight: '600', marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '300', color: DARK_THEME.text, lineHeight: 36, marginBottom: 8 },
  subtitle: { fontSize: 13, color: DARK_THEME.textSecondary, fontWeight: '300', marginBottom: 28, lineHeight: 20 },

  errorBanner: {
    padding: 12, backgroundColor: 'rgba(122,34,46,0.12)', borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(122,34,46,0.25)', marginBottom: 20,
  },
  errorText: { fontSize: 13, color: DARK_THEME.primary },

  groupLabel: { fontSize: 11, letterSpacing: 3, color: DARK_THEME.text, fontWeight: '600', marginBottom: 16 },

  // ── Upcoming event card ──
  eventCard: {
    backgroundColor: DARK_THEME.surface, borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: DARK_THEME.border, marginBottom: 16,
  },
  coverWrap: { position: 'relative', aspectRatio: 16 / 9, backgroundColor: DARK_THEME.background },
  coverImage: { width: '100%', height: '100%' },
  coverPlaceholder: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: DARK_THEME.card,
  },
  coverPlaceholderText: {
    fontSize: 10, letterSpacing: 3, color: DARK_THEME.textSecondary, textTransform: 'uppercase',
  },
  dateBadge: {
    position: 'absolute', top: 12, left: 12,
    backgroundColor: DARK_THEME.primary, paddingVertical: 6, paddingHorizontal: 10,
    borderRadius: 4, alignItems: 'center', minWidth: 42,
  },
  dateDay: { fontSize: 18, fontWeight: '600', color: '#fff', lineHeight: 20 },
  dateMonth: { fontSize: 8, letterSpacing: 1.5, color: 'rgba(255,255,255,0.85)', marginTop: 2, textTransform: 'uppercase' },
  registeredBadge: {
    position: 'absolute', top: 12, right: 12,
    backgroundColor: 'rgba(42,157,78,0.9)', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 3,
  },
  registeredText: { fontSize: 8, fontWeight: '700', letterSpacing: 1, color: '#fff' },

  cardBody: { padding: 18 },
  tagLabel: { fontSize: 9, letterSpacing: 3, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase' },
  eventTitle: { fontSize: 16, fontWeight: '500', color: DARK_THEME.text, lineHeight: 22, marginBottom: 8 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  locationDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: DARK_THEME.primary },
  locationText: { fontSize: 11, color: DARK_THEME.textSecondary },
  eventDesc: { fontSize: 12, color: DARK_THEME.textSecondary, lineHeight: 19, fontWeight: '300' },
  cardFooter: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: DARK_THEME.border },
  arrowText: { fontSize: 14, color: DARK_THEME.textSecondary },

  // ── Empty states ──
  emptyCard: {
    padding: 40, backgroundColor: DARK_THEME.surface, borderRadius: 12,
    borderWidth: 1, borderColor: DARK_THEME.border, alignItems: 'center',
  },
  emptyTitle: { fontSize: 15, fontWeight: '300', color: DARK_THEME.text, marginBottom: 4 },
  emptyDesc: { fontSize: 12, color: DARK_THEME.textSecondary },

  // ── Past events ──
  pastList: {
    borderWidth: 1, borderColor: DARK_THEME.border, borderRadius: 8, overflow: 'hidden',
  },
  pastRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14, paddingHorizontal: 16,
    backgroundColor: DARK_THEME.surface,
  },
  pastRowBorder: { borderBottomWidth: 1, borderBottomColor: DARK_THEME.border },
  pastDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  pastTitle: { fontSize: 14, fontWeight: '500', color: DARK_THEME.text },
  pastSub: { fontSize: 11, color: DARK_THEME.textSecondary, marginTop: 3 },
  pastEmptyCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 16, backgroundColor: DARK_THEME.surface, borderRadius: 8,
    borderWidth: 1, borderColor: DARK_THEME.border,
  },
  pastEmptyTitle: { fontSize: 13, color: DARK_THEME.textSecondary, fontStyle: 'italic' },
  pastEmptyDesc: { fontSize: 10, color: DARK_THEME.border, marginTop: 3 },

  // ── Modal ──
  modalOverlay: { flex: 1, backgroundColor: 'rgba(10,10,10,0.92)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: DARK_THEME.background, borderTopLeftRadius: 16, borderTopRightRadius: 16,
    maxHeight: '92%', overflow: 'hidden',
  },
  modalClose: {
    position: 'absolute', top: 16, right: 16, zIndex: 10,
    width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalCloseText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  modalCover: { width: '100%', aspectRatio: 16 / 9 },
  modalBody: { padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 22, fontWeight: '400', color: DARK_THEME.text, lineHeight: 30, marginBottom: 16 },
  modalMeta: { gap: 8, marginBottom: 20 },
  modalMetaText: { fontSize: 12, color: DARK_THEME.textSecondary },
  modalDesc: { fontSize: 13, lineHeight: 22, color: DARK_THEME.textSecondary, fontWeight: '300', marginBottom: 20 },

  // Program
  programSection: {
    backgroundColor: DARK_THEME.surface, borderRadius: 8, padding: 16, marginBottom: 20,
  },
  programLabel: { fontSize: 10, letterSpacing: 2, color: DARK_THEME.textSecondary, fontWeight: '600', marginBottom: 10 },
  programLine: {
    fontSize: 12, color: DARK_THEME.textSecondary, lineHeight: 20,
    paddingVertical: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: DARK_THEME.border,
  },

  // Price
  priceCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: DARK_THEME.surface, borderRadius: 8, padding: 16, marginBottom: 20,
  },
  priceLabel: { fontSize: 10, letterSpacing: 2, color: DARK_THEME.textSecondary, fontWeight: '600', marginBottom: 4 },
  priceValue: { fontSize: 18, fontWeight: '600', color: DARK_THEME.primary },
  priceOriginal: { fontSize: 13, color: DARK_THEME.textSecondary, textDecorationLine: 'line-through' },
  discountBadge: { backgroundColor: DARK_THEME.primary, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 4 },
  discountText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  attendeesText: { fontSize: 12, color: DARK_THEME.textSecondary, marginBottom: 20 },

  registerBtn: {
    backgroundColor: DARK_THEME.primary, borderRadius: 8, height: 52,
    alignItems: 'center', justifyContent: 'center',
  },
  registerBtnText: { color: '#fff', fontSize: 12, fontWeight: '700', letterSpacing: 1.5 },
  cancelBtn: {
    backgroundColor: DARK_THEME.surface, borderRadius: 8, height: 52,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: DARK_THEME.border,
  },
  cancelBtnText: { color: DARK_THEME.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 1.5 },
});
