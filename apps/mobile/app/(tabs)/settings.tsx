import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Switch,
  TextInput, ActivityIndicator, Alert, Modal,
} from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { apiService } from '@/services/api';
import { DARK_THEME } from '@/theme/colors';
import { useRouter } from 'expo-router';

/* ── Types ── */
type Panel = 'notifications' | 'card' | 'privacy' | 'region' | 'security';

interface NotificationSettings {
  eventInvitations: boolean;
  membershipUpdates: boolean;
  productLaunches: boolean;
  partnerOffers: boolean;
  pushProductUpdates: boolean;
  pushEventReminders: boolean;
}
interface PrivacySettings {
  dataSharing: boolean;
  analytics: boolean;
  profileVisibility: boolean;
  communityVisibility: boolean;
}
interface CardSettings {
  cardId: string;
  isActive: boolean;
  nfcEnabled: boolean;
  autoLogin: boolean;
}
interface RegionSettings {
  country: string;
  countryCode: string;
  currency: string;
  language: string;
}
interface SecurityInfo {
  twoFactorEnabled: boolean;
  twoFactorMethod: string;
  lastPasswordChange: string | null;
}

const FLAG_MAP: Record<string, string> = {
  CH: '\u{1F1E8}\u{1F1ED}', DE: '\u{1F1E9}\u{1F1EA}', FR: '\u{1F1EB}\u{1F1F7}',
  AT: '\u{1F1E6}\u{1F1F9}', IT: '\u{1F1EE}\u{1F1F9}', US: '\u{1F1FA}\u{1F1F8}', GB: '\u{1F1EC}\u{1F1E7}',
};
const LANG_MAP: Record<string, string> = {
  en: 'English', fr: 'Français', de: 'Deutsch', it: 'Italiano',
};
const COUNTRY_MAP: Record<string, string> = {
  CH: 'Switzerland', DE: 'Germany', FR: 'France', AT: 'Austria', IT: 'Italy', US: 'United States', GB: 'United Kingdom',
};

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [activePanel, setActivePanel] = useState<Panel>('notifications');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  /* ── State ── */
  const [notifications, setNotifications] = useState<NotificationSettings>({
    eventInvitations: true, membershipUpdates: true, productLaunches: false,
    partnerOffers: false, pushProductUpdates: true, pushEventReminders: true,
  });
  const [privacy, setPrivacy] = useState<PrivacySettings>({
    dataSharing: false, analytics: true, profileVisibility: true, communityVisibility: true,
  });
  const [card, setCard] = useState<CardSettings>({
    cardId: '', isActive: false, nfcEnabled: true, autoLogin: true,
  });
  const [region, setRegion] = useState<RegionSettings>({
    country: 'Switzerland', countryCode: 'CH', currency: 'CHF', language: 'en',
  });
  const [securityInfo, setSecurityInfo] = useState<SecurityInfo>({
    twoFactorEnabled: false, twoFactorMethod: 'none', lastPasswordChange: null,
  });

  /* ── Region picker modal ── */
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);

  /* ── Logout modal ── */
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  /* ── Load card from SecureStore via API ── */
  useEffect(() => {
    const loadCard = async () => {
      if (!user?.id) return;
      try {
        const ec = await apiService.getExperienceCard();
        if (ec) {
          setCard((prev: CardSettings) => ({
            ...prev,
            cardId: (ec as any).serialNumber || (ec as any).tokenId || '',
            isActive: true,
            nfcEnabled: true,
          }));
        }
      } catch { /* silent */ }
    };
    loadCard();
  }, [user?.id]);

  /* ── Fetch settings ── */
  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const res = await apiService.get('/users/me/settings');
        const p = res.data as any;
        if (p.settings) {
          if (p.settings.notifications) setNotifications((prev: NotificationSettings) => ({ ...prev, ...p.settings.notifications }));
          if (p.settings.privacy) setPrivacy((prev: PrivacySettings) => ({ ...prev, ...p.settings.privacy }));
          if (p.settings.card) setCard((prev: CardSettings) => ({ ...prev, ...p.settings.card }));
          if (p.settings.region) setRegion((prev: RegionSettings) => ({ ...prev, ...p.settings.region }));
        }
      } catch (err: any) {
        if (err?.response?.status !== 404) setError('Failed to load settings');
      }
      setLoading(false);
    };
    fetchSettings();
  }, []);

  /* ── Fetch security when panel active ── */
  useEffect(() => {
    if (activePanel === 'security') fetchSecurityInfo();
  }, [activePanel]);

  const fetchSecurityInfo = async () => {
    try {
      const res = await apiService.get('/users/me/security');
      const p = res.data as any;
      if (p.security) {
        setSecurityInfo({
          twoFactorEnabled: p.security.twoFactorEnabled,
          twoFactorMethod: p.security.twoFactorMethod,
          lastPasswordChange: p.security.lastPasswordChange,
        });
      }
    } catch { /* silent */ }
  };

  /* ── Save ── */
  const saveSettings = async () => {
    setSaving(true); setError(''); setSuccess('');
    try {
      const res = await apiService.put('/users/me/settings', { notifications, privacy, card, region });
      const p = res.data as any;
      if (p.token) await apiService.setToken(p.token);
      setSuccess('Settings saved');
      setTimeout(() => setSuccess(''), 3000);
    } catch { setError('Failed to save settings'); }
    setSaving(false);
  };

  /* ── Toggle helpers ── */
  const toggleNotif = (key: keyof NotificationSettings) =>
    setNotifications((prev: NotificationSettings) => ({ ...prev, [key]: !prev[key] }));
  const togglePrivacy = (key: keyof PrivacySettings) =>
    setPrivacy((prev: PrivacySettings) => ({ ...prev, [key]: !prev[key] }));
  const toggleCard = (key: 'nfcEnabled' | 'autoLogin') =>
    setCard((prev: CardSettings) => ({ ...prev, [key]: !prev[key] }));

  const handleLogout = async () => {
    setShowLogoutModal(false);
    await logout();
    router.replace('/');
  };

  /* ── Panel tabs ── */
  const panels: { key: Panel; label: string }[] = [
    { key: 'notifications', label: 'Notifications' },
    { key: 'card', label: 'Experience Card' },
    { key: 'privacy', label: 'Privacy' },
    { key: 'region', label: 'Region & Currency' },
    { key: 'security', label: 'Security' },
  ];

  if (loading) {
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
          <Text style={styles.sectionLabel}>ACCOUNT</Text>
          <Text style={styles.title}>Settings</Text>
        </View>
        <Pressable
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={saveSettings}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>SAVE</Text>
          )}
        </Pressable>
      </View>

      {/* Status messages */}
      {!!error && <Text style={styles.errorMsg}>{error}</Text>}
      {!!success && <Text style={styles.successMsg}>{success}</Text>}

      {/* Panel tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
        {panels.map((p: { key: Panel; label: string }) => (
          <Pressable
            key={p.key}
            style={[styles.tab, activePanel === p.key && styles.tabActive]}
            onPress={() => setActivePanel(p.key)}
          >
            <Text style={[styles.tabText, activePanel === p.key && styles.tabTextActive]}>
              {p.label.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* ═══ PANELS ═══ */}
      <View style={styles.panelCard}>

        {/* ── NOTIFICATIONS ── */}
        {activePanel === 'notifications' && (
          <>
            <Text style={styles.panelTitle}>EMAIL NOTIFICATIONS</Text>
            <ToggleRow label="Event Invitations" desc="Receive invitations to exclusive events"
              value={notifications.eventInvitations} onToggle={() => toggleNotif('eventInvitations')} />
            <ToggleRow label="Membership Updates" desc="Updates about your membership status"
              value={notifications.membershipUpdates} onToggle={() => toggleNotif('membershipUpdates')} />
            <ToggleRow label="Product Launches" desc="New product announcements"
              value={notifications.productLaunches} onToggle={() => toggleNotif('productLaunches')} />
            <ToggleRow label="Partner Offers" desc="Exclusive offers from partner brands"
              value={notifications.partnerOffers} onToggle={() => toggleNotif('partnerOffers')} />

            <Text style={[styles.panelTitle, { marginTop: 24 }]}>PUSH NOTIFICATIONS</Text>
            <ToggleRow label="Product Updates" desc="Get notified about your claimed products"
              value={notifications.pushProductUpdates} onToggle={() => toggleNotif('pushProductUpdates')} />
            <ToggleRow label="Event Reminders" desc="Reminders before upcoming events"
              value={notifications.pushEventReminders} onToggle={() => toggleNotif('pushEventReminders')} />
          </>
        )}

        {/* ── EXPERIENCE CARD ── */}
        {activePanel === 'card' && (
          <>
            <Text style={styles.panelTitle}>EXPERIENCE CARD</Text>
            {card.isActive ? (
              <>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardInfoLabel}>CARD ID</Text>
                  <Text style={styles.cardInfoValue}>{card.cardId || '—'}</Text>
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardInfoLabel}>STATUS</Text>
                  <View style={styles.activeBadge}>
                    <Text style={styles.activeBadgeText}>ACTIVE</Text>
                  </View>
                </View>
                <ToggleRow label="NFC Enabled" desc="Allow NFC authentication with your card"
                  value={card.nfcEnabled} onToggle={() => toggleCard('nfcEnabled')} />
                <ToggleRow label="Auto Login" desc="Tap card to login automatically"
                  value={card.autoLogin} onToggle={() => toggleCard('autoLogin')} />
              </>
            ) : (
              <Text style={styles.emptyText}>No experience card linked. Claim a product to receive your card.</Text>
            )}
          </>
        )}

        {/* ── PRIVACY ── */}
        {activePanel === 'privacy' && (
          <>
            <Text style={styles.panelTitle}>PRIVACY SETTINGS</Text>
            <ToggleRow label="Data Sharing" desc="Share anonymized usage data to improve our service"
              value={privacy.dataSharing} onToggle={() => togglePrivacy('dataSharing')} />
            <ToggleRow label="Analytics" desc="Allow analytics to personalise your experience"
              value={privacy.analytics} onToggle={() => togglePrivacy('analytics')} />
            <ToggleRow label="Profile Visibility" desc="Make your profile visible to other members"
              value={privacy.profileVisibility} onToggle={() => togglePrivacy('profileVisibility')} />
            <ToggleRow label="Community Visibility" desc="Show your activity in community feeds"
              value={privacy.communityVisibility} onToggle={() => togglePrivacy('communityVisibility')} />
          </>
        )}

        {/* ── REGION & CURRENCY ── */}
        {activePanel === 'region' && (
          <>
            <Text style={styles.panelTitle}>REGION & CURRENCY</Text>

            <View style={styles.regionRow}>
              <Text style={styles.regionLabel}>COUNTRY</Text>
              <Pressable style={styles.regionPicker} onPress={() => setShowCountryPicker(true)}>
                <Text style={styles.regionValue}>
                  {FLAG_MAP[region.countryCode] || ''} {region.country}
                </Text>
              </Pressable>
            </View>

            <View style={styles.regionRow}>
              <Text style={styles.regionLabel}>CURRENCY</Text>
              <Text style={styles.regionValue}>{region.currency}</Text>
            </View>

            <View style={styles.regionRow}>
              <Text style={styles.regionLabel}>LANGUAGE</Text>
              <Pressable style={styles.regionPicker} onPress={() => setShowLangPicker(true)}>
                <Text style={styles.regionValue}>
                  {LANG_MAP[region.language] || region.language}
                </Text>
              </Pressable>
            </View>
          </>
        )}

        {/* ── SECURITY ── */}
        {activePanel === 'security' && (
          <>
            <Text style={styles.panelTitle}>SECURITY</Text>

            <View style={styles.secRow}>
              <Text style={styles.secLabel}>TWO-FACTOR AUTHENTICATION</Text>
              <Text style={[styles.secValue, {
                color: securityInfo.twoFactorEnabled ? '#4caf50' : DARK_THEME.textSecondary,
              }]}>
                {securityInfo.twoFactorEnabled ? `Enabled (${securityInfo.twoFactorMethod})` : 'Disabled'}
              </Text>
            </View>

            <View style={styles.secRow}>
              <Text style={styles.secLabel}>LAST PASSWORD CHANGE</Text>
              <Text style={styles.secValue}>
                {securityInfo.lastPasswordChange
                  ? new Date(securityInfo.lastPasswordChange).toLocaleDateString()
                  : 'Never'}
              </Text>
            </View>

            <Pressable style={styles.dangerBtn} onPress={() => setShowLogoutModal(true)}>
              <Text style={styles.dangerBtnText}>LOG OUT ALL DEVICES</Text>
            </Pressable>
          </>
        )}
      </View>

      <View style={{ height: 60 }} />

      {/* ── COUNTRY PICKER MODAL ── */}
      <Modal visible={showCountryPicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>SELECT COUNTRY</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {Object.entries(COUNTRY_MAP).map(([code, name]: [string, string]) => (
                <Pressable
                  key={code}
                  style={[styles.pickerItem, region.countryCode === code && styles.pickerItemActive]}
                  onPress={() => {
                    const currencies: Record<string, string> = { CH: 'CHF', DE: 'EUR', FR: 'EUR', AT: 'EUR', IT: 'EUR', US: 'USD', GB: 'GBP' };
                    setRegion((prev: RegionSettings) => ({
                      ...prev,
                      country: name,
                      countryCode: code,
                      currency: currencies[code] || prev.currency,
                    }));
                    setShowCountryPicker(false);
                  }}
                >
                  <Text style={styles.pickerItemText}>{FLAG_MAP[code] || ''} {name}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={styles.modalClose} onPress={() => setShowCountryPicker(false)}>
              <Text style={styles.modalCloseText}>CANCEL</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ── LANGUAGE PICKER MODAL ── */}
      <Modal visible={showLangPicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>SELECT LANGUAGE</Text>
            {Object.entries(LANG_MAP).map(([code, name]: [string, string]) => (
              <Pressable
                key={code}
                style={[styles.pickerItem, region.language === code && styles.pickerItemActive]}
                onPress={() => {
                  setRegion((prev: RegionSettings) => ({ ...prev, language: code }));
                  setShowLangPicker(false);
                }}
              >
                <Text style={styles.pickerItemText}>{name}</Text>
              </Pressable>
            ))}
            <Pressable style={styles.modalClose} onPress={() => setShowLangPicker(false)}>
              <Text style={styles.modalCloseText}>CANCEL</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ── LOGOUT CONFIRMATION ── */}
      <Modal visible={showLogoutModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>LOG OUT</Text>
            <Text style={styles.modalDesc}>Are you sure you want to log out from all devices?</Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setShowLogoutModal(false)}>
                <Text style={styles.modalCancelText}>CANCEL</Text>
              </Pressable>
              <Pressable style={styles.modalConfirmBtn} onPress={handleLogout}>
                <Text style={styles.modalConfirmText}>LOG OUT</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

/* ── Toggle Row component ── */
function ToggleRow({ label, desc, value, onToggle }: {
  label: string; desc: string; value: boolean; onToggle: () => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleDesc}>{desc}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: DARK_THEME.border, true: DARK_THEME.primary }}
        thumbColor="#fff"
      />
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
    marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: DARK_THEME.border,
  },
  sectionLabel: { fontSize: 11, letterSpacing: 4, color: DARK_THEME.primary, fontWeight: '500', marginBottom: 6 },
  title: { fontSize: 28, fontWeight: '300', color: DARK_THEME.text },
  saveBtn: {
    backgroundColor: DARK_THEME.text, paddingVertical: 12, paddingHorizontal: 24,
    borderRadius: 2, marginTop: 4,
  },
  saveBtnText: { color: DARK_THEME.background, fontSize: 10, letterSpacing: 2, fontWeight: '600' },

  errorMsg: { color: '#ef5350', fontSize: 12, marginBottom: 12, textAlign: 'center' },
  successMsg: { color: '#66bb6a', fontSize: 12, marginBottom: 12, textAlign: 'center' },

  /* Tabs */
  tabsScroll: { marginBottom: 16 },
  tab: {
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 4, marginRight: 8,
    borderWidth: 1, borderColor: DARK_THEME.border,
  },
  tabActive: { backgroundColor: DARK_THEME.text, borderColor: DARK_THEME.text },
  tabText: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, color: DARK_THEME.textSecondary },
  tabTextActive: { color: DARK_THEME.background },

  /* Panel card */
  panelCard: {
    backgroundColor: DARK_THEME.surface, borderRadius: 12, padding: 20,
    borderWidth: 1, borderColor: DARK_THEME.border,
  },
  panelTitle: {
    fontSize: 10, letterSpacing: 3, color: DARK_THEME.text, fontWeight: '700',
    marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: DARK_THEME.border,
  },

  /* Toggle rows */
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: DARK_THEME.border,
  },
  toggleLabel: { fontSize: 13, color: DARK_THEME.text, fontWeight: '500' },
  toggleDesc: { fontSize: 11, color: DARK_THEME.textSecondary, marginTop: 2 },

  /* Card info */
  cardInfo: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: DARK_THEME.border,
  },
  cardInfoLabel: { fontSize: 9, letterSpacing: 2, color: DARK_THEME.textSecondary, fontWeight: '600' },
  cardInfoValue: { fontSize: 13, color: DARK_THEME.text },
  activeBadge: { backgroundColor: '#1b5e20', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 4 },
  activeBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 1, color: '#66bb6a' },
  emptyText: { fontSize: 13, color: DARK_THEME.textSecondary, lineHeight: 20 },

  /* Region */
  regionRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: DARK_THEME.border,
  },
  regionLabel: { fontSize: 9, letterSpacing: 2, color: DARK_THEME.textSecondary, fontWeight: '600' },
  regionPicker: { paddingVertical: 4, paddingHorizontal: 8 },
  regionValue: { fontSize: 14, color: DARK_THEME.text },

  /* Security */
  secRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: DARK_THEME.border,
  },
  secLabel: { fontSize: 9, letterSpacing: 2, color: DARK_THEME.textSecondary, fontWeight: '600', flex: 1 },
  secValue: { fontSize: 13, color: DARK_THEME.text },
  dangerBtn: {
    marginTop: 20, paddingVertical: 14, borderRadius: 4,
    borderWidth: 1, borderColor: '#c62828', alignItems: 'center',
  },
  dangerBtnText: { fontSize: 10, letterSpacing: 2, color: '#ef5350', fontWeight: '700' },

  /* Modals */
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalCard: {
    backgroundColor: DARK_THEME.surface, borderRadius: 12, padding: 24,
    width: '100%', maxWidth: 360, borderWidth: 1, borderColor: DARK_THEME.border,
  },
  modalTitle: {
    fontSize: 11, letterSpacing: 3, color: DARK_THEME.text, fontWeight: '700', marginBottom: 16,
  },
  modalDesc: { fontSize: 13, color: DARK_THEME.textSecondary, marginBottom: 20, lineHeight: 20 },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 4,
    borderWidth: 1, borderColor: DARK_THEME.border, alignItems: 'center',
  },
  modalCancelText: { fontSize: 10, letterSpacing: 2, color: DARK_THEME.textSecondary, fontWeight: '600' },
  modalConfirmBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 4,
    backgroundColor: '#c62828', alignItems: 'center',
  },
  modalConfirmText: { fontSize: 10, letterSpacing: 2, color: '#fff', fontWeight: '600' },
  modalClose: { marginTop: 16, paddingVertical: 12, alignItems: 'center' },
  modalCloseText: { fontSize: 10, letterSpacing: 2, color: DARK_THEME.textSecondary, fontWeight: '600' },

  /* Picker items */
  pickerItem: {
    paddingVertical: 12, paddingHorizontal: 8,
    borderBottomWidth: 1, borderBottomColor: DARK_THEME.border,
  },
  pickerItemActive: { backgroundColor: DARK_THEME.background },
  pickerItemText: { fontSize: 14, color: DARK_THEME.text },
});
