import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, ActivityIndicator, Alert, Switch,
} from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { apiService } from '@/services/api';
import { DARK_THEME } from '@/theme/colors';
import { useRouter } from 'expo-router';

/* ── Types ── */
interface FormData {
  givenName: string;
  familyName: string;
  email: string;
  phoneNumber: string;
  address: string;
  city: string;
  country: string;
  postalCode: string;
  birthdate: string;
  isPublic: boolean;
}

interface UserStats {
  productsClaimed: number;
  eventsAttended: number;
}

const toFormData = (src: any): FormData => ({
  givenName: src?.givenName || src?.firstName || '',
  familyName: src?.familyName || src?.lastName || '',
  email: src?.email || '',
  phoneNumber: src?.phoneNumber || '',
  address: src?.address || '',
  city: src?.city || '',
  country: src?.country || '',
  postalCode: src?.postalCode || '',
  birthdate: src?.birthdate || '',
  isPublic: src?.isPublic || false,
});

export default function ProfileScreen() {
  const { user, hasExperienceCard, isAdmin, logout } = useAuth();
  const router = useRouter();

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<FormData>(toFormData(user));
  const [stats, setStats] = useState<UserStats>({ productsClaimed: 0, eventsAttended: 0 });
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  /* ── Fetch fresh profile from API ── */
  useEffect(() => {
    let cancelled = false;
    if (user) setFormData(toFormData(user));

    const fetchProfile = async () => {
      try {
        const res = await apiService.get('/users/me');
        const d = (res.data as any)?.data;
        if (d && !cancelled) {
          setFormData((prev: FormData) => ({
            givenName: d.givenName || prev.givenName,
            familyName: d.familyName || prev.familyName,
            email: d.email || prev.email,
            phoneNumber: d.phoneNumber || prev.phoneNumber,
            address: d.address || prev.address,
            city: d.city || prev.city,
            country: d.country || prev.country,
            postalCode: d.postalCode || prev.postalCode,
            birthdate: d.birthdate || prev.birthdate,
            isPublic: d.isPublic ?? prev.isPublic,
          }));
        }
      } catch { /* fallback to context */ }
      if (!cancelled) setIsLoadingProfile(false);
    };
    fetchProfile();
    return () => { cancelled = true; };
  }, [user]);

  /* ── Fetch stats ── */
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const fetchStats = async () => {
      try {
        const [prodRes, evtRes] = await Promise.all([
          apiService.get(`/products/user/${user.id}`).catch(() => ({ data: { success: true, data: [] } })),
          apiService.get('/events').catch(() => ({ data: { success: true, data: [] } })),
        ]);
        if (cancelled) return;
        const prodData = prodRes.data as any;
        const products = prodData?.data || prodData?.products || [];
        const evtData = evtRes.data as any;
        const events = evtData?.data || evtData?.events || [];
        setStats({
          productsClaimed: Array.isArray(products) ? products.length : 0,
          eventsAttended: Array.isArray(events) ? events.filter((e: any) => e.status === 'upcoming').length : 0,
        });
      } catch { /* silent */ }
    };
    fetchStats();
    return () => { cancelled = true; };
  }, [user?.id]);

  /* ── Handlers ── */
  const handleChange = (name: keyof FormData, value: string | boolean) => {
    setFormData((prev: FormData) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setIsSaving(true);
    try {
      const res = await apiService.put('/users/me', {
        name: `${formData.givenName} ${formData.familyName}`.trim(),
        givenName: formData.givenName,
        familyName: formData.familyName,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        address: formData.address,
        city: formData.city,
        country: formData.country,
        postalCode: formData.postalCode,
        birthdate: formData.birthdate || null,
        isPublic: formData.isPublic,
      });
      const data = res.data as any;
      if (data?.success) {
        // Update stored user with new token if returned
        if (data.jwtToken) {
          await apiService.setToken(data.jwtToken);
        }
        const updatedUser = {
          ...user,
          ...formData,
          name: `${formData.givenName} ${formData.familyName}`.trim(),
          ...(data.user || {}),
        };
        await apiService.setUser(updatedUser);
        setIsEditing(false);
        Alert.alert('Success', 'Profile updated successfully.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (user) setFormData(toFormData(user));
    setIsEditing(false);
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  /* ── Format helpers ── */
  const formatBirthdate = (d: string) => {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const memberSince = () => {
    if (!(user as any)?.createdAt) return null;
    const dt = new Date((user as any).createdAt);
    if (isNaN(dt.getTime())) return null;
    return dt.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const locationStr = () => {
    const parts: string[] = [];
    if (formData.city) parts.push(formData.city);
    if (formData.country) parts.push(formData.country);
    return parts.join(', ') || null;
  };

  const homeAddress = () => {
    const parts: string[] = [];
    if (formData.address) parts.push(formData.address);
    const cityZip = [formData.postalCode, formData.city].filter(Boolean).join(' ');
    if (cityZip) parts.push(cityZip);
    return parts.join(', ') || '—';
  };

  if (isLoadingProfile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={DARK_THEME.primary} />
      </View>
    );
  }

  const firstName = formData.givenName || 'User';
  const lastName = formData.familyName || '';
  const initials = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();

  /* ── Sidebar bullets ── */
  const bulletItems: string[] = [];
  const ms = memberSince();
  if (ms) bulletItems.push(`Member since ${ms}`);
  const loc = locationStr();
  if (loc) bulletItems.push(loc);
  if ((user as any)?.nfcCardId) bulletItems.push(`NFC Card: ${(user as any).nfcCardId}`);
  bulletItems.push('CHF · Alpine region');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ═══ HEADER ═══ */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.sectionLabel}>ACCOUNT</Text>
          <Text style={styles.title}>Profile</Text>
          <Text style={styles.subtitle}>Manage your personal details and account preferences.</Text>
        </View>
        <Pressable
          style={[styles.editBtn, isSaving && { opacity: 0.6 }]}
          onPress={() => isEditing ? handleSave() : setIsEditing(true)}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.editBtnText}>{isEditing ? 'SAVE' : 'EDIT'}</Text>
          )}
        </Pressable>
      </View>

      {/* ═══ AVATAR + STATS CARD ═══ */}
      <View style={styles.avatarCard}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.userName}>{firstName} {lastName}</Text>
        <Text style={styles.userHandle}>
          @{(firstName + '.' + lastName).toLowerCase().replace(/\s+/g, '')}
        </Text>

        {/* Tier */}
        <Text style={[styles.tierBadge, {
          color: isAdmin ? DARK_THEME.primary : hasExperienceCard ? (DARK_THEME as any).gold || '#D4AF37' : DARK_THEME.textSecondary,
        }]}>
          {isAdmin ? (user?.role || 'admin').toUpperCase() : hasExperienceCard ? 'EXCLUSIVE MEMBER' : 'MEMBER'}
        </Text>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{stats.productsClaimed}</Text>
            <Text style={styles.statLabel}>PRODUCTS</Text>
          </View>
          <View style={[styles.statBox, { borderLeftWidth: 1, borderLeftColor: DARK_THEME.border }]}>
            <Text style={styles.statNum}>{stats.eventsAttended}</Text>
            <Text style={styles.statLabel}>EVENTS</Text>
          </View>
        </View>

        {/* Bullet items */}
        {bulletItems.map((item: string, i: number) => (
          <View key={i} style={styles.bulletRow}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>{item}</Text>
          </View>
        ))}
      </View>

      {/* ═══ PERSONAL INFORMATION ═══ */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>PERSONAL INFORMATION</Text>

        {/* First name / Family name */}
        <View style={styles.fieldRow}>
          <FieldCell label="First Name" value={formData.givenName} editing={isEditing}
            onChangeText={(v: string) => handleChange('givenName', v)} />
          <FieldCell label="Family Name" value={formData.familyName} editing={isEditing}
            onChangeText={(v: string) => handleChange('familyName', v)} />
        </View>

        {/* Birthdate / Phone */}
        <View style={styles.fieldRow}>
          <FieldCell label="Date of Birth"
            value={isEditing ? formData.birthdate : formatBirthdate(formData.birthdate)}
            editing={isEditing} placeholder="YYYY-MM-DD"
            onChangeText={(v: string) => handleChange('birthdate', v)} />
          <FieldCell label="Phone Number" value={formData.phoneNumber} editing={isEditing}
            keyboardType="phone-pad"
            onChangeText={(v: string) => handleChange('phoneNumber', v)} />
        </View>

        {/* Email */}
        <FieldCell label="Email Address" value={formData.email} editing={isEditing}
          keyboardType="email-address" full
          onChangeText={(v: string) => handleChange('email', v)} />

        {/* Address — collapsed view vs edit */}
        {isEditing ? (
          <>
            <FieldCell label="Street Address" value={formData.address} editing={true} full
              onChangeText={(v: string) => handleChange('address', v)} />
            <View style={styles.fieldRow3}>
              <FieldCell label="Postal Code" value={formData.postalCode} editing={true}
                onChangeText={(v: string) => handleChange('postalCode', v)} />
              <FieldCell label="City" value={formData.city} editing={true}
                onChangeText={(v: string) => handleChange('city', v)} />
              <FieldCell label="Country" value={formData.country} editing={true}
                onChangeText={(v: string) => handleChange('country', v)} />
            </View>
          </>
        ) : (
          <FieldCell label="Home Address" value={homeAddress()} editing={false} full
            onChangeText={() => {}} />
        )}

        {/* Public profile toggle */}
        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>PUBLIC PROFILE</Text>
            <Text style={styles.toggleDesc}>Allow other members to see your profile</Text>
          </View>
          <Switch
            value={formData.isPublic}
            onValueChange={(v: boolean) => handleChange('isPublic', v)}
            disabled={!isEditing}
            trackColor={{ false: DARK_THEME.border, true: DARK_THEME.primary }}
            thumbColor="#fff"
          />
        </View>

        {isEditing && (
          <Pressable style={styles.cancelBtn} onPress={handleCancel}>
            <Text style={styles.cancelBtnText}>CANCEL</Text>
          </Pressable>
        )}
      </View>

      {/* ═══ LOGOUT ═══ */}
      <Pressable style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>LOG OUT</Text>
      </Pressable>

      {/* ═══ SETTINGS LINK ═══ */}
      <Pressable style={styles.settingsLink} onPress={() => router.push('/(tabs)/settings' as any)}>
        <Text style={styles.settingsLinkText}>SETTINGS</Text>
      </Pressable>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

/* ── Field Cell ── */
interface FieldCellProps {
  label: string;
  value: string;
  editing: boolean;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  full?: boolean;
}

function FieldCell({ label, value, editing, onChangeText, placeholder, keyboardType, full }: FieldCellProps) {
  return (
    <View style={[styles.fieldCell, full && { width: '100%' }]}>
      <Text style={styles.fieldLabel}>{label.toUpperCase()}</Text>
      {editing ? (
        <TextInput
          style={styles.fieldInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder || '—'}
          placeholderTextColor={DARK_THEME.textSecondary}
          keyboardType={keyboardType || 'default'}
          autoCapitalize="none"
        />
      ) : (
        <Text style={styles.fieldValue}>{value || '—'}</Text>
      )}
    </View>
  );
}

/* ── Styles ── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK_THEME.background },
  content: { padding: 20, paddingTop: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: DARK_THEME.background },

  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 24, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: DARK_THEME.border,
  },
  sectionLabel: { fontSize: 11, letterSpacing: 4, color: DARK_THEME.primary, fontWeight: '500', marginBottom: 6 },
  title: { fontSize: 28, fontWeight: '300', color: DARK_THEME.text, marginBottom: 4 },
  subtitle: { fontSize: 12, color: DARK_THEME.textSecondary, maxWidth: 220 },
  editBtn: {
    backgroundColor: DARK_THEME.text, paddingVertical: 12, paddingHorizontal: 24,
    borderRadius: 2, marginTop: 4,
  },
  editBtnText: { color: DARK_THEME.background, fontSize: 10, letterSpacing: 2, fontWeight: '600' },

  /* Avatar card */
  avatarCard: {
    backgroundColor: DARK_THEME.surface, borderRadius: 12, padding: 24,
    borderWidth: 1, borderColor: DARK_THEME.border, alignItems: 'center', marginBottom: 16,
  },
  avatarCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: DARK_THEME.background, borderWidth: 2, borderColor: DARK_THEME.border,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  avatarText: { fontSize: 22, fontWeight: '300', color: DARK_THEME.text, letterSpacing: 1 },
  userName: { fontSize: 16, fontWeight: '400', color: DARK_THEME.text },
  userHandle: { fontSize: 11, color: DARK_THEME.textSecondary, marginBottom: 8 },
  tierBadge: { fontSize: 10, letterSpacing: 3, fontWeight: '700', marginBottom: 16 },

  statsRow: {
    flexDirection: 'row', width: '100%',
    borderTopWidth: 1, borderTopColor: DARK_THEME.border,
    borderBottomWidth: 1, borderBottomColor: DARK_THEME.border,
    marginBottom: 16,
  },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  statNum: { fontSize: 20, fontWeight: '300', color: DARK_THEME.text },
  statLabel: { fontSize: 9, letterSpacing: 2, color: DARK_THEME.textSecondary, marginTop: 2, fontWeight: '600' },

  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, alignSelf: 'flex-start' },
  bulletDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: DARK_THEME.primary },
  bulletText: { fontSize: 12, color: DARK_THEME.text, fontWeight: '300' },

  /* Info card */
  infoCard: {
    backgroundColor: DARK_THEME.surface, borderRadius: 12, padding: 20,
    borderWidth: 1, borderColor: DARK_THEME.border, marginBottom: 16,
  },
  infoTitle: {
    fontSize: 11, letterSpacing: 3, color: DARK_THEME.text, fontWeight: '600',
    marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: DARK_THEME.border,
  },

  fieldRow: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  fieldRow3: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  fieldCell: { flex: 1, paddingVertical: 10 },
  fieldLabel: { fontSize: 9, letterSpacing: 2, color: DARK_THEME.textSecondary, fontWeight: '600', marginBottom: 6 },
  fieldValue: { fontSize: 14, color: DARK_THEME.text, fontWeight: '400', minHeight: 20 },
  fieldInput: {
    fontSize: 14, color: DARK_THEME.text, fontWeight: '400', paddingVertical: 4,
    borderBottomWidth: 1, borderBottomColor: DARK_THEME.border,
  },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: DARK_THEME.border, marginTop: 8,
  },
  toggleDesc: { fontSize: 11, color: DARK_THEME.textSecondary, marginTop: 2 },

  cancelBtn: {
    marginTop: 16, paddingVertical: 12, borderRadius: 4,
    borderWidth: 1, borderColor: DARK_THEME.border, alignItems: 'center',
  },
  cancelBtnText: { fontSize: 10, letterSpacing: 2, color: DARK_THEME.textSecondary, fontWeight: '600' },

  logoutBtn: {
    paddingVertical: 14, borderRadius: 4,
    borderWidth: 1, borderColor: DARK_THEME.border, alignItems: 'center', marginBottom: 12,
  },
  logoutText: { fontSize: 11, letterSpacing: 3, color: DARK_THEME.textSecondary, fontWeight: '600' },

  settingsLink: {
    paddingVertical: 14, borderRadius: 4,
    backgroundColor: DARK_THEME.surface, borderWidth: 1, borderColor: DARK_THEME.border, alignItems: 'center',
  },
  settingsLinkText: { fontSize: 11, letterSpacing: 3, color: DARK_THEME.primary, fontWeight: '600' },
});
