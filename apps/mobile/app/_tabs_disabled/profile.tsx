import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { DARK_THEME } from '@/theme/colors';
import { useRouter } from 'expo-router';

export default function ProfileScreen() {
  const { user, hasExperienceCard, isAdmin, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>ACCOUNT</Text>
      <Text style={styles.title}>Profile</Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>NAME</Text>
        <Text style={styles.cardValue}>
          {user?.givenName || user?.firstName || ''} {user?.familyName || user?.lastName || ''}
        </Text>

        {user?.email && (
          <>
            <Text style={[styles.cardLabel, { marginTop: 16 }]}>EMAIL</Text>
            <Text style={styles.cardValue}>{user.email}</Text>
          </>
        )}

        <Text style={[styles.cardLabel, { marginTop: 16 }]}>TIER</Text>
        <Text style={[styles.cardValue, {
          color: isAdmin ? DARK_THEME.primary : hasExperienceCard ? DARK_THEME.gold : DARK_THEME.textSecondary,
        }]}>
          {isAdmin ? (user?.role || 'admin').toUpperCase() : hasExperienceCard ? 'EXCLUSIVE MEMBER' : 'MEMBER'}
        </Text>
      </View>

      <Pressable style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>LOG OUT</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK_THEME.background, padding: 24, paddingTop: 64 },
  sectionLabel: { fontSize: 11, letterSpacing: 4, color: DARK_THEME.primary, fontWeight: '500', marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '300', color: DARK_THEME.text, marginBottom: 32 },
  card: {
    backgroundColor: DARK_THEME.surface, borderRadius: 12, padding: 20,
    borderWidth: 1, borderColor: DARK_THEME.border,
  },
  cardLabel: { fontSize: 9, letterSpacing: 2, color: DARK_THEME.textSecondary, fontWeight: '600' },
  cardValue: { fontSize: 15, color: DARK_THEME.text, marginTop: 4 },
  logoutBtn: {
    marginTop: 32, paddingVertical: 14, borderRadius: 4,
    borderWidth: 1, borderColor: DARK_THEME.border, alignItems: 'center',
  },
  logoutText: { fontSize: 11, letterSpacing: 3, color: DARK_THEME.textSecondary, fontWeight: '600' },
});
