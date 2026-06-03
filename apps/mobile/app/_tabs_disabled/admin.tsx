import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, Pressable,
  ActivityIndicator, Alert,
} from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { apiService } from '@/services/api';
import { DARK_THEME } from '@/theme/colors';
import type { ClaimRequest } from '@zai/shared';

export default function AdminScreen() {
  const { isAdmin } = useAuth();
  const [claims, setClaims] = useState<ClaimRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('pending');

  const fetchClaims = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = filter ? `?status=${filter}` : '';
      const res = await apiService.get(`/products/claim-requests${params}`);
      if (res.data?.success) {
        setClaims(res.data.data || []);
      }
    } catch (err: any) {
      console.error('Claims fetch error:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchClaims(); }, [fetchClaims]);

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

      {/* Filter tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {['pending', 'validated', 'rejected', 'all'].map(f => (
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
        claims.map(claim => (
          <Pressable
            key={claim.id}
            style={styles.claimCard}
            onPress={() => {
              // TODO: open detail modal
              Alert.alert(claim.userName, `Status: ${claim.status}\nProduct: ${claim.productName || '—'}`);
            }}
          >
            <Image
              source={{ uri: `/api/products/claim-proof/${claim.id}` }}
              style={styles.claimThumb}
              defaultSource={require('@/assets/placeholder.png')}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.claimName}>{claim.userName}</Text>
              {claim.productName ? (
                <Text style={styles.claimProduct}>{claim.productName}</Text>
              ) : null}
              <Text style={styles.claimDate}>
                {new Date(claim.createdAt).toLocaleDateString()}
              </Text>
            </View>
            <View style={[styles.statusBadge, {
              backgroundColor: claim.status === 'pending' ? '#fef9e7'
                : claim.status === 'validated' ? '#e8f5e9' : '#fce8e6',
            }]}>
              <Text style={[styles.statusText, {
                color: claim.status === 'pending' ? '#b8860b'
                  : claim.status === 'validated' ? '#2e7d32' : '#c62828',
              }]}>
                {claim.status.toUpperCase()}
              </Text>
            </View>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK_THEME.background },
  content: { padding: 20, paddingTop: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: DARK_THEME.background },
  sectionLabel: { fontSize: 11, letterSpacing: 4, color: DARK_THEME.primary, fontWeight: '500', marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '300', color: DARK_THEME.text, marginBottom: 16 },
  filterRow: { flexDirection: 'row', marginBottom: 20 },
  filterTab: {
    paddingVertical: 8, paddingHorizontal: 16, borderRadius: 4, marginRight: 8,
    borderWidth: 1, borderColor: DARK_THEME.border,
  },
  filterTabActive: { backgroundColor: DARK_THEME.text, borderColor: DARK_THEME.text },
  filterText: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: DARK_THEME.textSecondary },
  filterTextActive: { color: DARK_THEME.background },
  empty: { color: DARK_THEME.textSecondary, textAlign: 'center', marginTop: 48, fontSize: 14 },
  claimCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    backgroundColor: DARK_THEME.surface, borderRadius: 10,
    borderWidth: 1, borderColor: DARK_THEME.border, marginBottom: 10,
  },
  claimThumb: { width: 56, height: 56, borderRadius: 6, backgroundColor: '#1a1a1a' },
  claimName: { fontSize: 14, fontWeight: '600', color: DARK_THEME.text },
  claimProduct: { fontSize: 11, color: DARK_THEME.textSecondary, marginTop: 2 },
  claimDate: { fontSize: 11, color: DARK_THEME.textSecondary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  statusText: { fontSize: 8, fontWeight: '800', letterSpacing: 1 },
});
