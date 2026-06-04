import { useEffect, useRef, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppState, View, Text, StyleSheet, AppStateStatus } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { DARK_THEME } from '@/theme/colors';
import { LogBox } from 'react-native';

LogBox.ignoreLogs(['Unable to activate keep awake']);

function BiometricGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [locked, setLocked] = useState(false);
  const [checking, setChecking] = useState(false);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const lastBackground = useRef<number>(0);

  const LOCK_AFTER_MS = 3000; // lock after 3s in background

  const authenticate = async () => {
    setChecking(true);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        // No biometrics available — let user through
        setLocked(false);
        setChecking(false);
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock ZAI',
        fallbackLabel: 'Use passcode',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (result.success) {
        setLocked(false);
      }
      // If failed, stay locked — user can retry by tapping
    } catch {
      // Auth error — stay locked
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    // Don't gate if user is not logged in
    if (!user) {
      setLocked(false);
      return;
    }

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const prev = appState.current;
      appState.current = nextState;

      if (prev === 'active' && (nextState === 'background' || nextState === 'inactive')) {
        // Record when we went to background
        lastBackground.current = Date.now();
      }

      if ((prev === 'background' || prev === 'inactive') && nextState === 'active') {
        // Coming back — check if enough time passed
        const elapsed = Date.now() - lastBackground.current;
        if (elapsed >= LOCK_AFTER_MS) {
          setLocked(true);
        }
      }
    });

    return () => subscription.remove();
  }, [user]);

  // Auto-trigger biometric prompt when locked
  useEffect(() => {
    if (locked && !checking) {
      authenticate();
    }
  }, [locked]); // eslint-disable-line react-hooks/exhaustive-deps

  if (locked) {
    return (
      <View style={lockStyles.container}>
        <Text style={lockStyles.logo}>zai</Text>
        <Text style={lockStyles.subtitle}>EXPERIENCE CLUB</Text>
        <View style={lockStyles.body}>
          {checking ? (
            <Text style={lockStyles.status}>Verifying identity…</Text>
          ) : (
            <>
              <Text style={lockStyles.status}>App locked</Text>
              <Text
                style={lockStyles.retry}
                onPress={authenticate}
              >
                Tap to unlock
              </Text>
            </>
          )}
        </View>
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <BiometricGate>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0a0a0a' } }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="(tabs)" />
          </Stack>
        </BiometricGate>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const lockStyles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: DARK_THEME.background,
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  logo: { fontSize: 48, fontWeight: '200', color: DARK_THEME.text, letterSpacing: 8 },
  subtitle: { fontSize: 10, letterSpacing: 6, color: DARK_THEME.textSecondary, marginTop: 4 },
  body: { marginTop: 48, alignItems: 'center' },
  status: { fontSize: 16, color: DARK_THEME.textSecondary, marginBottom: 16 },
  retry: { fontSize: 15, color: DARK_THEME.primary, fontWeight: '600', padding: 12 },
});
