import { ReactNode } from 'react';
import { ImageBackground, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const HERO = require('../assets/hero-bg.jpg');

// 'hero' keeps the photo visible for landing/login/home.
// 'content' darkens harder so dense screens (lists, tables) stay readable.
const HERO_GRADIENT = ['rgba(10,10,10,0.55)', 'rgba(10,10,10,0.22)', 'rgba(10,10,10,0.92)'] as const;
const CONTENT_GRADIENT = ['rgba(10,10,10,0.84)', 'rgba(10,10,10,0.9)', 'rgba(10,10,10,0.97)'] as const;
const STOPS = [0, 0.4, 1] as const;

type Props = {
  children: ReactNode;
  variant?: 'hero' | 'content';
  style?: StyleProp<ViewStyle>;
};

export default function ScreenBackground({ children, variant = 'hero', style }: Props) {
  return (
    <ImageBackground source={HERO} resizeMode="cover" style={[styles.bg, style]}>
      <LinearGradient
        colors={variant === 'content' ? CONTENT_GRADIENT : HERO_GRADIENT}
        locations={STOPS}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#0a0a0a' },
});