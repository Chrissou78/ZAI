import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  ActivityIndicator, RefreshControl, Modal, Pressable, TextInput,
  Alert, Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { apiService } from '@/services/api';
import ScreenBackground from '@/components/ScreenBackground';
import { DARK_THEME } from '@/theme/colors';

// ─── Types ───

interface Member {
  id: string;
  name: string;
  avatar: string;
  wallet?: string;
  phone?: string;
  city?: string;
  country?: string;
  joinedAt: string;
  isPublic: boolean;
  isBlocked?: boolean;
}

interface Reaction { emoji: string; userId: string; userName: string; }

interface Photo {
  id: string;
  cid: string;
  url: string;
  caption: string;
  authorId: string;
  authorName: string;
  commentCount: number;
  createdAt: string;
  comments?: Comment[];
  reactions?: Reaction[];
  location?: string;
}

interface Comment {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  createdAt: string;
}

interface CommunityStats { totalMembers: number; totalPhotos: number; }

// ─── Constants ───

const REACTION_EMOJIS = ['❤️','🔥','👏','🤩','😍','🙌','⛷️','🏔','🎿','🏂','❄️','🌨️'];
const MEMBER_DOT_COLORS = ['#7A222E','#2563eb','#f59e0b','#10b981','#8b5cf6','#ec4899','#06b6d4','#f97316'];

// ─── Helpers ───

function timeAgo(d: string) {
  if (!d) return '';
  const diff = Date.now() - new Date(d).getTime();
  if (isNaN(diff)) return d;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getMemberLocation(m: Member) {
  if (m.city && m.country) return `${m.city}, ${m.country}`;
  if (m.city) return m.city;
  if (m.country) return m.country;
  return '—';
}

function groupReactions(reactions: Reaction[], userId?: string) {
  const map: Record<string, { count: number; users: string[]; reacted: boolean }> = {};
  for (const r of reactions) {
    if (!map[r.emoji]) map[r.emoji] = { count: 0, users: [], reacted: false };
    map[r.emoji].count++;
    map[r.emoji].users.push(r.userName);
    if (r.userId === userId) map[r.emoji].reacted = true;
  }
  return map;
}

// ═══════════════════════════════
//  COMPONENT
// ═══════════════════════════════

export default function CommunityScreen() {
  const { user, isAdmin } = useAuth();

  // Tab state
  const [activeTab, setActiveTab] = useState<'gallery' | 'members'>('gallery');

  // Gallery state
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [stats, setStats] = useState<CommunityStats>({ totalMembers: 0, totalPhotos: 0 });
  const [photosLoading, setPhotosLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [newComment, setNewComment] = useState('');
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Members state
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');

  // Caption modal state
  const [showCaptionModal, setShowCaptionModal] = useState(false);
  const [captionText, setCaptionText] = useState('');
  const [captionBase64, setCaptionBase64] = useState('');

  // ── Fetch gallery ──

  const fetchPhotos = useCallback(async (background = false) => {
    if (!background) setPhotosLoading(true);
    try {
      const [photosRes, statsRes] = await Promise.all([
        apiService.get('/community/photos'),
        apiService.get('/community/stats'),
      ]);
      setPhotos(photosRes.data?.data || []);
      setStats(statsRes.data?.data || { totalMembers: 0, totalPhotos: 0 });
    } catch (err: any) {
      console.error('Gallery fetch error:', err.message);
    } finally {
      if (!background) setPhotosLoading(false);
    }
  }, []);

  // ── Fetch members ──

  const fetchMembers = useCallback(async () => {
    setMembersLoading(true);
    try {
      const res = await apiService.get('/community/members', { limit: 100 });
      setMembers(res.data?.data || []);
    } catch (err: any) {
      console.error('Members fetch error:', err.message);
    } finally {
      setMembersLoading(false);
    }
  }, []);

  useEffect(() => { fetchPhotos(); }, [fetchPhotos]);
  useEffect(() => { if (activeTab === 'members' && members.length === 0) fetchMembers(); }, [activeTab]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (activeTab === 'gallery') await fetchPhotos(true);
    else await fetchMembers();
    setRefreshing(false);
  };

  // ── Upload photo ──

  const handleUploadPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Photo library access is required.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      base64: true,
      allowsEditing: true,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const base64 = result.assets[0].base64!;

    Alert.alert(
      'Add a caption',
      'Would you like to add a caption to your photo?',
      [
        {
          text: 'Skip',
          onPress: () => doUpload(base64, ''),
        },
        {
          text: 'Add Caption',
          onPress: () => {
            setCaptionBase64(base64);
            setShowCaptionModal(true);
          },
        },
      ]
    );
  };

  const doUpload = async (base64: string, caption: string) => {
    setUploading(true);
    try {
      const res = await apiService.post('/community/photos', {
        image: `data:image/jpeg;base64,${base64}`,
        caption,
      });
      if (res.data?.success) {
        Alert.alert('Posted!', 'Your photo has been shared with the community.');
        fetchPhotos(true);
      } else {
        Alert.alert('Error', res.data?.error || 'Upload failed');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // ── Reactions ──

  const handleReaction = async (photoId: string, emoji: string) => {
    setShowReactionPicker(null);
    try {
      const res = await apiService.post(`/community/photos/${photoId}/reactions`, { emoji });
      if (res.data?.success) {
        fetchPhotos(true);
        if (selectedPhoto?.id === photoId) {
          const photoRes = await apiService.get(`/community/photos/${photoId}`);
          if (photoRes.data?.success) setSelectedPhoto(photoRes.data.data);
        }
      }
    } catch {}
  };

  // ── Comments ──

  const handleAddComment = async () => {
    if (!selectedPhoto || !newComment.trim()) return;
    try {
      const res = await apiService.post(`/community/photos/${selectedPhoto.id}/comments`, {
        text: newComment.trim(),
      });
      if (res.data?.success) {
        setNewComment('');
        const photoRes = await apiService.get(`/community/photos/${selectedPhoto.id}`);
        if (photoRes.data?.success) setSelectedPhoto(photoRes.data.data);
        fetchPhotos(true);
      }
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to post comment');
    }
  };

  const handleDeleteComment = async (photoId: string, commentId: string) => {
    Alert.alert('Delete Comment', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await apiService.delete(`/community/photos/${photoId}/comments/${commentId}`);
            const photoRes = await apiService.get(`/community/photos/${photoId}`);
            if (photoRes.data?.success) setSelectedPhoto(photoRes.data.data);
            fetchPhotos(true);
          } catch {}
        },
      },
    ]);
  };

  // ── Delete photo (admin/owner) ──

  const handleDeletePhoto = async (photoId: string) => {
    Alert.alert('Delete Photo', 'This will permanently remove this photo.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await apiService.delete(`/community/photos/${photoId}`);
            setSelectedPhoto(null);
            fetchPhotos(true);
          } catch (err: any) {
            Alert.alert('Error', 'Failed to delete');
          }
        },
      },
    ]);
  };

  // ── Filtered members ──

  const filteredMembers = memberSearch
    ? members.filter(m => m.name.toLowerCase().includes(memberSearch.toLowerCase()))
    : members;

  // ═══════════════════════════════
  //  RENDER
  // ═══════════════════════════════

  return (
    <ScreenBackground variant="content">
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
      >
        {/* ── Header ── */}
        <Text style={styles.sectionLabel}>COMMUNITY</Text>
        <Text style={styles.title}>zai Community</Text>

        {/* Stats bar */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.totalMembers}</Text>
            <Text style={styles.statLabel}>Members</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.totalPhotos}</Text>
            <Text style={styles.statLabel}>Photos</Text>
          </View>
        </View>

        {/* Tab switcher */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'gallery' && styles.tabActive]}
            onPress={() => setActiveTab('gallery')}
          >
            <Text style={[styles.tabText, activeTab === 'gallery' && styles.tabTextActive]}>GALLERY</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'members' && styles.tabActive]}
            onPress={() => setActiveTab('members')}
          >
            <Text style={[styles.tabText, activeTab === 'members' && styles.tabTextActive]}>MEMBERS</Text>
          </TouchableOpacity>
        </View>

        {/* ══════ GALLERY TAB ══════ */}
        {activeTab === 'gallery' && (
          <>
            {/* Upload button */}
            <TouchableOpacity
              style={styles.uploadBtn}
              onPress={handleUploadPhoto}
              disabled={uploading}
              activeOpacity={0.85}
            >
              <Ionicons name="camera-outline" size={18} color="#fff" />
              <Text style={styles.uploadBtnText}>
                {uploading ? 'UPLOADING…' : 'SHARE A PHOTO'}
              </Text>
            </TouchableOpacity>

            {photosLoading ? (
              <ActivityIndicator size="large" color={DARK_THEME.primary} style={{ marginTop: 48 }} />
            ) : photos.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={{ fontSize: 40, marginBottom: 12 }}>📸</Text>
                <Text style={styles.emptyTitle}>No photos yet</Text>
                <Text style={styles.emptyDesc}>Be the first to share a moment with the community!</Text>
              </View>
            ) : (
              photos.map((photo) => {
                const reactions = groupReactions(photo.reactions || [], user?.id);
                return (
                  <TouchableOpacity
                    key={photo.id}
                    style={styles.photoCard}
                    activeOpacity={0.9}
                    onPress={() => setSelectedPhoto(photo)}
                  >
                    {/* Author header */}
                    <View style={styles.photoHeader}>
                      <View style={styles.avatarCircle}>
                        <Text style={styles.avatarText}>
                          {(photo.authorName?.charAt(0) || 'M').toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.authorName}>{photo.authorName}</Text>
                        <Text style={styles.photoTime}>{timeAgo(photo.createdAt)}</Text>
                      </View>
                      {(isAdmin || photo.authorId === user?.id) && (
                        <TouchableOpacity onPress={() => handleDeletePhoto(photo.id)}>
                          <Ionicons name="trash-outline" size={16} color={DARK_THEME.textSecondary} />
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Photo */}
                    <Image source={{ uri: photo.url }} style={styles.photoImage} />

                    {/* Caption */}
                    {photo.caption ? (
                      <Text style={styles.photoCaption} numberOfLines={3}>{photo.caption}</Text>
                    ) : null}

                    {/* Location */}
                    {photo.location ? (
                      <View style={styles.photoLocationRow}>
                        <Ionicons name="location-outline" size={12} color={DARK_THEME.textSecondary} />
                        <Text style={styles.photoLocationText}>{photo.location}</Text>
                      </View>
                    ) : null}

                    {/* Reactions */}
                    {Object.keys(reactions).length > 0 && (
                      <View style={styles.reactionsRow}>
                        {Object.entries(reactions).map(([emoji, data]) => (
                          <TouchableOpacity
                            key={emoji}
                            style={[styles.reactionBubble, data.reacted && styles.reactionBubbleActive]}
                            onPress={() => handleReaction(photo.id, emoji)}
                          >
                            <Text style={{ fontSize: 14 }}>{emoji}</Text>
                            <Text style={styles.reactionCount}>{data.count}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    {/* Footer: react + comment count */}
                    <View style={styles.photoFooter}>
                      <TouchableOpacity
                        style={styles.footerAction}
                        onPress={() => setShowReactionPicker(showReactionPicker === photo.id ? null : photo.id)}
                      >
                        <Ionicons name="heart-outline" size={18} color={DARK_THEME.textSecondary} />
                        <Text style={styles.footerActionText}>React</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.footerAction}
                        onPress={() => setSelectedPhoto(photo)}
                      >
                        <Ionicons name="chatbubble-outline" size={16} color={DARK_THEME.textSecondary} />
                        <Text style={styles.footerActionText}>
                          {photo.commentCount || 0}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Reaction picker */}
                    {showReactionPicker === photo.id && (
                      <View style={styles.reactionPicker}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          {REACTION_EMOJIS.map((emoji) => (
                            <TouchableOpacity
                              key={emoji}
                              style={styles.emojiBtn}
                              onPress={() => handleReaction(photo.id, emoji)}
                            >
                              <Text style={{ fontSize: 22 }}>{emoji}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </>
        )}

        {/* ══════ MEMBERS TAB ══════ */}
        {activeTab === 'members' && (
          <>
            {/* Search */}
            <View style={styles.searchBar}>
              <Ionicons name="search-outline" size={16} color={DARK_THEME.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search members…"
                placeholderTextColor={DARK_THEME.textSecondary}
                value={memberSearch}
                onChangeText={setMemberSearch}
              />
            </View>

            {membersLoading ? (
              <ActivityIndicator size="large" color={DARK_THEME.primary} style={{ marginTop: 48 }} />
            ) : filteredMembers.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No members found</Text>
              </View>
            ) : (
              <View style={styles.membersList}>
                {filteredMembers.map((member, idx) => (
                  <View
                    key={member.id}
                    style={[styles.memberRow, idx < filteredMembers.length - 1 && styles.memberRowBorder]}
                  >
                    <View style={[styles.memberDot, { backgroundColor: MEMBER_DOT_COLORS[idx % MEMBER_DOT_COLORS.length] }]} />
                    <View style={styles.memberAvatarCircle}>
                      <Text style={styles.memberAvatarText}>
                        {(member.name?.charAt(0) || 'M').toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName}>{member.name}</Text>
                      <Text style={styles.memberLocation}>{getMemberLocation(member)}</Text>
                    </View>
                    <Text style={styles.memberJoined}>
                      {new Date(member.joinedAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* ══════ PHOTO DETAIL MODAL ══════ */}
      {selectedPhoto && (
        <Modal transparent visible animationType="slide" onRequestClose={() => setSelectedPhoto(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <ScrollView bounces={false} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {/* Close */}
                <TouchableOpacity style={styles.modalClose} onPress={() => setSelectedPhoto(null)}>
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>

                {/* Photo */}
                <Image source={{ uri: selectedPhoto.url }} style={styles.modalPhoto} resizeMode="contain" />

                <View style={styles.modalBody}>
                  {/* Author */}
                  <View style={styles.photoHeader}>
                    <View style={styles.avatarCircle}>
                      <Text style={styles.avatarText}>
                        {(selectedPhoto.authorName?.charAt(0) || 'M').toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.authorName}>{selectedPhoto.authorName}</Text>
                      <Text style={styles.photoTime}>{timeAgo(selectedPhoto.createdAt)}</Text>
                    </View>
                    {(isAdmin || selectedPhoto.authorId === user?.id) && (
                      <TouchableOpacity onPress={() => handleDeletePhoto(selectedPhoto.id)}>
                        <Ionicons name="trash-outline" size={16} color={DARK_THEME.primary} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {selectedPhoto.caption ? (
                    <Text style={[styles.photoCaption, { marginBottom: 16 }]}>{selectedPhoto.caption}</Text>
                  ) : null}

                  {/* Reactions */}
                  {(() => {
                    const reactions = groupReactions(selectedPhoto.reactions || [], user?.id);
                    if (Object.keys(reactions).length === 0) return null;
                    return (
                      <View style={[styles.reactionsRow, { marginBottom: 16 }]}>
                        {Object.entries(reactions).map(([emoji, data]) => (
                          <TouchableOpacity
                            key={emoji}
                            style={[styles.reactionBubble, data.reacted && styles.reactionBubbleActive]}
                            onPress={() => handleReaction(selectedPhoto.id, emoji)}
                          >
                            <Text style={{ fontSize: 14 }}>{emoji}</Text>
                            <Text style={styles.reactionCount}>{data.count}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    );
                  })()}

                  {/* Reaction picker in modal */}
                  <View style={styles.reactionPicker}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {REACTION_EMOJIS.map((emoji) => (
                        <TouchableOpacity
                          key={emoji}
                          style={styles.emojiBtn}
                          onPress={() => handleReaction(selectedPhoto.id, emoji)}
                        >
                          <Text style={{ fontSize: 20 }}>{emoji}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  {/* Comments */}
                  <Text style={styles.commentsHeader}>
                    COMMENTS ({selectedPhoto.comments?.length || selectedPhoto.commentCount || 0})
                  </Text>

                  {(selectedPhoto.comments || []).length === 0 ? (
                    <Text style={styles.noComments}>No comments yet. Be the first!</Text>
                  ) : (
                    (selectedPhoto.comments || []).map((comment) => (
                      <View key={comment.id} style={styles.commentRow}>
                        <View style={styles.commentAvatarCircle}>
                          <Text style={styles.commentAvatarText}>
                            {(comment.authorName?.charAt(0) || 'M').toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={styles.commentAuthor}>{comment.authorName}</Text>
                            <Text style={styles.commentTime}>{timeAgo(comment.createdAt)}</Text>
                          </View>
                          <Text style={styles.commentText}>{comment.text}</Text>
                        </View>
                        {(isAdmin || comment.authorId === user?.id) && (
                          <TouchableOpacity onPress={() => handleDeleteComment(selectedPhoto.id, comment.id)}>
                            <Ionicons name="close-circle-outline" size={16} color={DARK_THEME.textSecondary} />
                          </TouchableOpacity>
                        )}
                      </View>
                    ))
                  )}

                  {/* Add comment input */}
                  <View style={styles.commentInputRow}>
                    <TextInput
                      style={styles.commentInput}
                      placeholder="Add a comment…"
                      placeholderTextColor={DARK_THEME.textSecondary}
                      value={newComment}
                      onChangeText={setNewComment}
                      multiline
                    />
                    <TouchableOpacity
                      style={[styles.commentSendBtn, !newComment.trim() && { opacity: 0.3 }]}
                      onPress={handleAddComment}
                      disabled={!newComment.trim()}
                    >
                      <Ionicons name="send" size={18} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* ══════ CAPTION INPUT MODAL ══════ */}
      {showCaptionModal && (
        <Modal transparent visible animationType="fade" onRequestClose={() => setShowCaptionModal(false)}>
          <Pressable style={styles.captionOverlay} onPress={() => setShowCaptionModal(false)}>
            <View style={styles.captionCard} onStartShouldSetResponder={() => true}>
              <Text style={styles.captionModalTitle}>Add a caption</Text>
              <TextInput
                style={styles.captionModalInput}
                placeholder="Describe your photo…"
                placeholderTextColor={DARK_THEME.textSecondary}
                value={captionText}
                onChangeText={setCaptionText}
                multiline
                autoFocus
              />
              <View style={styles.captionModalActions}>
                <TouchableOpacity
                  style={styles.captionCancelBtn}
                  onPress={() => {
                    setShowCaptionModal(false);
                    setCaptionText('');
                    doUpload(captionBase64, '');
                  }}
                >
                  <Text style={styles.captionCancelText}>SKIP</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.captionSubmitBtn}
                  onPress={() => {
                    const caption = captionText.trim();
                    setShowCaptionModal(false);
                    setCaptionText('');
                    doUpload(captionBase64, caption);
                  }}
                >
                  <Text style={styles.captionSubmitText}>POST</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Pressable>
        </Modal>
      )}
    </ScreenBackground>
  );
}

// ═══════════════════════════════
//  STYLES
// ═══════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 24, paddingTop: 64, paddingBottom: 48 },

  sectionLabel: { fontSize: 10, letterSpacing: 4, color: DARK_THEME.primary, fontWeight: '600', marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '300', color: DARK_THEME.text, marginBottom: 20 },

  // Stats
  statsRow: {
    flexDirection: 'row', borderWidth: 1, borderColor: DARK_THEME.border,
    borderRadius: 8, marginBottom: 24, overflow: 'hidden',
  },
  statItem: { flex: 1, paddingVertical: 16, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: DARK_THEME.border },
  statValue: { fontSize: 24, fontWeight: '200', color: DARK_THEME.text },
  statLabel: { fontSize: 9, letterSpacing: 2, color: DARK_THEME.textSecondary, fontWeight: '600', marginTop: 4 },

  // Tabs
  tabRow: { flexDirection: 'row', marginBottom: 24, gap: 8 },
  tab: {
    flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8,
    borderWidth: 1, borderColor: DARK_THEME.border,
  },
  tabActive: { backgroundColor: DARK_THEME.text, borderColor: DARK_THEME.text },
  tabText: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: DARK_THEME.textSecondary },
  tabTextActive: { color: DARK_THEME.background },

  // Upload
  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: DARK_THEME.primary, borderRadius: 10, height: 48, marginBottom: 24,
  },
  uploadBtnText: { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 2 },

  // Empty
  emptyCard: {
    padding: 40, backgroundColor: DARK_THEME.surface, borderRadius: 12,
    borderWidth: 1, borderColor: DARK_THEME.border, alignItems: 'center',
  },
  emptyTitle: { fontSize: 15, fontWeight: '300', color: DARK_THEME.text, marginBottom: 4 },
  emptyDesc: { fontSize: 12, color: DARK_THEME.textSecondary, textAlign: 'center', lineHeight: 20 },

  // ── Photo card ──
  photoCard: {
    backgroundColor: DARK_THEME.surface, borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: DARK_THEME.border, marginBottom: 20,
  },
  photoHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14,
  },
  avatarCircle: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: DARK_THEME.card,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 14, color: DARK_THEME.text, fontWeight: '600' },
  authorName: { fontSize: 13, fontWeight: '600', color: DARK_THEME.text },
  photoTime: { fontSize: 10, color: DARK_THEME.textSecondary, marginTop: 2 },
  photoImage: { width: '100%', aspectRatio: 1, backgroundColor: DARK_THEME.background },
  photoCaption: { fontSize: 13, color: DARK_THEME.text, lineHeight: 20, paddingHorizontal: 14, paddingTop: 12 },
  photoLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingTop: 6 },
  photoLocationText: { fontSize: 11, color: DARK_THEME.textSecondary },

  // Reactions
  reactionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 14, paddingTop: 10 },
  reactionBubble: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: DARK_THEME.card, borderRadius: 16,
    paddingVertical: 4, paddingHorizontal: 8,
    borderWidth: 1, borderColor: DARK_THEME.border,
  },
  reactionBubbleActive: { borderColor: DARK_THEME.primary, backgroundColor: 'rgba(122,34,46,0.15)' },
  reactionCount: { fontSize: 11, color: DARK_THEME.textSecondary, fontWeight: '600' },

  // Footer
  photoFooter: {
    flexDirection: 'row', gap: 20, paddingHorizontal: 14,
    paddingVertical: 12, borderTopWidth: 1, borderTopColor: DARK_THEME.border, marginTop: 10,
  },
  footerAction: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerActionText: { fontSize: 12, color: DARK_THEME.textSecondary },

  // Reaction picker
  reactionPicker: {
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: DARK_THEME.card, borderTopWidth: 1, borderTopColor: DARK_THEME.border,
  },
  emojiBtn: { paddingHorizontal: 6, paddingVertical: 4 },

  // ── Members ──
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: DARK_THEME.surface, borderRadius: 8, paddingHorizontal: 14,
    borderWidth: 1, borderColor: DARK_THEME.border, marginBottom: 20,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 13, color: DARK_THEME.text },
  membersList: {
    borderWidth: 1, borderColor: DARK_THEME.border, borderRadius: 8, overflow: 'hidden',
  },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 16, backgroundColor: DARK_THEME.surface,
  },
  memberRowBorder: { borderBottomWidth: 1, borderBottomColor: DARK_THEME.border },
  memberDot: { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },
  memberAvatarCircle: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: DARK_THEME.card,
    justifyContent: 'center', alignItems: 'center',
  },
  memberAvatarText: { fontSize: 12, color: DARK_THEME.text, fontWeight: '600' },
  memberName: { fontSize: 14, fontWeight: '500', color: DARK_THEME.text },
  memberLocation: { fontSize: 11, color: DARK_THEME.textSecondary, marginTop: 2 },
  memberJoined: { fontSize: 10, color: DARK_THEME.textSecondary },

  // ── Modal ──
  modalOverlay: { flex: 1, backgroundColor: 'rgba(10,10,10,0.92)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: DARK_THEME.background, borderTopLeftRadius: 16, borderTopRightRadius: 16,
    maxHeight: '95%', overflow: 'hidden',
  },
  modalClose: {
    position: 'absolute', top: 16, right: 16, zIndex: 10,
    width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalCloseText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  modalPhoto: { width: '100%', aspectRatio: 1, backgroundColor: '#000' },
  modalBody: { padding: 20, paddingBottom: 40 },

  // Comments
  commentsHeader: {
    fontSize: 10, letterSpacing: 2, color: DARK_THEME.textSecondary,
    fontWeight: '600', marginTop: 20, marginBottom: 14,
  },
  noComments: { fontSize: 13, color: DARK_THEME.textSecondary, fontStyle: 'italic', marginBottom: 16 },
  commentRow: {
    flexDirection: 'row', gap: 10, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: DARK_THEME.border,
  },
  commentAvatarCircle: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: DARK_THEME.card,
    justifyContent: 'center', alignItems: 'center',
  },
  commentAvatarText: { fontSize: 10, color: DARK_THEME.text, fontWeight: '600' },
  commentAuthor: { fontSize: 12, fontWeight: '600', color: DARK_THEME.text },
  commentTime: { fontSize: 10, color: DARK_THEME.textSecondary },
  commentText: { fontSize: 13, color: DARK_THEME.textSecondary, lineHeight: 19, marginTop: 2 },

  // Comment input
  commentInputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 16,
    borderTopWidth: 1, borderTopColor: DARK_THEME.border, paddingTop: 14,
  },
  commentInput: {
    flex: 1, backgroundColor: DARK_THEME.surface, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 13,
    color: DARK_THEME.text, maxHeight: 80,
    borderWidth: 1, borderColor: DARK_THEME.border,
  },
  commentSendBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: DARK_THEME.primary,
    justifyContent: 'center', alignItems: 'center',
  },

  // ── Caption modal ──
  captionOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  captionCard: {
    backgroundColor: DARK_THEME.surface, borderRadius: 16, padding: 24,
    width: '100%', maxWidth: 340,
    borderWidth: 1, borderColor: DARK_THEME.border,
  },
  captionModalTitle: {
    fontSize: 16, fontWeight: '600', color: DARK_THEME.text, marginBottom: 16,
  },
  captionModalInput: {
    backgroundColor: DARK_THEME.background, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14,
    color: DARK_THEME.text, minHeight: 80, textAlignVertical: 'top',
    borderWidth: 1, borderColor: DARK_THEME.border, marginBottom: 16,
  },
  captionModalActions: {
    flexDirection: 'row', gap: 12,
  },
  captionCancelBtn: {
    flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8,
    borderWidth: 1, borderColor: DARK_THEME.border,
  },
  captionCancelText: {
    fontSize: 11, fontWeight: '700', letterSpacing: 2, color: DARK_THEME.textSecondary,
  },
  captionSubmitBtn: {
    flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8,
    backgroundColor: DARK_THEME.primary,
  },
  captionSubmitText: {
    fontSize: 11, fontWeight: '700', letterSpacing: 2, color: '#fff',
  },
});
