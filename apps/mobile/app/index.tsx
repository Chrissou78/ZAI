import { View, Text, StyleSheet } from 'react-native';

export default function LoginScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>zai</Text>
      <Text style={styles.subtitle}>EXPERIENCE CLUB</Text>
      <Text style={styles.welcome}>Welcome!</Text>
      <Text style={styles.desc}>If you can read this, the app is working.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  logo: {
    fontSize: 48,
    fontWeight: '200',
    color: '#ffffff',
    letterSpacing: 8,
  },
  subtitle: {
    fontSize: 10,
    letterSpacing: 6,
    color: '#999999',
    marginTop: 4,
  },
  welcome: {
    fontSize: 26,
    fontWeight: '300',
    color: '#ffffff',
    marginTop: 40,
  },
  desc: {
    fontSize: 14,
    color: '#cccccc',
    marginTop: 16,
    textAlign: 'center',
  },
});
