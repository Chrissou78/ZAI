import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, Pressable,
  ActivityIndicator, Alert, Modal, TextInput, TouchableOpacity,
} from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { apiService } from '@/services/api';
import { DARK_THEME } from '@/theme/colors';

interface ClaimRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  rwaId: string | null;
  productName: string;
  proofImageUrl: string;
  status: string;
  adminNote: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  nftId: string | null;
  mintTx: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ClaimableProduct {
  rwaId: string;
  name: string;
  image: string;
  price: string;
  currency: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending:   { bg: 'rgba(255,180,0,0.15)',  text: '#b8860b' },
  minting:   { bg: 'rgba(37,99,235,0.15)',  text: '#2563eb' },
  validated: { bg: 'rgba(76,175,125,0.15)', text: '#2e7d32' },
  rejected:  { bg: 'rgba(198,40,40,0.15)',  text: '#c62828' },
  error:     { bg: 'rgba(198,40,40,0.15)',  text: '#c62828' },
};

function formatDate(d: string): string {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AdminScreen() {
  const { isAdmin } = useAuth();
  const [claims, setClaims] = useState<ClaimRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('pending');

  // Review modal
  const [selectedClaim, setSelectedClaim] = useState<ClaimRequest | null>(null);
  const [claimableProducts, setClaimableProducts] = useState<ClaimableProduct[]>([]);
  const [claimableLoading, setClaimableLoading] = useState(false);
  const [selectedRwaId, setSelectedRwaId] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Image zoom
  const [zoomUri, setZoomUri] = useState<string | null>(null);

  const filterRef = useRef(filter);
  filterRef.current = filter;

  const fetchClaims = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = filterRef.current ? `?status=${filterRef.current}` : '';
      const res = await apiService.get(`/products/claim-requests${params}`);
      if (res.data?.success) {
        setClaims(res.data.data || []);
      }
    } catch (err: any) {
      console.error('Claims fetch error:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClaims();
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchClaimableProducts = async () => {
    setClaimableLoading(true);
    try {
      const res = await apiService.get('/products/claimable');
      if (res.data?.success) {
        setClaimableProducts((res.data as any).data || []);
      }
    } catch {} finally {
      setClaimableLoading(false);
    }
  };

  const openReview = (claim: ClaimRequest) => {
    setSelectedClaim(claim);
    setSelectedRwaId(claim.rwaId || '');
    setAdminNote(claim.adminNote || '');
    setActionError(null);
    fetchClaimableProducts();
  };

  const handleValidate = async () => {
    if (!selectedClaim || !selectedRwaId) {
      setActionError('Please select a product to mint.');
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await apiService.post(`/products/claim-requests/${selectedClaim.id}/validate`, {
        rwaId: selectedRwaId,
        note: adminNote,
      });
      if (res.data?.success) {
        Alert.alert('Success', 'Claim validated and minting started.');
        setSelectedClaim(null);
        fetchClaims();
      } else {
        setActionError(res.data?.error || 'Validation failed');
      }
    } catch (err: any) {
      setActionError(err?.response?.data?.error || err?.message || 'Validation failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedClaim) return;
    Alert.alert('Reject Claim', 'Are you sure you want to reject this claim?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          setActionError(null);
          try {
            const res = await apiService.post(`/products/claim-requests/${selectedClaim.id}/reject`, {
              note: adminNote,
            });
            if (res.data?.success) {
              Alert.alert('Done', 'Claim rejected.');
              setSelectedClaim(null);
              fetchClaims();
            } else {
              setActionError(res.data?.error || 'Rejection failed');
            }
          } catch (err: any) {
            setActionError(err?.response?.data?.error || err?.message || 'Rejection failed');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  // Build proof image URI with auth
  const getProofUri = (claimId: string): string => {
    // The API serves /api/products/claim-proof/:id with Bearer auth
    // For Image component we need a direct URL — use the stored proofImageUrl if available
    return `/api/products/claim-proof/${claimId}`;
  };

  if (!isAdmin) {
    return (
      <View style={styles.center}>
        <Text style={{ color: DARK_THEME.textSecondary }}>Admin access required.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionLabel}>ADMIN</Text>
      <Text style={styles.title}>Claim Requests</Text>
      <Text style={styles.subtitle}>Review proof-of-purchase submissions and validate claims.</Text>

      {/* Filter tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {['pending', 'validated', 'rejected', 'all'].map((f: string) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f === 'all' ? '' : f)}
            style={[styles.filterTab, (filter === f || (f === 'all' && !filter)) && styles.filterTabActive]}
          >
            <Text style={[styles.filterText, (filter === f || (f === 'all' && !filter)) && styles.filterTextActive]}>
              {f.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {isLoading ? (
        <ActivityIndicator size="large" color={DARK_THEME.primary} style={{ marginTop: 48 }} />
      ) : claims.length === 0 ? (
        <Text style={styles.empty}>No {filter || ''} claims.</Text>
      ) : (
        claims.map((claim: ClaimRequest) => {
          const sc = STATUS_COLORS[claim.status] || STATUS_COLORS.pending;
          return (
            <Pressable key={claim.id} style={styles.claimCard} onPress={() => openReview(claim)}>
              <View style={styles.claimThumbWrap}>
                {claim.proofImageUrl ? (
                  <Image source={{ uri: claim.proofImageUrl }} style={styles.claimThumb} />
                ) : (
                  <View style={[styles.claimThumb, { justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={{ fontSize: 20, color: DARK_THEME.border }}>📷</Text>
                  </View>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.claimName}>{claim.userName}</Text>
                {claim.productName ? (
                  <Text style={styles.claimProduct}>{claim.productName}</Text>
                ) : null}
                <Text style={styles.claimDate}>{formatDate(claim.createdAt)}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                <Text style={[styles.statusText, { color: sc.text }]}>
                  {claim.status.toUpperCase()}
                </Text>
              </View>
              <Text style={{ color: DARK_THEME.textSecondary, fontSize: 18 }}>→</Text>
            </Pressable>
          );
        })
      )}

      {/* ══════ REVIEW MODAL ══════ */}
      {selectedClaim && (
        <Modal transparent visible animationType="fade" onRequestClose={() => setSelectedClaim(null)}>
          <Pressable style={styles.overlay} onPress={() => setSelectedClaim(null)}>
            <ScrollView
              style={styles.reviewScroll}
              contentContainerStyle={styles.reviewScrollContent}
              onStartShouldSetResponder={() => true}
            >
              <View style={styles.reviewCard}>
                {/* Header */}
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewTitle}>Review Claim</Text>
                  <TouchableOpacity onPress={() => setSelectedClaim(null)}>
                    <Text style={{ color: DARK_THEME.textSecondary, fontSize: 22 }}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* User info */}
                <View style={styles.reviewSection}>
                  <Text style={styles.reviewLabel}>USER</Text>
                  <Text style={styles.reviewValue}>{selectedClaim.userName}</Text>
                  {selectedClaim.userEmail ? (
                    <Text style={styles.reviewSubvalue}>{selectedClaim.userEmail}</Text>
                  ) : null}
                  <Text style={styles.reviewSubvalue}>ID: {selectedClaim.userId}</Text>
                </View>

                {/* Product name from user */}
                {selectedClaim.productName ? (
                  <View style={styles.reviewSection}>
                    <Text style={styles.reviewLabel}>PRODUCT NAME (FROM USER)</Text>
                    <Text style={styles.reviewValue}>{selectedClaim.productName}</Text>
                  </View>
                ) : null}

                {/* Proof image */}
                <View style={styles.reviewSection}>
                  <Text style={styles.reviewLabel}>PROOF OF PURCHASE</Text>
                  <TouchableOpacity onPress={() => {
                    if (selectedClaim.proofImageUrl) setZoomUri(selectedClaim.proofImageUrl);
                  }}>
                    {selectedClaim.proofImageUrl ? (
                      <Image
                        source={{ uri: selectedClaim.proofImageUrl }}
                        style={styles.proofImage}
                        resizeMode="contain"
                      />
                    ) : (
                      <View style={[styles.proofImage, { justifyContent: 'center', alignItems: 'center', backgroundColor: DARK_THEME.background }]}>
                        <Text style={{ color: DARK_THEME.textSecondary }}>No image available</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  <Text style={{ fontSize: 10, color: DARK_THEME.textSecondary, marginTop: 4 }}>Tap to zoom</Text>
                </View>

                {/* Existing status for non-pending */}
                {selectedClaim.status !== 'pending' && (
                  <View style={[styles.reviewSection, {
                    backgroundColor: (STATUS_COLORS[selectedClaim.status] || STATUS_COLORS.pending).bg,
                    borderRadius: 8, padding: 14,
                  }]}>
                    <Text style={{
                      fontSize: 14, fontWeight: '700',
                      color: (STATUS_COLORS[selectedClaim.status] || STATUS_COLORS.pending).text,
                    }}>
                      Status: {selectedClaim.status.toUpperCase()}
                    </Text>
                    {selectedClaim.adminNote ? (
                      <Text style={{ fontSize: 12, color: DARK_THEME.textSecondary, marginTop: 4 }}>
                        Note: {selectedClaim.adminNote}
                      </Text>
                    ) : null}
                    {selectedClaim.reviewedAt ? (
                      <Text style={{ fontSize: 11, color: DARK_THEME.textSecondary, marginTop: 2 }}>
                        Reviewed: {formatDate(selectedClaim.reviewedAt)}
                      </Text>
                    ) : null}
                  </View>
                )}

                {/* Admin actions — only for pending claims */}
                {selectedClaim.status === 'pending' && (
                  <>
                    {/* Product selection */}
                    <View style={styles.reviewSection}>
                      <Text style={styles.reviewLabel}>SELECT PRODUCT TO MINT</Text>
                      {claimableLoading ? (
                        <ActivityIndicator color={DARK_THEME.primary} style={{ marginVertical: 12 }} />
                      ) : claimableProducts.length > 0 ? (
                        <ScrollView style={styles.productPickerList} nestedScrollEnabled>
                          {claimableProducts.map((p: ClaimableProduct) => (
                            <TouchableOpacity
                              key={p.rwaId}
                              style={[
                                styles.productPickerItem,
                                selectedRwaId === p.rwaId && styles.productPickerItemSelected,
                              ]}
                              onPress={() => setSelectedRwaId(p.rwaId)}
                            >
                              <View style={styles.productPickerRadio}>
                                {selectedRwaId === p.rwaId && <View style={styles.productPickerRadioDot} />}
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.productPickerName}>{p.name}</Text>
                                {p.price ? (
                                  <Text style={styles.productPickerPrice}>{p.currency || 'CHF'} {p.price}</Text>
                                ) : null}
                              </View>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      ) : (
                        <Text style={{ color: DARK_THEME.textSecondary, fontSize: 13, marginTop: 8 }}>
                          No claimable products available.
                        </Text>
                      )}
                    </View>

                    {/* Admin note */}
                    <View style={styles.reviewSection}>
                      <Text style={styles.reviewLabel}>ADMIN NOTE (OPTIONAL)</Text>
                      <TextInput
                        style={styles.noteInput}
                        placeholder="Add a note…"
                        placeholderTextColor={DARK_THEME.textSecondary}
                        value={adminNote}
                        onChangeText={setAdminNote}
                        multiline
                      />
                    </View>

                    {actionError ? (
                      <Text style={{ color: DARK_THEME.primary, fontSize: 13, marginBottom: 8 }}>{actionError}</Text>
                    ) : null}

                    {/* Action buttons */}
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={styles.rejectBtn}
                        onPress={handleReject}
                        disabled={actionLoading}
                      >
                        <Text style={styles.rejectBtnText}>
                          {actionLoading ? '...' : 'REJECT'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.validateBtn, !selectedRwaId && { opacity: 0.5 }]}
                        onPress={handleValidate}
                        disabled={actionLoading || !selectedRwaId}
                      >
                        {actionLoading ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Text style={styles.validateBtnText}>VALIDATE & MINT</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </ScrollView>
          </Pressable>
        </Modal>
      )}

      {/* ══════ ZOOM IMAGE ══════ */}
      {zoomUri && (
        <Modal transparent visible animationType="fade" onRequestClose={() => setZoomUri(null)}>
          <Pressable style={styles.zoomOverlay} onPress={() => setZoomUri(null)}>
            <Image source={{ uri: zoomUri }} style={styles.zoomImage} resizeMode="contain" />
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
  sectionLabel: { fontSize: 11, letterSpacing: 4, color: DARK_THEME.primary, fontWeight: '500', marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '300', color: DARK_THEME.text, marginBottom: 4 },
  subtitle: { fontSize: 13, color: DARK_THEME.textSecondary, marginBottom: 16, lineHeight: 18 },
  filterRow: { flexDirection: 'row', marginBottom: 20 },
  filterTab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 4, marginRight: 8, borderWidth: 1, borderColor: DARK_THEME.border },
  filterTabActive: { backgroundColor: DARK_THEME.text, borderColor: DARK_THEME.text },
  filterText: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: DARK_THEME.textSecondary },
  filterTextActive: { color: DARK_THEME.background },
  empty: { color: DARK_THEME.textSecondary, textAlign: 'center', marginTop: 48, fontSize: 14 },

  claimCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    backgroundColor: DARK_THEME.surface, borderRadius: 10,
    borderWidth: 1, borderColor: DARK_THEME.border, marginBottom: 10,
  },
  claimThumbWrap: { width: 56, height: 56, borderRadius: 6, overflow: 'hidden' },
  claimThumb: { width: 56, height: 56, backgroundColor: '#1a1a1a' },
  claimName: { fontSize: 14, fontWeight: '600', color: DARK_THEME.text },
  claimProduct: { fontSize: 11, color: DARK_THEME.textSecondary, marginTop: 2 },
  claimDate: { fontSize: 11, color: DARK_THEME.textSecondary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  statusText: { fontSize: 8, fontWeight: '800', letterSpacing: 1 },

  // Review modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  reviewScroll: { width: '100%', maxHeight: '90%' },
  reviewScrollContent: { alignItems: 'center' },
  reviewCard: {
    backgroundColor: DARK_THEME.surface, borderRadius: 16, padding: 24,
    width: '100%', maxWidth: 400,
    borderWidth: 1, borderColor: DARK_THEME.border,
  },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  reviewTitle: { fontSize: 18, fontWeight: '600', color: DARK_THEME.text },
  reviewSection: { marginBottom: 18 },
  reviewLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: DARK_THEME.textSecondary, marginBottom: 6 },
  reviewValue: { fontSize: 15, fontWeight: '600', color: DARK_THEME.text },
  reviewSubvalue: { fontSize: 12, color: DARK_THEME.textSecondary, marginTop: 2 },

  proofImage: { width: '100%', height: 200, borderRadius: 8, backgroundColor: DARK_THEME.background },

  productPickerList: { maxHeight: 180, borderRadius: 8, borderWidth: 1, borderColor: DARK_THEME.border, backgroundColor: DARK_THEME.background },
  productPickerItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: DARK_THEME.border },
  productPickerItemSelected: { backgroundColor: 'rgba(76,175,125,0.12)' },
  productPickerRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: DARK_THEME.textSecondary, justifyContent: 'center', alignItems: 'center' },
  productPickerRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: DARK_THEME.success },
  productPickerName: { fontSize: 14, color: DARK_THEME.text },
  productPickerPrice: { fontSize: 11, color: DARK_THEME.textSecondary, marginTop: 2 },

  noteInput: {
    backgroundColor: DARK_THEME.background, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: DARK_THEME.text, minHeight: 60,
    textAlignVertical: 'top',
    borderWidth: 1, borderColor: DARK_THEME.border,
  },

  actionRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  rejectBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: DARK_THEME.primary },
  rejectBtnText: { fontSize: 11, fontWeight: '700', letterSpacing: 2, color: DARK_THEME.primary },
  validateBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 8, backgroundColor: DARK_THEME.success },
  validateBtnText: { fontSize: 11, fontWeight: '700', letterSpacing: 2, color: '#fff' },

  // Zoom
  zoomOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  zoomImage: { width: '90%', height: '80%' },
});
