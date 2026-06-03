import { Redirect } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import ScreenBackground from '@/components/ScreenBackground';
import { DARK_THEME } from '@/theme/colors';

export default function Index() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <ScreenBackground>
        <View style={styles.center}>
          <ActivityIndicator color="#ffffff" size="large" />
        </View>
      </ScreenBackground>
    );
  }

  return <Redirect href={user ? '/home' : '/login'} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});