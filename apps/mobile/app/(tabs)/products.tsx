import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, Pressable,
  ActivityIndicator, Alert, Modal, TextInput, TouchableOpacity,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '@/context/AuthContext';
import { apiService } from '@/services/api';
import { DARK_THEME } from '@/theme/colors';
import type { Product } from '@zai/shared';

interface ClaimableRwa {
  rwaId: string;
  name: string;
  image: string;
}

const DISMISSED_KEY = 'zai_dismissed_claims';

export default function ProductsScreen() {
  const { user } = useAuth();
  const userIdRef = useRef(user?.id);
  userIdRef.current = user?.id;

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingClaims, setPendingClaims] = useState<any[]>([]);

  // Dismissed claims — stored in ref, never triggers re-renders
  const dismissedRef = useRef<Set<string>>(new Set());
  const dismissedLoaded = useRef(false);

  // Claim modal states
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimableRwas, setClaimableRwas] = useState<ClaimableRwa[]>([]);
  const [claimableLoading, setClaimableLoading] = useState(false);
  const [selectedProductName, setSelectedProductName] = useState('');
  const [customProductName, setCustomProductName] = useState('');
  const [isCustomProduct, setIsCustomProduct] = useState(false);
  const [claimSubmitting, setClaimSubmitting] = useState(false);

  // Load dismissed IDs once (no state update unless needed)
  useEffect(() => {
    SecureStore.getItemAsync(DISMISSED_KEY).then((stored) => {
      if (stored) {
        dismissedRef.current = new Set<string>(JSON.parse(stored));
      }
      dismissedLoaded.current = true;
    }).catch(() => {
      dismissedLoaded.current = true;
    });
  }, []);

  // Stable fetch function — no state dependencies, uses ref for userId
  const fetchProducts = useCallback(async (background = false) => {
    const uid = userIdRef.current;
    if (!uid) return;
    try {
      if (!background) setIsLoading(true);
      const res = await apiService.get(`/products/user/${uid}`);
      if (res.data?.success) {
        setProducts(res.data.data || []);
        const ecCard = res.data.experienceCard || null;
        await apiService.setExperienceCard(ecCard);
      }
    } catch (err: any) {
      if (!background) console.error('Products fetch error:', err.message);
    } finally {
      if (!background) setIsLoading(false);
    }
  }, []); // stable — never recreated

  const filterDismissed = useCallback((claims: any[]) => {
    return claims.filter(
      (c: any) => !(
        (c.status === 'validated' || c.status === 'rejected') &&
        dismissedRef.current.has(c.id)
      )
    );
  }, []);

  const fetchClaims = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid) return;
    try {
      const res = await apiService.get('/products/claim-requests?mine=true');
      if (res.data?.success) {
        const raw = res.data.data || [];
        const filtered = filterDismissed(raw);

        // Only update state if the data actually changed
        setPendingClaims((prev) => {
          const prevIds = prev.map((c: any) => `${c.id}-${c.status}`).join(',');
          const nextIds = filtered.map((c: any) => `${c.id}-${c.status}`).join(',');
          if (prevIds === nextIds) return prev; // no change → no re-render
          return filtered;
        });

        // Auto-refresh products if there's a newly validated claim
        const hasValidated = filtered.some((c: any) => c.status === 'validated');
        if (hasValidated) fetchProducts(true);
      }
    } catch {}
  }, [fetchProducts, filterDismissed]);

  // Initial load — runs once
  useEffect(() => {
    if (!user?.id) return;
    fetchProducts();
    fetchClaims();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll claims every 15s — stable interval, no dependency churn
  useEffect(() => {
    const id = setInterval(fetchClaims, 15000);
    return () => clearInterval(id);
  }, [fetchClaims]);

  const dismissClaim = (claimId: string) => {
    dismissedRef.current.add(claimId);
    SecureStore.setItemAsync(DISMISSED_KEY, JSON.stringify([...dismissedRef.current])).catch(() => {});
    setPendingClaims((prev) => prev.filter((c: any) => c.id !== claimId));
  };

  // ── Claim flow ──
  const fetchClaimableProducts = async () => {
    setClaimableLoading(true);
    try {
      const res = await apiService.get('/products/claimable');
      const payload = res.data as any;
      if (payload?.success) setClaimableRwas(payload.data || []);
    } catch {} finally {
      setClaimableLoading(false);
    }
  };

  const openClaimFlow = () => {
    setShowClaimModal(true);
    setSelectedProductName('');
    setCustomProductName('');
    setIsCustomProduct(false);
    setClaimSubmitting(false);
    fetchClaimableProducts();
  };

  const handleContinueToPhoto = async () => {
    const productName = isCustomProduct ? customProductName.trim() : selectedProductName;

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

    setClaimSubmitting(true);
    try {
      await submitClaim(base64Image, productName);
    } finally {
      setClaimSubmitting(false);
      setShowClaimModal(false);
    }
  };

  const submitClaim = async (proofImage: string, productName: string) => {
    try {
      const res = await apiService.post('/products/claim-request', { proofImage, productName });
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

  // ── Render ──

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
        <Pressable style={styles.claimBtn} onPress={openClaimFlow}>
          <Text style={styles.claimBtnText}>+ CLAIM</Text>
        </Pressable>
      </View>

      {/* Pending claims */}
      {pendingClaims.filter((c: any) => c.status === 'pending' || c.status === 'minting').map((c: any) => (
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
      {pendingClaims.filter((c: any) => c.status === 'validated').map((c: any) => (
        <View key={c.id} style={[styles.pendingBanner, { backgroundColor: 'rgba(76,175,125,0.1)', borderColor: 'rgba(76,175,125,0.25)' }]}>
          <Text style={styles.pendingIcon}>✅</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.pendingTitle, { color: DARK_THEME.success }]}>Product added!</Text>
            <Text style={styles.pendingDesc}>{c.productName || 'Product'}</Text>
          </View>
          <TouchableOpacity onPress={() => dismissClaim(c.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={{ color: DARK_THEME.textSecondary, fontSize: 18, fontWeight: '300' }}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}

      {/* Rejected notifications */}
      {pendingClaims.filter((c: any) => c.status === 'rejected').map((c: any) => (
        <View key={c.id} style={[styles.pendingBanner, { backgroundColor: 'rgba(122,34,46,0.1)', borderColor: 'rgba(122,34,46,0.25)' }]}>
          <Text style={styles.pendingIcon}>❌</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.pendingTitle, { color: DARK_THEME.primary }]}>Claim rejected</Text>
            <Text style={styles.pendingDesc}>{c.productName || 'Product'}</Text>
          </View>
          <TouchableOpacity onPress={() => dismissClaim(c.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={{ color: DARK_THEME.textSecondary, fontSize: 18, fontWeight: '300' }}>✕</Text>
          </TouchableOpacity>
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
            {products.filter((p: any) => p.insurance?.active).length}
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
          {products.map((product: any) => (
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

      {/* ══════ CLAIM PRODUCT MODAL ══════ */}
      {showClaimModal && (
        <Modal transparent visible animationType="fade" onRequestClose={() => setShowClaimModal(false)}>
          <Pressable style={styles.claimOverlay} onPress={() => setShowClaimModal(false)}>
            <View style={styles.claimCard} onStartShouldSetResponder={() => true}>
              <Text style={styles.claimModalTitle}>Claim a Product</Text>
              <Text style={styles.claimModalSubtitle}>
                Select your product, then take a photo of your proof of purchase.
              </Text>

              <Text style={styles.claimLabel}>PRODUCT NAME</Text>

              {claimableLoading ? (
                <ActivityIndicator color={DARK_THEME.primary} style={{ marginVertical: 16 }} />
              ) : claimableRwas.length > 0 ? (
                <View>
                  <ScrollView style={styles.claimProductList} nestedScrollEnabled>
                    {claimableRwas.map((rwa: ClaimableRwa) => (
                      <TouchableOpacity
                        key={rwa.rwaId}
                        style={[
                          styles.claimProductItem,
                          selectedProductName === rwa.name && !isCustomProduct && styles.claimProductItemSelected,
                        ]}
                        onPress={() => { setSelectedProductName(rwa.name); setIsCustomProduct(false); }}
                      >
                        <View style={styles.claimProductRadio}>
                          {selectedProductName === rwa.name && !isCustomProduct && (
                            <View style={styles.claimProductRadioDot} />
                          )}
                        </View>
                        <Text style={styles.claimProductItemText}>{rwa.name}</Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      style={[styles.claimProductItem, isCustomProduct && styles.claimProductItemSelected]}
                      onPress={() => { setIsCustomProduct(true); setSelectedProductName(''); }}
                    >
                      <View style={styles.claimProductRadio}>
                        {isCustomProduct && <View style={styles.claimProductRadioDot} />}
                      </View>
                      <Text style={styles.claimProductItemText}>Other (not listed)</Text>
                    </TouchableOpacity>
                  </ScrollView>
                  {isCustomProduct && (
                    <TextInput
                      style={styles.claimCustomInput}
                      placeholder="Enter product name…"
                      placeholderTextColor={DARK_THEME.textSecondary}
                      value={customProductName}
                      onChangeText={setCustomProductName}
                      autoFocus
                    />
                  )}
                </View>
              ) : (
                <TextInput
                  style={styles.claimCustomInput}
                  placeholder="e.g. ZAI Zermatt GT"
                  placeholderTextColor={DARK_THEME.textSecondary}
                  value={customProductName}
                  onChangeText={(t: string) => { setCustomProductName(t); setIsCustomProduct(true); }}
                />
              )}

              <View style={styles.claimModalActions}>
                <TouchableOpacity style={styles.claimCancelBtn} onPress={() => setShowClaimModal(false)}>
                  <Text style={styles.claimCancelText}>CANCEL</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.claimSubmitBtn, (!selectedProductName && !customProductName.trim()) && { opacity: 0.5 }]}
                  disabled={(!selectedProductName && !customProductName.trim()) || claimSubmitting}
                  onPress={handleContinueToPhoto}
                >
                  {claimSubmitting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.claimSubmitText}>TAKE PHOTO</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </Pressable>
        </Modal>
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
  statsRow: { flexDirection: 'row', borderWidth: 1, borderColor: DARK_THEME.border, borderRadius: 8, marginBottom: 24 },
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
  claimOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  claimCard: { backgroundColor: DARK_THEME.surface, borderRadius: 16, padding: 24, width: '100%', maxWidth: 360, borderWidth: 1, borderColor: DARK_THEME.border },
  claimModalTitle: { fontSize: 18, fontWeight: '600', color: DARK_THEME.text, marginBottom: 4 },
  claimModalSubtitle: { fontSize: 13, color: DARK_THEME.textSecondary, marginBottom: 20, lineHeight: 18 },
  claimLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: DARK_THEME.textSecondary, marginBottom: 8 },
  claimProductList: { maxHeight: 220, borderRadius: 8, borderWidth: 1, borderColor: DARK_THEME.border, backgroundColor: DARK_THEME.background },
  claimProductItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: DARK_THEME.border },
  claimProductItemSelected: { backgroundColor: 'rgba(122, 34, 46, 0.15)' },
  claimProductRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: DARK_THEME.textSecondary, justifyContent: 'center', alignItems: 'center' },
  claimProductRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: DARK_THEME.primary },
  claimProductItemText: { fontSize: 14, color: DARK_THEME.text, flex: 1 },
  claimCustomInput: { backgroundColor: DARK_THEME.background, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: DARK_THEME.text, borderWidth: 1, borderColor: DARK_THEME.border, marginTop: 10 },
  claimModalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  claimCancelBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: DARK_THEME.border },
  claimCancelText: { fontSize: 11, fontWeight: '700', letterSpacing: 2, color: DARK_THEME.textSecondary },
  claimSubmitBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 8, backgroundColor: DARK_THEME.primary },
  claimSubmitText: { fontSize: 11, fontWeight: '700', letterSpacing: 2, color: '#fff' },
});
