import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { DARK_THEME } from '@/theme/colors';

export default function HomeScreen() {
  const { user, hasExperienceCard, isAdmin } = useAuth();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.sectionLabel}>OVERVIEW</Text>
        <Text style={styles.greeting}>
          Welcome back{user?.givenName ? `, ${user.givenName}` : ''}
        </Text>
        <View style={styles.tierBadge}>
          <View style={[styles.tierDot, {
            backgroundColor: isAdmin ? DARK_THEME.primary : hasExperienceCard ? DARK_THEME.gold : DARK_THEME.textSecondary,
          }]} />
          <Text style={[styles.tierText, {
            color: isAdmin ? DARK_THEME.primary : hasExperienceCard ? DARK_THEME.gold : DARK_THEME.textSecondary,
          }]}>
            {isAdmin ? (user?.role || 'admin').toUpperCase() : hasExperienceCard ? 'EXCLUSIVE MEMBER' : 'MEMBER'}
          </Text>
        </View>
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK_THEME.background },
  content: { padding: 24, paddingTop: 64 },
  header: { marginBottom: 32 },
  sectionLabel: {
    fontSize: 11, letterSpacing: 4, color: DARK_THEME.primary,
    fontWeight: '500', marginBottom: 8,
  },
  greeting: {
    fontSize: 28, fontWeight: '300', color: DARK_THEME.text,
    lineHeight: 36,
  },
  tierBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8,
  },
  tierDot: { width: 6, height: 6, borderRadius: 3 },
  tierText: { fontSize: 9, letterSpacing: 2, fontWeight: '700' },
  upgradeCard: {
    backgroundColor: DARK_THEME.surface,
    borderRadius: 12, padding: 24,
    borderWidth: 1, borderColor: DARK_THEME.border,
  },
  upgradeTitle: {
    fontSize: 16, fontWeight: '600', color: DARK_THEME.text, marginBottom: 8,
  },
  upgradeDesc: {
    fontSize: 13, color: DARK_THEME.textSecondary, lineHeight: 20,
  },
});
