import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  RefreshControl, Modal, Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { apiService } from '@/services/api';
import ScreenBackground from '@/components/ScreenBackground';
import { DARK_THEME } from '@/theme/colors';

type Stats = { productsClaimed: number; upcomingEvents: number; insuranceActive: number };
type Activity = { id: string; type: 'product' | 'event'; title: string; date: string };

/* ── Locked section overlay with info bubble ── */
function LockedSection({
  children, locked, message,
}: { children: React.ReactNode; locked: boolean; message?: string }) {
  const [showBubble, setShowBubble] = useState(false);

  if (!locked) return <>{children}</>;

  return (
    <View>
      <TouchableOpacity activeOpacity={0.8} onPress={() => setShowBubble(true)}>
        <View style={{ opacity: 0.2 }} pointerEvents="none">{children}</View>
        <View style={styles.lockedBadge}>
          <Text style={{ fontSize: 12 }}>🔒</Text>
          <Text style={styles.lockedBadgeText}>Exclusive</Text>
        </View>
      </TouchableOpacity>
      <Modal transparent visible={showBubble} animationType="fade" onRequestClose={() => setShowBubble(false)}>
        <Pressable style={styles.bubbleOverlay} onPress={() => setShowBubble(false)}>
          <View style={styles.bubbleCard}>
            <Text style={{ fontSize: 24, marginBottom: 10 }}>🔒</Text>
            <Text style={styles.bubbleTitle}>Exclusive Content</Text>
            <Text style={styles.bubbleMessage}>
              {message || 'Access exclusive content with the Experience Card membership.'}
            </Text>
            <TouchableOpacity style={styles.bubbleDismiss} onPress={() => setShowBubble(false)}>
              <Text style={styles.bubbleDismissText}>OK</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

export default function DashboardScreen() {
  const { user, hasExperienceCard, isAdmin } = useAuth();
  const router = useRouter();
  const exclusive = hasExperienceCard || isAdmin;

  const [stats, setStats] = useState<Stats>({ productsClaimed: 0, upcomingEvents: 0, insuranceActive: 0 });
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (background = false) => {
    if (!user?.id) return;
    if (!background) setLoading(true);
    try {
      let products: any[] = [];
      let events: any[] = [];
      try {
        const r = await apiService.get(`/products/user/${user.id}`);
        products = r.data?.data || [];
      } catch { /* ignore */ }
      try {
        const r = await apiService.get('/events', { status: 'upcoming' });
        events = r.data?.data || [];
      } catch { /* ignore */ }

      const acts: Activity[] = [];
      [...products]
        .sort((a, b) => new Date(b.claimedAt || 0).getTime() - new Date(a.claimedAt || 0).getTime())
        .slice(0, 3)
        .forEach((p) => acts.push({ id: p.id, type: 'product', title: `Product claimed: ${p.name}`, date: p.claimedAt || p.createdAt || '' }));
      events.slice(0, 2).forEach((e) => acts.push({ id: e.id, type: 'event', title: `Event: ${e.title}`, date: e.date || '' }));
      acts.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

      setStats({
        productsClaimed: products.length,
        upcomingEvents: events.length,
        insuranceActive: products.filter((p) => p.insurance?.active).length,
      });
      setActivity(acts);
    } finally {
      if (!background) setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  };

  const fmtDate = (d: string) => {
    if (!d) return '';
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <ScreenBackground variant="content">
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
      >
        <Text style={styles.label}>OVERVIEW</Text>
        <Text style={styles.title}>
          Welcome back{user?.givenName ? `, ${user.givenName}` : ''}
        </Text>
        <View style={styles.tierBadge}>
          <View style={[styles.tierDot, { backgroundColor: isAdmin ? DARK_THEME.primary : hasExperienceCard ? DARK_THEME.gold : DARK_THEME.textSecondary }]} />
          <Text style={[styles.tierText, { color: isAdmin ? DARK_THEME.primary : hasExperienceCard ? DARK_THEME.gold : DARK_THEME.textSecondary }]}>
            {isAdmin ? (user?.role || 'admin').toUpperCase() : hasExperienceCard ? 'EXCLUSIVE MEMBER' : 'MEMBER'}
          </Text>
        </View>

        {loading ? (
          <View style={styles.loading}><ActivityIndicator color="#fff" /></View>
        ) : (
          <>
            {/* Admin shortcut */}
            {isAdmin && (
              <TouchableOpacity style={styles.adminCard} activeOpacity={0.85} onPress={() => router.push('/admin')}>
                <Ionicons name="shield-checkmark-outline" size={20} color={DARK_THEME.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.adminTitle}>Claim Review</Text>
                  <Text style={styles.adminDesc}>Validate or reject proof-of-purchase submissions</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={DARK_THEME.textSecondary} />
              </TouchableOpacity>
            )}

            {/* Member without card → upgrade path */}
            {!exclusive && (
              <View style={styles.upgradeCard}>
                <Text style={styles.upgradeTitle}>Become an Exclusive Member</Text>
                <Text style={styles.upgradeDesc}>
                  Claim your zai Experience Card to unlock your collection, events, and the community.
                </Text>
                <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.85} onPress={() => router.push('/products')}>
                  <Text style={styles.primaryBtnText}>CLAIM YOUR PRODUCT</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Stats — products always visible, events + insured gated */}
            <View style={styles.statsRow}>
              <Stat label="PRODUCTS" value={stats.productsClaimed} />
              <LockedSection locked={!exclusive} message="Access events tracking with the Experience Card membership.">
                <Stat label="EVENTS" value={stats.upcomingEvents} />
              </LockedSection>
              <LockedSection locked={!exclusive} message="Insurance tracking available with the Experience Card membership.">
                <Stat label="INSURED" value={stats.insuranceActive} />
              </LockedSection>
            </View>

            {/* Quick actions — gated for non-exclusive */}
            <LockedSection locked={!exclusive} message="Access exclusive content with the Experience Card membership.">
              <View style={styles.actions}>
                <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.85} onPress={() => router.push('/products')}>
                  <Text style={styles.primaryBtnText}>VIEW COLLECTION</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.85} onPress={() => router.push('/events')}>
                  <Text style={styles.secondaryBtnText}>SEE EVENTS</Text>
                </TouchableOpacity>
              </View>
            </LockedSection>

            {/* Recent activity — gated for non-exclusive */}
            <LockedSection locked={!exclusive} message="Access your activity feed with the Experience Card membership.">
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>RECENT ACTIVITY</Text>
                {activity.length === 0 ? (
                  <Text style={styles.empty}>No activity yet.</Text>
                ) : (
                  activity.map((a) => (
                    <View key={`${a.type}-${a.id}`} style={styles.activityRow}>
                      <Ionicons
                        name={a.type === 'product' ? 'cube-outline' : 'calendar-outline'}
                        size={18}
                        color={DARK_THEME.gold}
                      />
                      <Text style={styles.activityTitle} numberOfLines={1}>{a.title}</Text>
                      <Text style={styles.activityDate}>{fmtDate(a.date)}</Text>
                    </View>
                  ))
                )}
              </View>
            </LockedSection>
          </>
        )}
      </ScrollView>
    </ScreenBackground>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 24, paddingTop: 64, paddingBottom: 48 },
  label: { fontSize: 11, letterSpacing: 4, color: DARK_THEME.primary, fontWeight: '500', marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '300', color: DARK_THEME.text, lineHeight: 36 },
  tierBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, marginBottom: 28 },
  tierDot: { width: 6, height: 6, borderRadius: 3 },
  tierText: { fontSize: 9, letterSpacing: 2, fontWeight: '700' },
  loading: { paddingVertical: 48, alignItems: 'center' },
  adminCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(26,26,26,0.8)', borderRadius: 12, padding: 18,
    borderWidth: 1, borderColor: DARK_THEME.border, marginBottom: 20,
  },
  adminTitle: { fontSize: 15, fontWeight: '600', color: DARK_THEME.text },
  adminDesc: { fontSize: 12, color: DARK_THEME.textSecondary, marginTop: 2 },
  upgradeCard: {
    backgroundColor: 'rgba(26,26,26,0.8)', borderRadius: 12, padding: 24,
    borderWidth: 1, borderColor: DARK_THEME.border, marginBottom: 20,
  },
  upgradeTitle: { fontSize: 16, fontWeight: '600', color: DARK_THEME.text, marginBottom: 8 },
  upgradeDesc: { fontSize: 13, color: DARK_THEME.textSecondary, lineHeight: 20, marginBottom: 18 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard: {
    flex: 1, backgroundColor: 'rgba(26,26,26,0.8)', borderRadius: 12,
    paddingVertical: 20, alignItems: 'center', borderWidth: 1, borderColor: DARK_THEME.border,
  },
  statValue: { fontSize: 30, fontWeight: '200', color: DARK_THEME.text },
  statLabel: { fontSize: 9, letterSpacing: 2, color: DARK_THEME.textSecondary, marginTop: 6 },
  actions: { gap: 12, marginBottom: 32 },
  primaryBtn: { backgroundColor: DARK_THEME.primary, borderRadius: 10, height: 52, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  secondaryBtn: { borderRadius: 10, height: 52, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  secondaryBtnText: { color: '#fff', fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  section: { marginTop: 4 },
  sectionLabel: { fontSize: 11, letterSpacing: 3, color: DARK_THEME.textSecondary, fontWeight: '600', marginBottom: 14 },
  empty: { fontSize: 13, color: DARK_THEME.textSecondary },
  activityRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: DARK_THEME.border,
  },
  activityTitle: { flex: 1, fontSize: 13, color: DARK_THEME.text },
  activityDate: { fontSize: 11, color: DARK_THEME.textSecondary },
  // ── Locked badge + bubble styles ──
  lockedBadge: {
    position: 'absolute', top: '40%', alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  lockedBadgeText: {
    fontSize: 10, letterSpacing: 1, fontWeight: '700',
    color: '#c9a84c', textTransform: 'uppercase',
  },
  bubbleOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  bubbleCard: {
    backgroundColor: '#1a1a1a', borderRadius: 16, padding: 28,
    alignItems: 'center', borderWidth: 1, borderColor: '#c9a84c',
    maxWidth: 320, width: '100%',
  },
  bubbleTitle: {
    fontSize: 16, fontWeight: '700', color: '#c9a84c',
    letterSpacing: 1, marginBottom: 8,
  },
  bubbleMessage: {
    fontSize: 13, color: '#bbb', lineHeight: 20,
    textAlign: 'center', marginBottom: 20,
  },
  bubbleDismiss: {
    backgroundColor: DARK_THEME.primary, borderRadius: 8,
    paddingHorizontal: 32, paddingVertical: 10,
  },
  bubbleDismissText: {
    color: '#fff', fontSize: 12, fontWeight: '700', letterSpacing: 1,
  },
});
