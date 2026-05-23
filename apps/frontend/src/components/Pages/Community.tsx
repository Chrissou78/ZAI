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

// ─── Constants ───

const REACTION_EMOJIS = [
  '❤️','🔥','👏','🤩','😍','🙌',
  '⛷️','🏔️','🎿','🏂','❄️','🌨️',
  '💪','🥇','🏆','⭐','💎','👌',
  '😂','🫶','🙏','🎉','💯','🚀',
];

/* ── Design tokens from HTML ── */
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
  surface:    '#f0ede6',
  surface2:   '#e8e5de',
  pureWhite:  '#ffffff',
};

const bdr = `1px solid ${C.border}`;
const bdrDark = `1px solid ${C.borderDark}`;

/* ── Shimmer ── */
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
  background: `linear-gradient(90deg,${C.surface} 25%,${C.surface2} 50%,${C.surface} 75%)`,
  backgroundSize: '800px 100%', animation: 'zaiShimmer 1.6s infinite ease-in-out',
};
const Sk: React.FC<{w?:string;h?:string;s?:React.CSSProperties}> = ({w='100%',h='14px',s}) =>
  <div style={{...shimmer,width:w,height:h,...s}} />;

/* ── Helpers ── */

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
  return new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
}

function fmtDate(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
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

const lbl: React.CSSProperties = {
  fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase',
  color: C.muted, fontWeight: 500,
};

// ═══════════════════════════════════════════
//  COMPONENT
// ═══════════════════════════════════════════

const Community: React.FC = () => {
  const { user } = useAppContext();
  const [isAdmin, setIsAdmin] = useState(false);

  /* Members */
  const [members, setMembers] = useState<Member[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [stats, setStats] = useState<CommunityStats>({ totalMembers: 0, totalPhotos: 0 });

  /* Gallery */
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [newComment, setNewComment] = useState('');

  /* Upload */
  const [showUpload, setShowUpload] = useState(false);
  const [uploadCaption, setUploadCaption] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  /* Emoji */
  const [emojiPickerPhotoId, setEmojiPickerPhotoId] = useState<string | null>(null);
  const [emojiPickerPos, setEmojiPickerPos] = useState<{top:number;left:number}|null>(null);

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { ensureShimmer(); }, []);

  useEffect(() => {
    const close = () => { setEmojiPickerPhotoId(null); setEmojiPickerPos(null); };
    window.addEventListener('scroll', close, true);
    return () => window.removeEventListener('scroll', close, true);
  }, []);

  // ─── Fetch ───

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
    const allowed = ['image/jpeg','image/png','image/tiff'];
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
      setSelectedPhoto(null); fetchStats();
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
        const patch = (rr: Reaction[]): Reaction[] => {
          if (action === 'added') return [...rr, { emoji, userId: user?.id || '', userName }];
          const idx = rr.findIndex(r => r.emoji === emoji && r.userId === user?.id);
          if (idx >= 0) { const c = [...rr]; c.splice(idx, 1); return c; }
          return rr;
        };
        setPhotos(prev => prev.map(p => p.id === photoId ? { ...p, reactions: patch(p.reactions || []) } : p));
        if (selectedPhoto?.id === photoId) setSelectedPhoto(prev => prev ? { ...prev, reactions: patch(prev.reactions || []) } : null);
        setEmojiPickerPhotoId(null); setEmojiPickerPos(null);
      }
    } catch (err: any) { alert(err.response?.data?.error || 'Failed to react'); }
  };

  // ─── Admin ───

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

  const openEmojiPicker = (e: React.MouseEvent<HTMLButtonElement>, photoId: string) => {
    e.stopPropagation();
    if (emojiPickerPhotoId === photoId) { setEmojiPickerPhotoId(null); setEmojiPickerPos(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    setEmojiPickerPos({ top: rect.bottom + 4, left: rect.left });
    setEmojiPickerPhotoId(photoId);
  };

  // ─── Filtered members ───

  const filteredMembers = memberSearch
    ? members.filter(m =>
        m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
        (m.city && m.city.toLowerCase().includes(memberSearch.toLowerCase())) ||
        (m.country && m.country.toLowerCase().includes(memberSearch.toLowerCase()))
      )
    : members;

  // ─── ReactionBar ───

  const ReactionBar = ({ photo }: { photo: Photo }) => {
    const grouped = groupReactions(photo.reactions || [], user?.id);
    const hasReactions = Object.keys(grouped).length > 0;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', minHeight: 24 }}>
        {hasReactions && Object.entries(grouped).map(([emoji, info]) => (
          <button key={emoji} onClick={e => { e.stopPropagation(); toggleReaction(photo.id, emoji); }}
            title={info.users.join(', ')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '2px 6px', fontSize: '12px', lineHeight: 1,
              border: info.reacted ? `1px solid ${C.red}` : bdr,
              background: info.reacted ? 'rgba(200,16,46,0.06)' : C.pureWhite,
              cursor: 'pointer',
            }}>
            <span>{emoji}</span>
            <span style={{ fontSize: '9px', fontWeight: 600, color: info.reacted ? C.red : C.muted }}>{info.count}</span>
          </button>
        ))}
        <button onClick={e => openEmojiPicker(e, photo.id)}
          style={{
            marginLeft: 'auto', width: 24, height: 24, border: bdr,
            background: emojiPickerPhotoId === photo.id ? C.surface : C.pureWhite,
            fontSize: '13px', color: C.muted, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          title="Add reaction">
          {emojiPickerPhotoId === photo.id ? '×' : '😊'}
        </button>
      </div>
    );
  };

  // ═══════════════════════════════════════════
  //  LOADING SKELETON
  // ═══════════════════════════════════════════

  if (isLoading) {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 40px 80px', fontFamily: "'Inter',sans-serif" }}>
        <Sk w="80px" h="10px" s={{ marginBottom: 10 }} />
        <Sk w="200px" h="32px" s={{ marginBottom: 28 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 1, background: C.border }}>
          <div style={{ background: C.pureWhite, padding: 20 }}>
            {[0,1,2,3,4,5].map(i => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
                <Sk w="32px" h="32px" />
                <div style={{ flex: 1 }}><Sk w="70%" h="12px" s={{ marginBottom: 4 }} /><Sk w="50%" h="10px" /></div>
              </div>
            ))}
          </div>
          <div style={{ background: C.pureWhite, padding: 20 }}>
            {[0,1,2].map(i => (
              <div key={i} style={{ marginBottom: 20 }}>
                <Sk w="100%" h="240px" s={{ marginBottom: 10 }} />
                <Sk w="60%" h="12px" s={{ marginBottom: 4 }} />
                <Sk w="40%" h="10px" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════
  //  MAIN RENDER
  // ═══════════════════════════════════════════

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 40px 80px', fontFamily: "'Inter',sans-serif", color: C.gray }}>

      {/* ══════ PAGE HEADER ══════ */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ ...lbl, color: C.red, letterSpacing: '0.3em' }}>ZAI COMMUNITY</span>
          {isAdmin && (
            <span style={{
              padding: '2px 8px', fontSize: '9px', letterSpacing: '0.15em',
              textTransform: 'uppercase', fontWeight: 600,
              background: 'rgba(200,16,46,0.08)', color: C.red,
              border: '1px solid rgba(200,16,46,0.15)',
            }}>Moderator</span>
          )}
        </div>
        <h1 style={{ fontSize: 'clamp(26px,3.5vw,40px)', fontWeight: 300, lineHeight: 1.1, margin: 0, color: C.black }}>
          Community
        </h1>
      </div>

      {/* ══════ TWO-COLUMN LAYOUT: Members left, Feed right ══════ */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '300px 1fr',
        gap: '1px',
        background: C.border,
        border: bdr,
      }}>

        {/* ────────────────────────────────────
            LEFT COLUMN — MEMBERS
        ──────────────────────────────────── */}
        <div style={{ background: C.pureWhite, display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 180px)' }}>

          {/* Members header */}
          <div style={{ padding: '16px 18px', borderBottom: bdr }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ ...lbl }}>MEMBERS</span>
              <span style={{ fontSize: '11px', color: C.muted }}>{stats.totalMembers}</span>
            </div>
            {/* Search */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: bdr, background: C.surface }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input type="text" placeholder="Search..." value={memberSearch} onChange={e => setMemberSearch(e.target.value)}
                style={{ border: 'none', outline: 'none', fontSize: '12px', flex: 1, fontFamily: "'Inter',sans-serif", background: 'transparent', color: C.black }} />
            </div>
          </div>

          {/* Member list — scrollable */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filteredMembers.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', fontSize: '12px', color: C.muted }}>
                {memberSearch ? 'No members found' : 'No members yet'}
              </div>
            ) : (
              filteredMembers.map(m => {
                const waLink = getWhatsAppLink(m.phone, m.name);
                return (
                  <div key={m.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 18px', borderBottom: bdr,
                    opacity: m.isBlocked ? 0.45 : 1,
                    transition: 'background .15s', cursor: 'default',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = C.surface)}
                    onMouseLeave={e => (e.currentTarget.style.background = C.pureWhite)}>

                    {/* Avatar */}
                    <div style={{
                      width: 32, height: 32, flexShrink: 0,
                      background: m.isBlocked ? C.muted : C.black,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '11px', color: C.white, fontWeight: 500,
                    }}>
                      {m.avatar}
                    </div>

                    {/* Name + location */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: 500, color: C.black, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                        {m.isBlocked && (
                          <span style={{ fontSize: '8px', padding: '1px 5px', background: 'rgba(200,16,46,0.08)', color: C.red, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', flexShrink: 0 }}>blocked</span>
                        )}
                      </div>
                      <div style={{ fontSize: '10px', color: C.muted, marginTop: 1 }}>
                        {m.city && m.country ? `${m.city}, ${m.country}` : m.country || m.city || fmtDate(m.joinedAt)}
                      </div>
                    </div>

                    {/* WhatsApp button */}
                    {waLink && !m.isBlocked && (
                      <a href={waLink} target="_blank" rel="noopener noreferrer" title={`WhatsApp ${m.name}`}
                        style={{
                          width: 28, height: 28, flexShrink: 0,
                          background: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'opacity .2s', textDecoration: 'none',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.553 4.122 1.523 5.86L0 24l6.335-1.652A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.82c-1.977 0-3.865-.527-5.518-1.523l-.396-.234-3.763.982.998-3.648-.257-.41A9.794 9.794 0 012.18 12C2.18 6.583 6.583 2.18 12 2.18S21.82 6.583 21.82 12 17.417 21.82 12 21.82z"/>
                        </svg>
                      </a>
                    )}

                    {/* Admin block/unblock */}
                    {isAdmin && (
                      m.isBlocked ? (
                        <button onClick={() => unblockMember(m.id)}
                          style={{ fontSize: '9px', padding: '3px 7px', background: C.surface, color: C.gray, border: bdr, cursor: 'pointer', fontFamily: "'Inter',sans-serif", letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                          Unblock
                        </button>
                      ) : (
                        <button onClick={() => blockMember(m.id, m.name)}
                          style={{ fontSize: '9px', padding: '3px 7px', background: 'rgba(200,16,46,0.06)', color: C.red, border: '1px solid rgba(200,16,46,0.12)', cursor: 'pointer', fontFamily: "'Inter',sans-serif", letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                          Block
                        </button>
                      )
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* WhatsApp group link — bottom of members panel */}
          <a href="https://chat.whatsapp.com/YOUR_GROUP_INVITE_LINK" target="_blank" rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '14px 18px', borderTop: bdr,
              background: C.black, color: C.white, textDecoration: 'none',
              transition: 'background .2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = C.mid)}
            onMouseLeave={e => (e.currentTarget.style.background = C.black)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#25D366">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.553 4.122 1.523 5.86L0 24l6.335-1.652A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.82c-1.977 0-3.865-.527-5.518-1.523l-.396-.234-3.763.982.998-3.648-.257-.41A9.794 9.794 0 012.18 12C2.18 6.583 6.583 2.18 12 2.18S21.82 6.583 21.82 12 17.417 21.82 12 21.82z"/>
            </svg>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 500 }}>Join WhatsApp Group</div>
              <div style={{ fontSize: '9px', color: C.muted, marginTop: 1 }}>Connect with all members</div>
            </div>
          </a>
        </div>

        {/* ────────────────────────────────────
            RIGHT COLUMN — UPLOAD & SHARE (vertical feed)
        ──────────────────────────────────── */}
        <div style={{ background: C.surface, display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 180px)' }}>

          {/* Feed header + upload button */}
          <div style={{ padding: '16px 20px', borderBottom: bdr, background: C.pureWhite, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ ...lbl }}>UPLOAD & SHARE</span>
              <div style={{ fontSize: '11px', color: C.muted, marginTop: 3 }}>{stats.totalPhotos} photo{stats.totalPhotos !== 1 ? 's' : ''} shared</div>
            </div>
            <button onClick={() => setShowUpload(!showUpload)}
              style={{
                padding: '8px 20px', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase',
                background: showUpload ? C.muted : C.black, color: C.white, border: 'none',
                cursor: 'pointer', fontFamily: "'Inter',sans-serif", fontWeight: 500,
                transition: 'background .2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = C.mid)}
              onMouseLeave={e => (e.currentTarget.style.background = showUpload ? C.muted : C.black)}>
              {showUpload ? 'Cancel' : '+ Upload'}
            </button>
          </div>

          {/* Upload form — vertical layout */}
          {showUpload && (
            <div style={{ borderBottom: bdr, background: C.pureWhite }}>
              {/* Image selector */}
              <div style={{ padding: '20px' }}>
                {!uploadPreview ? (
                  <label style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: '36px 20px', border: `2px dashed ${C.border}`, cursor: 'pointer',
                    color: C.muted, fontSize: '12px', textAlign: 'center',
                  }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 10, opacity: 0.4 }}>
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                    Click to select an image
                    <span style={{ fontSize: '10px', marginTop: 3, color: C.muted }}>JPG, PNG, or TIFF · Max 4 MB</span>
                    <input type="file" accept="image/jpeg,image/png,image/tiff" onChange={handleFileChange} style={{ display: 'none' }} />
                  </label>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <img src={uploadPreview} alt="Preview" style={{ width: '100%', maxHeight: 280, objectFit: 'contain', display: 'block', background: C.black }} />
                    <button onClick={() => { setUploadFile(null); setUploadPreview(null); }}
                      style={{
                        position: 'absolute', top: 6, right: 6,
                        background: 'rgba(10,10,10,0.7)', color: '#fff',
                        border: 'none', width: 26, height: 26, cursor: 'pointer', fontSize: '13px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>×</button>
                  </div>
                )}
              </div>

              {/* Caption + submit — stacked vertically below image */}
              {uploadPreview && (
                <div style={{ padding: '0 20px 20px' }}>
                  <div style={{ ...lbl, marginBottom: 6 }}>CAPTION</div>
                  <textarea placeholder="Describe your moment..." value={uploadCaption}
                    onChange={e => setUploadCaption(e.target.value)} rows={3}
                    style={{
                      width: '100%', padding: '10px 12px', border: bdr, fontSize: '12px',
                      boxSizing: 'border-box', fontFamily: "'Inter',sans-serif", resize: 'vertical',
                      background: C.pureWhite, color: C.black, marginBottom: 12,
                    }} />
                  <div style={{ display: 'flex', gap: '1px' }}>
                    <button onClick={handleUpload} disabled={!uploadFile || uploading}
                      style={{
                        flex: 1, background: (!uploadFile || uploading) ? C.muted : C.black,
                        color: C.white, border: 'none', padding: '12px',
                        fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase',
                        cursor: (!uploadFile || uploading) ? 'not-allowed' : 'pointer',
                        fontFamily: "'Inter',sans-serif",
                      }}>
                      {uploading ? 'Uploading...' : 'Share Photo'}
                    </button>
                    <button onClick={() => { setShowUpload(false); setUploadFile(null); setUploadPreview(null); setUploadCaption(''); }}
                      style={{
                        padding: '12px 20px', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase',
                        background: C.surface, color: C.gray, border: bdr,
                        cursor: 'pointer', fontFamily: "'Inter',sans-serif",
                      }}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Vertical photo feed — scrollable ── */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 0 }}>
            {photos.length === 0 ? (
              <div style={{ padding: '60px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: '40px', marginBottom: 12, opacity: 0.15 }}>📷</div>
                <div style={{ fontSize: '14px', fontWeight: 300, color: C.black, marginBottom: 4 }}>No posts yet</div>
                <p style={{ color: C.muted, fontSize: '12px', margin: 0 }}>Be the first to share your zai moment!</p>
              </div>
            ) : (
              photos.map(photo => (
                <div key={photo.id} style={{ background: C.pureWhite, borderBottom: bdr }}>

                  {/* Author bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', borderBottom: bdr }}>
                    <div style={{
                      width: 28, height: 28, background: C.black, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '10px', color: C.white, fontWeight: 500, flexShrink: 0,
                    }}>
                      {(photo.authorName?.charAt(0) || 'M').toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12px', fontWeight: 500, color: C.black }}>{photo.authorName}</div>
                      <div style={{ fontSize: '10px', color: C.muted }}>{timeAgo(photo.createdAt)}</div>
                    </div>
                    {isAdmin && (
                      <button onClick={() => deletePhoto(photo.id)} title="Delete (admin)"
                        style={{ background: 'none', border: 'none', fontSize: '11px', color: C.red, cursor: 'pointer', padding: '2px 6px' }}>×</button>
                    )}
                  </div>

                  {/* Image — full width, vertical */}
                  <div onClick={() => openPhoto(photo.id)} style={{ cursor: 'pointer', background: C.black }}>
                    <img src={photo.url} alt={photo.caption}
                      style={{ width: '100%', maxHeight: 500, objectFit: 'contain', display: 'block' }} />
                  </div>

                  {/* Caption + reactions + comments count */}
                  <div style={{ padding: '12px 20px' }}>
                    {photo.caption && (
                      <p style={{ fontSize: '12px', color: C.gray, margin: '0 0 10px', lineHeight: 1.5, fontWeight: 300 }}>{photo.caption}</p>
                    )}
                    <ReactionBar photo={photo} />
                    <div onClick={() => openPhoto(photo.id)}
                      style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: C.muted, marginTop: 8, cursor: 'pointer' }}>
                      <span>{photo.commentCount} comment{photo.commentCount !== 1 ? 's' : ''}</span>
                      <span>View details →</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ══════ PHOTO DETAIL MODAL ══════ */}
      {selectedPhoto && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(10,10,10,0.8)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '2rem',
        }}
          onClick={() => { setSelectedPhoto(null); setEmojiPickerPhotoId(null); setEmojiPickerPos(null); }}>
          <div onClick={e => e.stopPropagation()}
            style={{
              background: C.white, maxWidth: 800, width: '100%', maxHeight: '90vh',
              display: 'grid', gridTemplateColumns: '1fr 320px',
              boxShadow: '0 24px 80px rgba(0,0,0,0.5)', overflow: 'hidden',
            }}>

            {/* Left — image */}
            <div style={{ background: C.black, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 380 }}>
              <img src={selectedPhoto.url} alt={selectedPhoto.caption} style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain' }} />
            </div>

            {/* Right — info */}
            <div style={{ display: 'flex', flexDirection: 'column', borderLeft: bdr, maxHeight: '90vh' }}>

              {/* Author */}
              <div style={{ padding: '16px 18px', borderBottom: bdr }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: C.black }}>{selectedPhoto.authorName}</div>
                    <div style={{ fontSize: '10px', color: C.muted, marginTop: 2 }}>{fmtDate(selectedPhoto.createdAt)}</div>
                  </div>
                  {(selectedPhoto.authorId === user?.id || isAdmin) && (
                    <button onClick={() => deletePhoto(selectedPhoto.id)}
                      style={{ background: 'none', border: 'none', fontSize: '11px', cursor: 'pointer', color: C.red }}>
                      {isAdmin && selectedPhoto.authorId !== user?.id ? 'Remove' : 'Delete'}
                    </button>
                  )}
                </div>
                {selectedPhoto.caption && (
                  <p style={{ fontSize: '12px', color: C.gray, margin: '10px 0 0', lineHeight: 1.5, fontWeight: 300 }}>{selectedPhoto.caption}</p>
                )}
                <div style={{ marginTop: 12 }}>
                  <ReactionBar photo={selectedPhoto} />
                </div>
              </div>

              {/* Comments */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>
                {(!selectedPhoto.comments || selectedPhoto.comments.length === 0) ? (
                  <p style={{ fontSize: '11px', color: C.muted, textAlign: 'center', marginTop: 20 }}>No comments yet</p>
                ) : (
                  selectedPhoto.comments.map(c => (
                    <div key={c.id} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: C.black }}>{c.authorName}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: '9px', color: C.muted }}>{timeAgo(c.createdAt)}</span>
                          {(c.authorId === user?.id || isAdmin) && (
                            <button onClick={() => deleteComment(selectedPhoto.id, c.id)}
                              style={{ background: 'none', border: 'none', fontSize: '11px', cursor: 'pointer', color: C.red }}>×</button>
                          )}
                        </div>
                      </div>
                      <p style={{ fontSize: '11px', color: C.gray, margin: '2px 0 0', lineHeight: 1.5, fontWeight: 300 }}>{c.text}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Comment input */}
              <div style={{ padding: '12px 18px', borderTop: bdr, display: 'flex', gap: '1px' }}>
                <input type="text" placeholder="Add a comment..." value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addComment()}
                  style={{ flex: 1, padding: '9px 10px', border: bdr, fontSize: '11px', fontFamily: "'Inter',sans-serif", background: C.pureWhite, color: C.black, outline: 'none' }} />
                <button onClick={addComment} disabled={!newComment.trim()}
                  style={{
                    padding: '9px 16px', fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase',
                    background: newComment.trim() ? C.black : C.muted,
                    color: C.white, border: 'none', cursor: newComment.trim() ? 'pointer' : 'not-allowed',
                    fontFamily: "'Inter',sans-serif", fontWeight: 500,
                  }}>Post</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════ EMOJI PICKER PORTAL ══════ */}
      {emojiPickerPhotoId && emojiPickerPos && (
        <div style={{
          position: 'fixed',
          top: Math.min(emojiPickerPos.top, window.innerHeight - 240),
          left: Math.min(emojiPickerPos.left, window.innerWidth - 220),
          zIndex: 2000,
          background: C.pureWhite, border: bdr,
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          padding: 10,
          display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 3,
          width: 200,
        }}
          onClick={e => e.stopPropagation()}>
          {REACTION_EMOJIS.map(emoji => (
            <button key={emoji} onClick={() => toggleReaction(emojiPickerPhotoId!, emoji)}
              style={{
                width: 28, height: 28, border: 'none', background: 'transparent',
                fontSize: '15px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'transform .1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.3)')}
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
