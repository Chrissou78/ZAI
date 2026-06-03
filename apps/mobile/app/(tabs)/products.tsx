import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, Pressable,
  ActivityIndicator, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/context/AuthContext';
import { apiService } from '@/services/api';
import { DARK_THEME } from '@/theme/colors';
import type { Product } from '@zai/shared';

export default function ProductsScreen() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingClaims, setPendingClaims] = useState<any[]>([]);

  const fetchProducts = useCallback(async () => {
    if (!user?.id) return;
    try {
      setIsLoading(true);
      const res = await apiService.get(`/products/user/${user.id}`);
      if (res.data?.success) {
        setProducts(res.data.data || []);
        // Update experience card
        const ecCard = res.data.experienceCard || null;
        await apiService.setExperienceCard(ecCard);
      }
    } catch (err: any) {
      console.error('Products fetch error:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  const fetchClaims = useCallback(async () => {
    try {
      const res = await apiService.get('/products/claim-requests?mine=true');
      if (res.data?.success) {
        setPendingClaims(res.data.data || []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchClaims();
  }, [fetchProducts, fetchClaims]);

  // Poll claims every 15s
  useEffect(() => {
    const interval = setInterval(fetchClaims, 15000);
    return () => clearInterval(interval);
  }, [fetchClaims]);

  const handleClaimProduct = async () => {
    // Open camera or image picker
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required to photograph your receipt.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      base64: true,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const base64Image = `data:image/jpeg;base64,${asset.base64}`;

    // Ask for product name
    Alert.prompt(
      'Product Name',
      'Enter the product name (optional)',
      [
        { text: 'Skip', onPress: () => submitClaim(base64Image, '') },
        { text: 'Submit', onPress: (name) => submitClaim(base64Image, name || '') },
      ],
      'plain-text'
    );
  };

  const submitClaim = async (proofImage: string, productName: string) => {
    try {
      const res = await apiService.post('/products/claim-request', {
        proofImage,
        productName,
      });
      if (res.data?.success) {
        Alert.alert('Claim Submitted', 'Your proof of purchase is being reviewed.');
        fetchClaims();
      } else {
        Alert.alert('Error', res.data?.error || 'Submission failed');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Submission failed');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={DARK_THEME.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.sectionLabel}>ZAI EXCLUSIVE</Text>
          <Text style={styles.title}>My Collection</Text>
        </View>
        <Pressable style={styles.claimBtn} onPress={handleClaimProduct}>
          <Text style={styles.claimBtnText}>+ CLAIM</Text>
        </Pressable>
      </View>

      {/* Pending claims */}
      {pendingClaims.filter(c => c.status === 'pending' || c.status === 'minting').map(c => (
        <View key={c.id} style={styles.pendingBanner}>
          <Text style={styles.pendingIcon}>⏳</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.pendingTitle}>
              {c.status === 'minting' ? 'Minting...' : 'Pending review'}
            </Text>
            <Text style={styles.pendingDesc}>{c.productName || 'Product'}</Text>
          </View>
        </View>
      ))}

      {/* Validated notifications */}
      {pendingClaims.filter(c => c.status === 'validated').map(c => (
        <View key={c.id} style={[styles.pendingBanner, { backgroundColor: 'rgba(76,175,125,0.1)', borderColor: 'rgba(76,175,125,0.25)' }]}>
          <Text style={styles.pendingIcon}>✅</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.pendingTitle, { color: DARK_THEME.success }]}>Product added!</Text>
            <Text style={styles.pendingDesc}>{c.productName || 'Product'}</Text>
          </View>
        </View>
      ))}

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{products.length}</Text>
          <Text style={styles.statLabel}>PRODUCTS</Text>
        </View>
        <View style={[styles.statBox, { borderLeftWidth: 1, borderLeftColor: DARK_THEME.border }]}>
          <Text style={styles.statNumber}>
            {products.filter(p => p.insurance?.active).length}
          </Text>
          <Text style={styles.statLabel}>INSURED</Text>
        </View>
      </View>

      {/* Product grid */}
      {products.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>📦</Text>
          <Text style={styles.emptyTitle}>No products yet</Text>
          <Text style={styles.emptyDesc}>Claim your first product by taking a photo of your receipt.</Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {products.map(product => (
            <Pressable key={product.id} style={styles.productCard}>
              {product.image ? (
                <Image source={{ uri: product.image }} style={styles.productImage} />
              ) : (
                <View style={[styles.productImage, styles.productImagePlaceholder]}>
                  <Text style={{ fontSize: 32, color: DARK_THEME.border }}>⬡</Text>
                </View>
              )}
              <View style={styles.productInfo}>
                {product.collection && (
                  <Text style={styles.productCollection}>{product.collection}</Text>
                )}
                <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
                {product.price && (
                  <Text style={styles.productPrice}>{product.currency || 'CHF'} {product.price}</Text>
                )}
                <View style={styles.insuranceBadge}>
                  <View style={[styles.insuranceDot, {
                    backgroundColor: product.insurance?.active ? DARK_THEME.success : DARK_THEME.textSecondary,
                  }]} />
                  <Text style={[styles.insuranceText, {
                    color: product.insurance?.active ? DARK_THEME.success : DARK_THEME.textSecondary,
                  }]}>
                    {product.insurance?.active ? 'INSURED' : 'NOT INSURED'}
                  </Text>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK_THEME.background },
  content: { padding: 20, paddingTop: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: DARK_THEME.background },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  sectionLabel: { fontSize: 11, letterSpacing: 4, color: DARK_THEME.primary, fontWeight: '500', marginBottom: 4 },
  title: { fontSize: 28, fontWeight: '300', color: DARK_THEME.text },
  claimBtn: { backgroundColor: DARK_THEME.primary, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 4, marginTop: 4 },
  claimBtnText: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 2 },
  pendingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    backgroundColor: 'rgba(255,180,0,0.1)', borderWidth: 1,
    borderColor: 'rgba(255,180,0,0.25)', borderRadius: 10, marginBottom: 12,
  },
  pendingIcon: { fontSize: 18 },
  pendingTitle: { fontSize: 13, fontWeight: '600', color: DARK_THEME.text },
  pendingDesc: { fontSize: 11, color: DARK_THEME.textSecondary, marginTop: 2 },
  statsRow: {
    flexDirection: 'row', borderWidth: 1, borderColor: DARK_THEME.border,
    borderRadius: 8, marginBottom: 24,
  },
  statBox: { flex: 1, padding: 16, alignItems: 'center' },
  statNumber: { fontSize: 28, fontWeight: '300', color: DARK_THEME.text },
  statLabel: { fontSize: 9, letterSpacing: 2, color: DARK_THEME.textSecondary, fontWeight: '600', marginTop: 4 },
  grid: { gap: 16 },
  productCard: {
    backgroundColor: DARK_THEME.surface, borderRadius: 12,
    borderWidth: 1, borderColor: DARK_THEME.border, overflow: 'hidden',
  },
  productImage: { width: '100%', height: 180, backgroundColor: '#1a1a1a' },
  productImagePlaceholder: { justifyContent: 'center', alignItems: 'center' },
  productInfo: { padding: 14 },
  productCollection: { fontSize: 9, letterSpacing: 2, color: DARK_THEME.textSecondary, fontWeight: '500', marginBottom: 4 },
  productName: { fontSize: 15, fontWeight: '600', color: DARK_THEME.text, marginBottom: 4 },
  productPrice: { fontSize: 13, color: DARK_THEME.textSecondary, marginBottom: 8 },
  insuranceBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  insuranceDot: { width: 6, height: 6, borderRadius: 3 },
  insuranceText: { fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  emptyState: { alignItems: 'center', padding: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: DARK_THEME.text, marginBottom: 8 },
  emptyDesc: { fontSize: 13, color: DARK_THEME.textSecondary, textAlign: 'center', lineHeight: 20 },
});
