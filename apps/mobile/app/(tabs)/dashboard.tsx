import { View, Text, StyleSheet } from 'react-native';
import { DARK_THEME } from '@/theme/colors';

export default function DashboardScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>OVERVIEW</Text>
      <Text style={styles.title}>Dashboard</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK_THEME.background, padding: 24, paddingTop: 64 },
  sectionLabel: { fontSize: 11, letterSpacing: 4, color: DARK_THEME.primary, fontWeight: '500', marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '300', color: DARK_THEME.text },
});
