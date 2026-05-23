import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../../context/AppContext';
import { apiService } from '../../services/api';

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

interface Reaction {
  emoji: string;
  userId: string;
  userName: string;
}

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
}

interface Comment {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  createdAt: string;
}

interface CommunityStats {
  totalMembers: number;
  totalPhotos: number;
}

interface ReactionResponse {
  success: boolean;
  action: 'added' | 'removed';
  emoji: string;
  data?: Reaction;
}

type Tab = 'feed' | 'members';

// ─── Constants ───

const REACTION_EMOJIS = [
  '❤️','🔥','👏','🤩','😍','🙌',
  '⛷️','🏔️','🎿','🏂','❄️','🌨️',
  '💪','🥇','🏆','⭐','💎','👌',
  '😂','🫶','🙏','🎉','💯','🚀',
];

// ─── Design tokens – HTML reference ───

const C = {
  black:      '#0a0a0a',
  white:      '#f5f4f0',
  red:        '#c8102e',
  burgundy:   '#7D1E2C',
  gray:       '#1a1a1a',
  mid:        '#2e2e2e',
  muted:      '#6a6a6a',
  border:     '#e0ddd6',
  borderDark: '#2a2a2a',
  gold:       '#f5f4f0',
  surface:    '#f0ede6',
  surface2:   '#e8e5de',
  pureWhite:  '#ffffff',
};

const sectionBorder = `1px solid ${C.border}`;

// ─── Shimmer ───

const SHIMMER_ID = 'zai-community-shimmer';
function ensureShimmer() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(SHIMMER_ID)) return;
  const s = document.createElement('style');
  s.id = SHIMMER_ID;
  s.textContent = `@keyframes zaiShimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}`;
  document.head.appendChild(s);
}

const shimmer: React.CSSProperties = {
  background: `linear-gradient(90deg, ${C.surface} 25%, ${C.surface2} 50%, ${C.surface} 75%)`,
  backgroundSize: '800px 100%',
  animation: 'zaiShimmer 1.6s infinite ease-in-out',
};

const Skel: React.FC<{ w?: string; h?: string; style?: React.CSSProperties }> = ({ w = '100%', h = '14px', style }) => (
  <div style={{ ...shimmer, width: w, height: h, ...style }} />
);

// ─── Helpers ───

function timeAgo(d: string) {
  if (!d) return 'Date unknown';
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

function fmtDate(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
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

function getWhatsAppLink(phone?: string, name?: string): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[^0-9+]/g, '');
  if (cleaned.length < 6) return null;
  const number = cleaned.startsWith('+') ? cleaned.slice(1) : cleaned;
  const text = encodeURIComponent(`Hi ${name || 'there'}, fellow zai community member here!`);
  return `https://wa.me/${number}?text=${text}`;
}

// ─── Label style used throughout ───

const label: React.CSSProperties = {
  fontSize: '10px',
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: C.muted,
  fontWeight: 500,
};

// ─── Component ───

const Community: React.FC = () => {
  const { user } = useAppContext();
  const [activeTab, setActiveTab] = useState<Tab>('feed');
  const [isAdmin, setIsAdmin] = useState(false);

  // Members
  const [members, setMembers] = useState<Member[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [stats, setStats] = useState<CommunityStats>({ totalMembers: 0, totalPhotos: 0 });

  // Gallery
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [newComment, setNewComment] = useState('');

  // Upload
  const [showUpload, setShowUpload] = useState(false);
  const [uploadCaption, setUploadCaption] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Emoji picker
  const [emojiPickerPhotoId, setEmojiPickerPhotoId] = useState<string | null>(null);
  const [emojiPickerPos, setEmojiPickerPos] = useState<{ top: number; left: number } | null>(null);
  const [emojiPickerContext, setEmojiPickerContext] = useState<'grid' | 'overlay'>('grid');

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { ensureShimmer(); }, []);

  // Close emoji picker on scroll
  useEffect(() => {
    const close = () => { setEmojiPickerPhotoId(null); setEmojiPickerPos(null); };
    window.addEventListener('scroll', close, true);
    return () => window.removeEventListener('scroll', close, true);
  }, []);

  // ─── Data fetching ───

  const fetchMembers = useCallback(async () => {
    try {
      const res = await apiService.get('/community/members', { params: { limit: 100, offset: 0 } });
      if (res.data?.success) {
        setMembers(res.data.data || []);
        if (res.data.isAdmin !== undefined) setIsAdmin(res.data.isAdmin);
      }
    } catch (err) { console.error('Error fetching members:', err); }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await apiService.get('/community/stats');
      if (res.data?.success) setStats(res.data.data);
    } catch (err) { console.error('Error fetching stats:', err); }
  }, []);

  const fetchPhotos = useCallback(async () => {
    try {
      const res = await apiService.get('/community/gallery', { params: { limit: 50, offset: 0 } });
      if (res.data?.success) {
        setPhotos(res.data.data || []);
        if (res.data.isAdmin !== undefined) setIsAdmin(res.data.isAdmin);
      }
    } catch (err) { console.error('Error fetching gallery:', err); }
  }, []);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await Promise.all([fetchMembers(), fetchStats(), fetchPhotos()]);
      setIsLoading(false);
    })();
  }, [fetchMembers, fetchStats, fetchPhotos]);

  // ─── Gallery actions ───

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/tiff'];
    if (!allowed.includes(file.type)) { alert('Only JPG, PNG, and TIFF images are allowed'); e.target.value = ''; return; }
    if (file.size > 4 * 1024 * 1024) { alert('Image must be under 4 MB'); return; }
    setUploadFile(file);
    const reader = new FileReader();
    reader.onload = () => setUploadPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!uploadFile || !uploadPreview) return;
    setUploading(true);
    try {
      const res = await apiService.post('/community/gallery', { image: uploadPreview, caption: uploadCaption });
      if (res.data?.success) {
        setPhotos(prev => [res.data.data, ...prev]);
        setShowUpload(false); setUploadCaption(''); setUploadFile(null); setUploadPreview(null);
        fetchStats();
      }
    } catch (err: any) { alert(err.response?.data?.error || 'Upload failed'); }
    finally { setUploading(false); }
  };

  const openPhoto = async (photoId: string) => {
    try {
      const res = await apiService.get(`/community/gallery/${photoId}`);
      if (res.data?.success) {
        setSelectedPhoto(res.data.data);
        if (res.data.isAdmin !== undefined) setIsAdmin(res.data.isAdmin);
      }
    } catch (err) { console.error('Error opening photo:', err); }
  };

  const addComment = async () => {
    if (!selectedPhoto || !newComment.trim()) return;
    try {
      const res = await apiService.post(`/community/gallery/${selectedPhoto.id}/comments`, { text: newComment });
      if (res.data?.success) {
        setSelectedPhoto(prev => prev ? {
          ...prev, commentCount: prev.commentCount + 1,
          comments: [...(prev.comments || []), res.data.data],
        } : null);
        setNewComment('');
      }
    } catch (err: any) { alert(err.response?.data?.error || 'Failed to add comment'); }
  };

  const deletePhoto = async (photoId: string) => {
    if (!confirm('Delete this photo?')) return;
    try {
      await apiService.delete(`/community/gallery/${photoId}`);
      setPhotos(prev => prev.filter(p => p.id !== photoId));
      setSelectedPhoto(null);
      fetchStats();
    } catch (err: any) { alert(err.response?.data?.error || 'Failed to delete'); }
  };

  const deleteComment = async (photoId: string, commentId: string) => {
    if (!confirm('Delete this comment?')) return;
    try {
      await apiService.delete(`/community/gallery/${photoId}/comments/${commentId}`);
      setSelectedPhoto(prev => prev ? {
        ...prev, commentCount: Math.max(prev.commentCount - 1, 0),
        comments: (prev.comments || []).filter(c => c.id !== commentId),
      } : null);
    } catch (err: any) { alert(err.response?.data?.error || 'Failed to delete comment'); }
  };

  // ─── Reactions ───

  const toggleReaction = async (photoId: string, emoji: string) => {
    try {
      const res = await apiService.post<ReactionResponse>(`/community/gallery/${photoId}/reactions`, { emoji });
      const body = res.data as unknown as ReactionResponse;
      if (body.success) {
        const action = body.action;
        const userName = user?.givenName || user?.name || 'Member';
        const patchReactions = (reactions: Reaction[]): Reaction[] => {
          if (action === 'added') return [...reactions, { emoji, userId: user?.id || '', userName }];
          const idx = reactions.findIndex(r => r.emoji === emoji && r.userId === user?.id);
          if (idx >= 0) { const copy = [...reactions]; copy.splice(idx, 1); return copy; }
          return reactions;
        };
        setPhotos(prev => prev.map(p => p.id === photoId ? { ...p, reactions: patchReactions(p.reactions || []) } : p));
        if (selectedPhoto?.id === photoId) {
          setSelectedPhoto(prev => prev ? { ...prev, reactions: patchReactions(prev.reactions || []) } : null);
        }
        setEmojiPickerPhotoId(null); setEmojiPickerPos(null);
      }
    } catch (err: any) { alert(err.response?.data?.error || 'Failed to react'); }
  };

  // ─── Admin: block / unblock ───

  const blockMember = async (memberId: string, memberName: string) => {
    const reason = prompt(`Block "${memberName}"? Enter a reason (optional):`);
    if (reason === null) return;
    try {
      await apiService.post(`/community/members/${memberId}/block`, { reason });
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, isBlocked: true } : m));
    } catch (err: any) { alert(err.response?.data?.error || 'Failed to block member'); }
  };

  const unblockMember = async (memberId: string) => {
    if (!confirm('Unblock this member?')) return;
    try {
      await apiService.delete(`/community/members/${memberId}/block`);
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, isBlocked: false } : m));
    } catch (err: any) { alert(err.response?.data?.error || 'Failed to unblock member'); }
  };

  // ─── Emoji picker ───

  const openEmojiPicker = (e: React.MouseEvent<HTMLButtonElement>, photoId: string, context: 'grid' | 'overlay') => {
    e.stopPropagation();
    if (emojiPickerPhotoId === photoId) { setEmojiPickerPhotoId(null); setEmojiPickerPos(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    setEmojiPickerPos({ top: rect.top, left: rect.right + 8 });
    setEmojiPickerPhotoId(photoId);
    setEmojiPickerContext(context);
  };

  // ─── ReactionBar (inline under each photo) ───

  const ReactionBar = ({ photo, overlay = false }: { photo: Photo; overlay?: boolean }) => {
    const grouped = groupReactions(photo.reactions || [], user?.id);
    const hasReactions = Object.keys(grouped).length > 0;
    const pickerOpen = emojiPickerPhotoId === photo.id;

    if (!overlay) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap', minHeight: '26px' }}>
          {hasReactions && Object.entries(grouped).map(([emoji, info]) => (
            <button key={emoji} onClick={e => { e.stopPropagation(); toggleReaction(photo.id, emoji); }}
              title={info.users.join(', ')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '3px',
                padding: '2px 7px', fontSize: '12px', lineHeight: 1,
                border: info.reacted ? `1px solid ${C.red}` : sectionBorder,
                background: info.reacted ? 'rgba(200,16,46,0.06)' : C.pureWhite,
                cursor: 'pointer', transition: 'all .15s',
              }}>
              <span>{emoji}</span>
              <span style={{ fontSize: '9px', fontWeight: 600, color: info.reacted ? C.red : C.muted }}>{info.count}</span>
            </button>
          ))}
          <button onClick={e => openEmojiPicker(e, photo.id, 'grid')}
            style={{
              marginLeft: 'auto', width: 26, height: 26,
              border: sectionBorder, background: pickerOpen ? C.surface : C.pureWhite,
              fontSize: '14px', color: C.muted, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            title="Add reaction">
            {pickerOpen ? '×' : '😊'}
          </button>
        </div>
      );
    }

    // overlay mode (inside photo detail)
    return (
      <div onClick={e => e.stopPropagation()}
        style={{ position: 'absolute', bottom: 12, left: 12, right: 12, display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap', zIndex: 5 }}>
        {hasReactions && Object.entries(grouped).map(([emoji, info]) => (
          <button key={emoji} onClick={e => { e.stopPropagation(); toggleReaction(photo.id, emoji); }}
            title={info.users.join(', ')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '3px',
              padding: '3px 9px', fontSize: '13px', lineHeight: 1,
              border: 'none',
              background: info.reacted ? 'rgba(200,16,46,0.85)' : 'rgba(0,0,0,0.5)',
              color: '#fff', cursor: 'pointer', backdropFilter: 'blur(8px)',
            }}>
            <span>{emoji}</span>
            <span style={{ fontSize: '10px', fontWeight: 600 }}>{info.count}</span>
          </button>
        ))}
        <button onClick={e => openEmojiPicker(e, photo.id, 'overlay')}
          style={{
            marginLeft: 'auto', width: 34, height: 34, border: 'none',
            background: pickerOpen ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.5)',
            color: pickerOpen ? C.gray : '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '16px', backdropFilter: 'blur(8px)',
          }}
          title="React">
          {pickerOpen ? '×' : '😊'}
        </button>
      </div>
    );
  };

  // ─── Filter members ───

  const filteredMembers = memberSearch
    ? members.filter(m =>
        m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
        (m.city && m.city.toLowerCase().includes(memberSearch.toLowerCase())) ||
        (m.country && m.country.toLowerCase().includes(memberSearch.toLowerCase()))
      )
    : members;

  // ═══════════════════════════════
  // LOADING SKELETON
  // ═══════════════════════════════

  if (isLoading) {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 40px 80px', fontFamily: "'Inter', sans-serif" }}>
        <Skel w="70px" h="10px" style={{ marginBottom: 10 }} />
        <Skel w="260px" h="36px" style={{ marginBottom: 8 }} />
        <Skel w="400px" h="13px" style={{ marginBottom: 32 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: C.border, border: sectionBorder, marginBottom: 32 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ background: C.pureWhite, padding: '24px' }}>
              <Skel w="40px" h="28px" style={{ marginBottom: 8 }} />
              <Skel w="80px" h="10px" />
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: C.border, border: sectionBorder }}>
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{ background: C.pureWhite }}>
              <div style={{ ...shimmer, width: '100%', height: 220 }} />
              <div style={{ padding: 14 }}>
                <Skel w="60%" h="12px" style={{ marginBottom: 6 }} />
                <Skel w="40%" h="10px" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 40px 80px', fontFamily: "'Inter', sans-serif", color: C.gray }}>

      {/* ═══════════ PAGE HEADER ═══════════ */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ ...label, color: C.red, letterSpacing: '0.3em' }}>ZAI ECOSYSTEM</span>
          {isAdmin && (
            <span style={{
              padding: '2px 8px', fontSize: '9px', letterSpacing: '0.15em',
              textTransform: 'uppercase', fontWeight: 600,
              background: 'rgba(200,16,46,0.08)', color: C.red,
              border: '1px solid rgba(200,16,46,0.2)',
            }}>
              Moderator
            </span>
          )}
        </div>
        <h1 style={{ fontSize: 'clamp(28px, 3.5vw, 42px)', fontWeight: 300, lineHeight: 1.1, margin: '0 0 6px', color: C.black }}>
          Community
        </h1>
        <p style={{ color: C.muted, fontSize: '14px', margin: 0, maxWidth: 500, fontWeight: 300 }}>
          A global family of zai owners — connected by the mountain.
        </p>
      </div>

      {/* ═══════════ STATS ROW ═══════════ */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px',
        background: C.border, border: sectionBorder, marginBottom: 32,
      }}>
        {[
          { val: stats.totalMembers, lbl: 'MEMBERS', icon: '●' },
          { val: stats.totalPhotos, lbl: 'PHOTOS SHARED', icon: '■' },
          { val: members.filter(m => !m.isBlocked).length, lbl: 'ACTIVE', icon: '▲' },
        ].map((s, i) => (
          <div key={i} style={{ background: C.pureWhite, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: '8px', color: i === 0 ? C.red : i === 1 ? C.muted : '#4caf7d' }}>{s.icon}</span>
            <div>
              <div style={{ fontSize: '22px', fontWeight: 300, lineHeight: 1, color: C.black }}>{s.val}</div>
              <div style={{ ...label, marginTop: 3 }}>{s.lbl}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ═══════════ TABS ═══════════ */}
      <div style={{ display: 'flex', gap: 0, borderBottom: sectionBorder, marginBottom: 32 }}>
        {(['feed', 'members'] as Tab[]).map(tab => {
          const active = activeTab === tab;
          return (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{
                padding: '12px 28px', fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase',
                background: 'transparent', border: 'none',
                borderBottom: active ? `2px solid ${C.red}` : '2px solid transparent',
                color: active ? C.black : C.muted,
                cursor: 'pointer', fontWeight: active ? 600 : 400,
                fontFamily: "'Inter', sans-serif", transition: 'all .2s',
              }}>
              {tab === 'feed' ? 'Upload & Share' : 'Members'}
            </button>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════ */}
      {/*  FEED / UPLOAD & SHARE                 */}
      {/* ═══════════════════════════════════════ */}
      {activeTab === 'feed' && (
        <div>

          {/* ── Upload trigger bar ── */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr auto', gap: '1px',
            background: C.border, border: sectionBorder, marginBottom: 32,
          }}>
            <div style={{ background: C.pureWhite, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.gray} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: C.black }}>Share a moment</div>
                <div style={{ fontSize: '11px', color: C.muted, marginTop: 1 }}>Upload a photo from your zai experience</div>
              </div>
            </div>
            <button onClick={() => setShowUpload(!showUpload)}
              style={{
                background: showUpload ? C.mid : C.black, color: C.white, border: 'none',
                padding: '0 32px', fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase',
                cursor: 'pointer', fontFamily: "'Inter', sans-serif", transition: 'background .2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = C.mid)}
              onMouseLeave={e => (e.currentTarget.style.background = showUpload ? C.mid : C.black)}>
              {showUpload ? 'Cancel' : '+ Upload'}
            </button>
          </div>

          {/* ── Upload form (expandable) ── */}
          {showUpload && (
            <div style={{
              border: sectionBorder, marginBottom: 32,
              display: 'grid', gridTemplateColumns: uploadPreview ? '1fr 1fr' : '1fr', gap: '1px',
              background: C.border,
            }}>
              <div style={{ background: C.pureWhite, padding: '24px' }}>
                {!uploadPreview ? (
                  <label style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: '48px 24px', border: `2px dashed ${C.border}`, cursor: 'pointer',
                    color: C.muted, fontSize: '13px', textAlign: 'center', transition: 'border-color .2s',
                  }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 14, opacity: 0.4 }}>
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                    Click to select an image
                    <span style={{ fontSize: '10px', marginTop: 4, color: C.muted }}>JPG, PNG, or TIFF · Max 4 MB</span>
                    <input type="file" accept="image/jpeg,image/png,image/tiff" onChange={handleFileChange} style={{ display: 'none' }} />
                  </label>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <img src={uploadPreview} alt="Preview" style={{ width: '100%', maxHeight: 300, objectFit: 'contain', display: 'block' }} />
                    <button onClick={() => { setUploadFile(null); setUploadPreview(null); }}
                      style={{
                        position: 'absolute', top: 8, right: 8,
                        background: 'rgba(10,10,10,0.7)', color: '#fff',
                        border: 'none', width: 28, height: 28, cursor: 'pointer', fontSize: '14px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>×</button>
                  </div>
                )}
              </div>
              {uploadPreview && (
                <div style={{ background: C.pureWhite, padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ ...label, marginBottom: 8 }}>CAPTION</div>
                    <textarea placeholder="Describe your moment..." value={uploadCaption}
                      onChange={e => setUploadCaption(e.target.value)} rows={4}
                      style={{
                        width: '100%', padding: '10px 12px', border: sectionBorder, fontSize: '13px',
                        boxSizing: 'border-box', fontFamily: "'Inter', sans-serif", resize: 'vertical',
                        background: C.pureWhite, color: C.black,
                      }} />
                  </div>
                  <div style={{ display: 'flex', gap: '1px', marginTop: 16 }}>
                    <button onClick={handleUpload} disabled={!uploadFile || uploading}
                      style={{
                        flex: 1, background: (!uploadFile || uploading) ? C.muted : C.black,
                        color: C.white, border: 'none', padding: '13px 28px',
                        fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase',
                        cursor: (!uploadFile || uploading) ? 'not-allowed' : 'pointer',
                        fontFamily: "'Inter', sans-serif", transition: 'background .2s',
                      }}>
                      {uploading ? 'Uploading to IPFS...' : 'Share'}
                    </button>
                    <button onClick={() => { setShowUpload(false); setUploadFile(null); setUploadPreview(null); setUploadCaption(''); }}
                      style={{
                        padding: '13px 28px', fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase',
                        background: C.surface, color: C.gray, border: sectionBorder,
                        cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                      }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Photo grid ── */}
          {photos.length === 0 ? (
            <div style={{ padding: '60px 24px', textAlign: 'center', background: C.surface, border: sectionBorder }}>
              <div style={{ fontSize: '48px', marginBottom: 16, opacity: 0.15 }}>📷</div>
              <div style={{ fontSize: '16px', fontWeight: 300, marginBottom: 6, color: C.black }}>No posts yet</div>
              <p style={{ color: C.muted, fontSize: '13px', margin: 0 }}>Be the first to share your zai moment!</p>
            </div>
          ) : (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '1px', background: C.border, border: sectionBorder,
            }}>
              {photos.map(photo => (
                <div key={photo.id} style={{ background: C.pureWhite, position: 'relative', transition: 'background .15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.surface)}
                  onMouseLeave={e => (e.currentTarget.style.background = C.pureWhite)}>

                  {/* Admin delete badge */}
                  {isAdmin && (
                    <button onClick={e => { e.stopPropagation(); deletePhoto(photo.id); }}
                      title="Delete photo (admin)"
                      style={{
                        position: 'absolute', top: 6, right: 6, zIndex: 5,
                        width: 24, height: 24, border: 'none',
                        background: 'rgba(200,16,46,0.85)', color: '#fff', fontSize: '13px',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: 0.6, transition: 'opacity .2s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}>×</button>
                  )}

                  {/* Image */}
                  <div onClick={() => openPhoto(photo.id)}
                    style={{ aspectRatio: '1', overflow: 'hidden', background: C.black, cursor: 'pointer' }}>
                    <img src={photo.url} alt={photo.caption}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform .3s' }}
                      onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.03)')}
                      onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')} />
                  </div>

                  {/* Meta */}
                  <div style={{ padding: '12px 14px' }}>
                    <div onClick={() => openPhoto(photo.id)} style={{ cursor: 'pointer' }}>
                      <div style={{ fontSize: '12px', fontWeight: 500, color: C.black, marginBottom: 3 }}>{photo.authorName}</div>
                      {photo.caption && (
                        <div style={{ fontSize: '11px', color: C.muted, marginBottom: 6, lineHeight: 1.45 }}>
                          {photo.caption.length > 60 ? photo.caption.slice(0, 60) + '…' : photo.caption}
                        </div>
                      )}
                    </div>
                    <div style={{ marginTop: 6, marginBottom: 6 }}>
                      <ReactionBar photo={photo} />
                    </div>
                    <div onClick={() => openPhoto(photo.id)}
                      style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: C.muted, cursor: 'pointer' }}>
                      <span>{photo.commentCount} comment{photo.commentCount !== 1 ? 's' : ''}</span>
                      <span>{timeAgo(photo.createdAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ═══ Photo detail modal ═══ */}
          {selectedPhoto && (
            <div style={{
              position: 'fixed', inset: 0,
              background: 'rgba(10,10,10,0.75)', backdropFilter: 'blur(6px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 1000, padding: '2rem',
            }}
              onClick={() => { setSelectedPhoto(null); setEmojiPickerPhotoId(null); setEmojiPickerPos(null); }}>
              <div onClick={e => e.stopPropagation()}
                style={{
                  background: C.white, maxWidth: 860, width: '100%', maxHeight: '90vh', overflow: 'visible',
                  display: 'grid', gridTemplateColumns: '1fr 340px',
                  boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
                }}>
                {/* Left — image */}
                <div style={{ background: C.black, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400, position: 'relative', overflow: 'visible' }}>
                  <img src={selectedPhoto.url} alt={selectedPhoto.caption} style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }} />
                  <ReactionBar photo={selectedPhoto} overlay />
                </div>

                {/* Right — info panel */}
                <div style={{ display: 'flex', flexDirection: 'column', borderLeft: sectionBorder, maxHeight: '90vh', overflow: 'hidden' }}>
                  {/* Author header */}
                  <div style={{ padding: '16px 18px', borderBottom: sectionBorder }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: C.black }}>{selectedPhoto.authorName}</div>
                        <div style={{ fontSize: '10px', color: C.muted, marginTop: 2 }}>{fmtDate(selectedPhoto.createdAt)}</div>
                      </div>
                      {(selectedPhoto.authorId === user?.id || isAdmin) && (
                        <button onClick={() => deletePhoto(selectedPhoto.id)}
                          style={{ background: 'none', border: 'none', fontSize: '11px', cursor: 'pointer', color: C.red, padding: '2px 6px' }}>
                          {isAdmin && selectedPhoto.authorId !== user?.id ? 'Remove (mod)' : 'Delete'}
                        </button>
                      )}
                    </div>
                    {selectedPhoto.caption && (
                      <p style={{ fontSize: '13px', color: C.gray, margin: '10px 0 0', lineHeight: 1.55, fontWeight: 300 }}>{selectedPhoto.caption}</p>
                    )}
                  </div>

                  {/* Comments */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
                    {(!selectedPhoto.comments || selectedPhoto.comments.length === 0) ? (
                      <p style={{ fontSize: '12px', color: C.muted, textAlign: 'center', marginTop: 24 }}>No comments yet</p>
                    ) : (
                      selectedPhoto.comments.map(c => (
                        <div key={c.id} style={{ marginBottom: 14 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: C.black }}>{c.authorName}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: '10px', color: C.muted }}>{timeAgo(c.createdAt)}</span>
                              {(c.authorId === user?.id || isAdmin) && (
                                <button onClick={() => deleteComment(selectedPhoto.id, c.id)}
                                  style={{ background: 'none', border: 'none', fontSize: '12px', cursor: 'pointer', color: C.red, padding: '0 4px' }}>×</button>
                              )}
                            </div>
                          </div>
                          <p style={{ fontSize: '12px', color: C.gray, margin: '3px 0 0', lineHeight: 1.5, fontWeight: 300 }}>{c.text}</p>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Comment input */}
                  <div style={{ padding: '14px 18px', borderTop: sectionBorder, display: 'flex', gap: '1px' }}>
                    <input type="text" placeholder="Add a comment..." value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addComment()}
                      style={{
                        flex: 1, padding: '10px 12px', border: sectionBorder, fontSize: '12px',
                        fontFamily: "'Inter', sans-serif", background: C.pureWhite, color: C.black,
                        outline: 'none',
                      }} />
                    <button onClick={addComment} disabled={!newComment.trim()}
                      style={{
                        padding: '10px 20px', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase',
                        background: newComment.trim() ? C.black : C.muted,
                        color: C.white, border: 'none', cursor: newComment.trim() ? 'pointer' : 'not-allowed',
                        fontFamily: "'Inter', sans-serif", fontWeight: 500,
                      }}>
                      Post
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/*  MEMBERS TAB                            */}
      {/* ═══════════════════════════════════════ */}
      {activeTab === 'members' && (
        <div>

          {/* ── Search bar ── */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr auto', gap: '1px',
            background: C.border, border: sectionBorder, marginBottom: '1px',
          }}>
            <div style={{ background: C.pureWhite, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input type="text" placeholder="Search members by name, city, or country..."
                value={memberSearch} onChange={e => setMemberSearch(e.target.value)}
                style={{
                  border: 'none', outline: 'none', fontSize: '13px', flex: 1,
                  fontFamily: "'Inter', sans-serif", background: 'transparent', color: C.black,
                }} />
            </div>
            <div style={{ background: C.surface, padding: '12px 20px', display: 'flex', alignItems: 'center' }}>
              <span style={{ ...label, fontSize: '10px' }}>{filteredMembers.length} of {stats.totalMembers}</span>
            </div>
          </div>

          {/* ── Member table ── */}
          <div style={{ display: 'grid', gap: '1px', background: C.border, border: sectionBorder, borderTop: 0 }}>
            {/* Header row */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isAdmin ? '2fr 1.2fr 1fr 120px 90px' : '2fr 1.2fr 1fr 120px',
              background: C.surface,
            }}>
              {['Member', 'Location', 'Since', 'Contact', ...(isAdmin ? ['Admin'] : [])].map(h => (
                <div key={h} style={{ ...label, padding: '11px 16px' }}>{h}</div>
              ))}
            </div>

            {/* Rows */}
            {filteredMembers.length === 0 ? (
              <div style={{ background: C.pureWhite, padding: '32px', textAlign: 'center', color: C.muted, fontSize: '13px' }}>
                {memberSearch ? 'No members match your search' : 'No members found'}
              </div>
            ) : (
              filteredMembers.map(m => (
                <div key={m.id} style={{
                  display: 'grid',
                  gridTemplateColumns: isAdmin ? '2fr 1.2fr 1fr 120px 90px' : '2fr 1.2fr 1fr 120px',
                  alignItems: 'center',
                  background: m.isBlocked ? 'rgba(200,16,46,0.02)' : C.pureWhite,
                  opacity: m.isBlocked ? 0.55 : 1,
                  transition: 'background .15s',
                }}
                  onMouseEnter={e => { if (!m.isBlocked) e.currentTarget.style.background = C.surface; }}
                  onMouseLeave={e => { e.currentTarget.style.background = m.isBlocked ? 'rgba(200,16,46,0.02)' : C.pureWhite; }}>

                  {/* Name + avatar */}
                  <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 30, height: 30, background: m.isBlocked ? C.muted : C.black,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '11px', color: C.white, flexShrink: 0, fontWeight: 500,
                    }}>
                      {m.avatar}
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 500, color: C.black }}>{m.name}</span>
                    {m.isBlocked && (
                      <span style={{
                        fontSize: '8px', padding: '1px 6px', letterSpacing: '0.12em', textTransform: 'uppercase',
                        background: 'rgba(200,16,46,0.08)', color: C.red, fontWeight: 600,
                      }}>blocked</span>
                    )}
                  </div>

                  {/* Location */}
                  <div style={{ padding: '12px 16px', fontSize: '11px', color: C.muted }}>
                    {m.city && m.country ? `${m.city}, ${m.country}` : m.country || m.city || '—'}
                  </div>

                  {/* Since */}
                  <div style={{ padding: '12px 16px', fontSize: '11px', color: C.muted }}>
                    {fmtDate(m.joinedAt)}
                  </div>

                  {/* Contact — WhatsApp */}
                  <div style={{ padding: '12px 16px' }}>
                    {(() => {
                      const waLink = getWhatsAppLink(m.phone, m.name);
                      if (!waLink) return <span style={{ fontSize: '10px', color: C.muted }}>—</span>;
                      return (
                        <a href={waLink} target="_blank" rel="noopener noreferrer"
                          title={`Message ${m.name} on WhatsApp`}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '4px 10px', background: '#25D366', color: '#fff',
                            fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase',
                            textDecoration: 'none', fontWeight: 500, transition: 'opacity .2s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.553 4.122 1.523 5.86L0 24l6.335-1.652A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.82c-1.977 0-3.865-.527-5.518-1.523l-.396-.234-3.763.982.998-3.648-.257-.41A9.794 9.794 0 012.18 12C2.18 6.583 6.583 2.18 12 2.18S21.82 6.583 21.82 12 17.417 21.82 12 21.82z"/>
                          </svg>
                          Chat
                        </a>
                      );
                    })()}
                  </div>

                  {/* Admin actions */}
                  {isAdmin && (
                    <div style={{ padding: '12px 16px' }}>
                      {m.isBlocked ? (
                        <button onClick={() => unblockMember(m.id)}
                          style={{
                            padding: '4px 10px', fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase',
                            background: C.surface, color: C.gray, border: sectionBorder,
                            cursor: 'pointer', fontFamily: "'Inter', sans-serif", fontWeight: 500,
                          }}>
                          Unblock
                        </button>
                      ) : (
                        <button onClick={() => blockMember(m.id, m.name)}
                          style={{
                            padding: '4px 10px', fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase',
                            background: 'rgba(200,16,46,0.06)', color: C.red, border: '1px solid rgba(200,16,46,0.15)',
                            cursor: 'pointer', fontFamily: "'Inter', sans-serif", fontWeight: 500,
                          }}>
                          Block
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* ── WhatsApp community link bar ── */}
          <div style={{
            marginTop: '1px',
            display: 'grid', gridTemplateColumns: '1fr auto', gap: '1px',
            background: C.border, border: sectionBorder, borderTop: 0,
          }}>
            <div style={{ background: C.black, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#25D366">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.553 4.122 1.523 5.86L0 24l6.335-1.652A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.82c-1.977 0-3.865-.527-5.518-1.523l-.396-.234-3.763.982.998-3.648-.257-.41A9.794 9.794 0 012.18 12C2.18 6.583 6.583 2.18 12 2.18S21.82 6.583 21.82 12 17.417 21.82 12 21.82z"/>
              </svg>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: C.white }}>Join the zai WhatsApp community</div>
                <div style={{ fontSize: '11px', color: C.muted, marginTop: 2 }}>Connect with members, share tips, and stay updated</div>
              </div>
            </div>
            <a href="https://chat.whatsapp.com/YOUR_GROUP_INVITE_LINK" target="_blank" rel="noopener noreferrer"
              style={{
                background: '#25D366', color: '#fff', border: 'none',
                padding: '0 32px', fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase',
                textDecoration: 'none', fontFamily: "'Inter', sans-serif", fontWeight: 500,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'opacity .2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
              Join Group
            </a>
          </div>
        </div>
      )}

      {/* ═══════════ EMOJI PICKER PORTAL ═══════════ */}
      {emojiPickerPhotoId && emojiPickerPos && (
        <div style={{
          position: 'fixed',
          top: Math.min(emojiPickerPos.top, window.innerHeight - 260),
          left: Math.min(emojiPickerPos.left, window.innerWidth - 220),
          zIndex: 2000,
          background: emojiPickerContext === 'overlay' ? 'rgba(10,10,10,0.92)' : C.pureWhite,
          border: emojiPickerContext === 'overlay' ? '1px solid rgba(255,255,255,0.1)' : sectionBorder,
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
          padding: '12px',
          display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px',
          width: 210,
        }}
          onClick={e => e.stopPropagation()}>
          {REACTION_EMOJIS.map(emoji => (
            <button key={emoji} onClick={() => toggleReaction(emojiPickerPhotoId!, emoji)}
              style={{
                width: 30, height: 30, border: 'none',
                background: 'transparent', fontSize: '16px',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'transform .1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.25)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
              {emoji}
            </button>
          ))}
        </div>
      )}

    </div>
  );
};

export default Community;
