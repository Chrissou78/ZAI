import { Redirect } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { DARK_THEME } from '@/theme/colors';

export default function Index() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={DARK_THEME.primary} size="large" />
      </View>
    );
  }

  return <Redirect href={user ? '/home' : '/login'} />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: DARK_THEME.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});