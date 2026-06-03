import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Redirect, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { apiService } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import ScreenBackground from '@/components/ScreenBackground';
import { DARK_THEME } from '@/theme/colors';

const COMPANY_ID =
  (Constants.expoConfig?.extra?.companyId as string) || 'p7IH5cVirHbWy1a0hPxeKro5j9bRSJtt';
const WALLETTWO_BASE =
  (Constants.expoConfig?.extra?.wallettwoUrl as string) ||
  'https://wallet.wallettwo.com/auth/login';

// Forward WalletTwo's postMessage payload out to React Native. The page is
// built to post to its parent frame; inside a WebView that resolves to the
// page's own window, so a plain message listener catches it.
const INJECTED = `
(function () {
  function forward(e) {
    try {
      var d = e.data;
      if (!d) return;
      if (typeof d === 'string') {
        window.ReactNativeWebView.postMessage(d);
        return;
      }
      if (d.type === 'wallet_session' || d.token || d.code) {
        window.ReactNativeWebView.postMessage(JSON.stringify(d));
      }
    } catch (err) {}
  }
  window.addEventListener('message', forward);
  document.addEventListener('message', forward);
})();
true;
`;

export default function Login() {
  const { user, login } = useAuth();
  const router = useRouter();
  const [showWebView, setShowWebView] = useState(false);
  const [exchanging, setExchanging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    if (showWebView) handledRef.current = false;
  }, [showWebView]);

  // Already authenticated → leave the login screen.
  if (user) return <Redirect href="/home" />;

  const authUrl = `${WALLETTWO_BASE}?action=session&iframe=true&companyId=${COMPANY_ID}&_t=${Date.now()}`;

  const handleMessage = async (raw: string) => {
    if (handledRef.current) return;

    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }

    const token = data.token || data.code;
    const walletUser = data.user;
    const wallet = data.wallet || data.address;
    if (!token || !wallet) return;

    handledRef.current = true;
    setShowWebView(false);
    setExchanging(true);
    setError(null);

    try {
      const res = await apiService.post('/auth/login', {
        token,
        userId: walletUser || wallet,
        wallet,
      });
      if (!res.data?.success || !res.data?.jwtToken) {
        throw new Error(res.data?.error || 'Login exchange failed');
      }
      await login(res.data.jwtToken, res.data.user);
      router.replace('/home');
    } catch (err: any) {
      console.error('Login exchange failed:', err);
      setError('Login failed. Please try again.');
      handledRef.current = false;
    } finally {
      setExchanging(false);
    }
  };

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.container}>
      <View style={styles.brand}>
        <Text style={styles.logo}>zai</Text>
        <Text style={styles.subtitle}>EXPERIENCE CLUB</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.welcome}>Welcome</Text>
        <Text style={styles.desc}>
          Connect your wallet to access your collection, events, and the community.
        </Text>

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity
          style={styles.button}
          activeOpacity={0.85}
          disabled={exchanging}
          onPress={() => {
            setError(null);
            setShowWebView(true);
          }}
        >
          {exchanging ? (
            <ActivityIndicator color={DARK_THEME.text} />
          ) : (
            <Text style={styles.buttonText}>Connect Wallet</Text>
          )}
        </TouchableOpacity>
      </View>

      <Modal visible={showWebView} animationType="slide" onRequestClose={() => setShowWebView(false)}>
        <SafeAreaView style={styles.webContainer}>
          <View style={styles.webHeader}>
            <Text style={styles.webTitle}>Connect Wallet</Text>
            <TouchableOpacity onPress={() => setShowWebView(false)} hitSlop={12}>
              <Text style={styles.webClose}>Close</Text>
            </TouchableOpacity>
          </View>
          <WebView
            source={{ uri: authUrl }}
            injectedJavaScript={INJECTED}
            injectedJavaScriptBeforeContentLoaded={INJECTED}
            onMessage={(e) => handleMessage(e.nativeEvent.data)}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.webLoading}>
                <ActivityIndicator color={DARK_THEME.primary} size="large" />
              </View>
            )}
            style={{ flex: 1, backgroundColor: DARK_THEME.background }}
          />
        </SafeAreaView>
      </Modal>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent', justifyContent: 'space-between' },
  brand: { alignItems: 'center', marginTop: 80 },
  logo: { fontSize: 48, fontWeight: '200', color: DARK_THEME.text, letterSpacing: 8 },
  subtitle: { fontSize: 10, letterSpacing: 6, color: DARK_THEME.textSecondary, marginTop: 4 },
  body: { padding: 32, paddingBottom: 80 },
  welcome: { fontSize: 26, fontWeight: '300', color: DARK_THEME.text, marginBottom: 12 },
  desc: { fontSize: 14, color: DARK_THEME.textSecondary, lineHeight: 21, marginBottom: 32 },
  error: { color: '#e07a7a', fontSize: 13, marginBottom: 16 },
  button: {
    backgroundColor: DARK_THEME.primary,
    borderRadius: 10,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: DARK_THEME.text, fontSize: 15, fontWeight: '600', letterSpacing: 0.5 },
  webContainer: { flex: 1, backgroundColor: DARK_THEME.background },
  webHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: DARK_THEME.border,
  },
  webTitle: { color: DARK_THEME.text, fontSize: 16, fontWeight: '600' },
  webClose: { color: DARK_THEME.primary, fontSize: 15 },
  webLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DARK_THEME.background,
  },
});