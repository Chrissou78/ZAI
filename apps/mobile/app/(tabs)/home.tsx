import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Modal, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import ScreenBackground from '@/components/ScreenBackground';
import { DARK_THEME } from '@/theme/colors';

/* ── Locked button with info-bubble on press ── */
function LockedButton({
  label,
  style: btnStyle,
  textStyle,
  message,
}: {
  label: string;
  style?: any;
  textStyle?: any;
  message?: string;
}) {
  const [showBubble, setShowBubble] = useState(false);

  return (
    <View>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setShowBubble(true)}
        style={[btnStyle, { opacity: 0.35 }]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 14 }}>🔒</Text>
          <Text style={[textStyle, { color: '#888' }]}>{label}</Text>
        </View>
      </TouchableOpacity>

      {/* Info bubble modal */}
      <Modal transparent visible={showBubble} animationType="fade" onRequestClose={() => setShowBubble(false)}>
        <Pressable style={styles.bubbleOverlay} onPress={() => setShowBubble(false)}>
          <View style={styles.bubbleCard}>
            <Text style={{ fontSize: 24, marginBottom: 10 }}>🔒</Text>
            <Text style={styles.bubbleTitle}>Exclusive Content</Text>
            <Text style={styles.bubbleMessage}>
              {message || 'Access exclusive content with the Experience Card membership.'}
            </Text>
            <TouchableOpacity
              style={styles.bubbleDismiss}
              onPress={() => setShowBubble(false)}
            >
              <Text style={styles.bubbleDismissText}>OK</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

export default function HomeScreen() {
  const { user, hasExperienceCard, isAdmin } = useAuth();
  const router = useRouter();
  const exclusive = hasExperienceCard || isAdmin;

  return (
    <ScreenBackground>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Logo, centered */}
        <View style={styles.logoWrap}>
          <Image source={require('../../assets/zai-logo.png')} style={styles.logo} resizeMode="contain" />
        </View>

        {/* Hero copy */}
        <Text style={styles.clubLabel}>ZAI EXPERIENCE CLUB</Text>
        <Text style={styles.headline}>
          Your world.{'\n'}Beyond the{'\n'}
          <Text style={styles.headlineAccent}>mountain.</Text>
        </Text>
        <Text style={styles.welcome}>
          Welcome to zai Experience Club. Claim your products, sign up for zai events, and manage your
          personal zai ski collection all in one place. The zai Experience Club makes zai more personal,
          more interactive, and closer than ever.
        </Text>

        {/* Tier badge */}
        <View style={styles.tierBadge}>
          <View style={[styles.tierDot, { backgroundColor: isAdmin ? DARK_THEME.primary : hasExperienceCard ? DARK_THEME.gold : DARK_THEME.textSecondary }]} />
          <Text style={[styles.tierText, { color: isAdmin ? DARK_THEME.primary : hasExperienceCard ? DARK_THEME.gold : DARK_THEME.textSecondary }]}>
            {isAdmin ? (user?.role || 'admin').toUpperCase() : hasExperienceCard ? 'EXCLUSIVE MEMBER' : 'MEMBER'}
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          {exclusive ? (
            <>
              <TouchableOpacity
                style={styles.primaryBtn}
                activeOpacity={0.85}
                onPress={() => router.push('/products')}
              >
                <Text style={styles.primaryBtnText}>VIEW COLLECTION</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryBtn}
                activeOpacity={0.85}
                onPress={() => router.push('/events')}
              >
                <Text style={styles.secondaryBtnText}>SEE EVENTS</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <LockedButton
                label="CLAIM YOUR PRODUCT"
                style={styles.primaryBtn}
                textStyle={styles.primaryBtnText}
                message="Claim your zai Experience Card to unlock product claims and your personal collection."
              />
              <LockedButton
                label="SEE EVENTS"
                style={styles.secondaryBtn}
                textStyle={styles.secondaryBtnText}
                message="Access exclusive zai events with the Experience Card membership."
              />
            </>
          )}
        </View>

        {!hasExperienceCard && !isAdmin && (
          <View style={styles.upgradeCard}>
            <Text style={styles.upgradeTitle}>Become an Exclusive Member</Text>
            <Text style={styles.upgradeDesc}>
              Claim your zai Experience Card to unlock your collection, events, and the exclusive community.
            </Text>
          </View>
        )}
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 28, paddingTop: 80, paddingBottom: 48 },
  logoWrap: { alignItems: 'center', marginBottom: 40 },
  logo: { width: 132, height: 100 },
  clubLabel: {
    fontSize: 13, letterSpacing: 5, color: '#fdfdfd',
    textAlign: 'center', marginBottom: 20,
  },
  headline: {
    fontSize: 44, fontWeight: '300', color: '#ffffff',
    lineHeight: 48, letterSpacing: -0.5, textAlign: 'center', marginBottom: 20,
  },
  headlineAccent: { color: '#f5f4f0' },
  welcome: {
    fontSize: 14, color: '#bdbdbd', lineHeight: 22,
    textAlign: 'center', marginBottom: 28,
  },
  tierBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'center', marginBottom: 28,
  },
  tierDot: { width: 6, height: 6, borderRadius: 3 },
  tierText: { fontSize: 9, letterSpacing: 2, fontWeight: '700' },
  actions: { gap: 12, marginBottom: 32 },
  primaryBtn: {
    backgroundColor: DARK_THEME.primary, borderRadius: 10, height: 52,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  secondaryBtn: {
    backgroundColor: 'transparent', borderRadius: 10, height: 52,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)',
  },
  secondaryBtnText: { color: '#fff', fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  upgradeCard: {
    backgroundColor: 'rgba(26,26,26,0.75)', borderRadius: 12, padding: 24,
    borderWidth: 1, borderColor: DARK_THEME.border,
  },
  upgradeTitle: { fontSize: 16, fontWeight: '600', color: DARK_THEME.text, marginBottom: 8 },
  upgradeDesc: { fontSize: 13, color: DARK_THEME.textSecondary, lineHeight: 20 },
  // ── Info bubble styles ──
  bubbleOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  bubbleCard: {
    backgroundColor: '#1a1a1a', borderRadius: 16, padding: 28,
    alignItems: 'center', borderWidth: 1, borderColor: '#7A222E',
    maxWidth: 320, width: '100%',
  },
  bubbleTitle: {
    fontSize: 16, fontWeight: '700', color: '#7A222E',
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
