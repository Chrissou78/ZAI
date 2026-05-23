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

interface Reaction { emoji: string; userId: string; userName: string; }

interface Photo {
  id: string; cid: string; url: string; caption: string;
  authorId: string; authorName: string; commentCount: number;
  createdAt: string; comments?: Comment[]; reactions?: Reaction[];
}

interface Comment {
  id: string; text: string; authorId: string; authorName: string; createdAt: string;
}

interface CommunityStats { totalMembers: number; totalPhotos: number; }

interface ReactionResponse {
  success: boolean; action: 'added' | 'removed'; emoji: string; data?: Reaction;
}

// ─── Constants ───

const REACTION_EMOJIS = [
  '❤️','🔥','👏','🤩','😍','🙌','⛷️','🏔️','🎿','🏂','❄️','🌨️',
  '💪','🥇','🏆','⭐','💎','👌','😂','🫶','🙏','🎉','💯','🚀',
];

const MEMBER_DOT_COLORS = ['#c8102e','#2563eb','#f59e0b','#10b981','#8b5cf6','#ec4899','#06b6d4','#f97316'];

// ─── Design tokens from HTML ───

const C = {
  black: '#0a0a0a',  white: '#f5f4f0',  red: '#c8102e',  burgundy: '#7D1E2C',
  gray: '#1a1a1a',   mid: '#2e2e2e',    muted: '#6a6a6a', border: '#e0ddd6',
  borderDark: '#2a2a2a', surface: '#f0ede6', surface2: '#e8e5de', pureWhite: '#ffffff',
  green: '#25D366',
};

const bdr = `1px solid ${C.border}`;

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
  background: `linear-gradient(90deg,${C.surface} 25%,${C.surface2} 50%,${C.surface} 75%)`,
  backgroundSize: '800px 100%', animation: 'zaiShimmer 1.6s infinite ease-in-out',
};
const Sk: React.FC<{w?:string;h?:string;s?:React.CSSProperties}> = ({w='100%',h='14px',s}) =>
  <div style={{...shimmer,width:w,height:h,...s}} />;

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
  return new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
}

function fmtDate(d: string) {
  if (!d) return '—';
  const dt = new Date(d);
  const mon = dt.toLocaleString('en-US',{month:'short'});
  return `${mon} ${dt.getFullYear()}`;
}

function fmtFullDate(d: string) {
  if (!d) return '';
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

function getMemberDotColor(index: number) {
  return MEMBER_DOT_COLORS[index % MEMBER_DOT_COLORS.length];
}

function getMemberLocation(m: Member) {
  if (m.city && m.country) return `${m.city}, ${m.country?.slice(0,2).toUpperCase()}`;
  if (m.city) return m.city;
  if (m.country) return m.country;
  return '—';
}

const lbl: React.CSSProperties = {
  fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase',
  color: C.muted, fontWeight: 500,
};

// ═══════════════════════════════════
//  COMPONENT
// ═══════════════════════════════════

const Community: React.FC = () => {
  const { user } = useAppContext();
  const [isAdmin, setIsAdmin] = useState(false);

  const [members, setMembers] = useState<Member[]>([]);
  const [memberPage, setMemberPage] = useState(0);
  const MEMBERS_PER_PAGE = 10;
  const [stats, setStats] = useState<CommunityStats>({ totalMembers: 0, totalPhotos: 0 });

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [newComment, setNewComment] = useState('');

  const [showUpload, setShowUpload] = useState(false);
  const [uploadCaption, setUploadCaption] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

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

  const openEmojiPicker = (e: React.MouseEvent<HTMLButtonElement>, photoId: string) => {
    e.stopPropagation();
    if (emojiPickerPhotoId === photoId) { setEmojiPickerPhotoId(null); setEmojiPickerPos(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    setEmojiPickerPos({ top: rect.bottom + 4, left: rect.left });
    setEmojiPickerPhotoId(photoId);
  };

  // ─── Paginated members ───

  const visibleMembers = members.slice(0, (memberPage + 1) * MEMBERS_PER_PAGE);
  const showingCount = visibleMembers.length;
  const totalCount = stats.totalMembers || members.length;

  // ─── ReactionBar ───

  const ReactionBar = ({ photo }: { photo: Photo }) => {
    const grouped = groupReactions(photo.reactions || [], user?.id);
    const hasReactions = Object.keys(grouped).length > 0;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        {hasReactions && Object.entries(grouped).map(([emoji, info]) => (
          <button key={emoji} onClick={e => { e.stopPropagation(); toggleReaction(photo.id, emoji); }}
            title={info.users.join(', ')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '3px 8px', fontSize: '13px', lineHeight: 1,
              border: info.reacted ? `1px solid ${C.red}` : bdr,
              background: info.reacted ? 'rgba(200,16,46,0.06)' : C.pureWhite,
              cursor: 'pointer',
            }}>
            <span>{emoji}</span>
            <span style={{ fontSize: '10px', fontWeight: 600, color: info.reacted ? C.red : C.muted }}>{info.count}</span>
          </button>
        ))}
        <button onClick={e => openEmojiPicker(e, photo.id)}
          style={{
            marginLeft: hasReactions ? 4 : 0, width: 28, height: 28, border: bdr,
            background: emojiPickerPhotoId === photo.id ? C.surface : C.pureWhite,
            fontSize: '14px', color: C.muted, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          title="Add reaction">
          {emojiPickerPhotoId === photo.id ? '×' : '😊'}
        </button>
      </div>
    );
  };

  // ═══════════════════════════════
  //  LOADING SKELETON
  // ═══════════════════════════════

  if (isLoading) {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 40px 80px', fontFamily: "'Inter',sans-serif" }}>
        <Sk w="90px" h="10px" s={{ marginBottom: 10 }} />
        <Sk w="240px" h="38px" s={{ marginBottom: 8 }} />
        <Sk w="380px" h="13px" s={{ marginBottom: 36 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
          <div>
            <Sk w="140px" h="10px" s={{ marginBottom: 16 }} />
            {[0,1,2,3,4].map(i => <Sk key={i} w="100%" h="36px" s={{ marginBottom: 1 }} />)}
          </div>
          <div>
            <Sk w="100%" h="160px" s={{ marginBottom: 16 }} />
            <Sk w="100%" h="140px" />
          </div>
        </div>
        <Sk w="180px" h="10px" s={{ marginTop: 40, marginBottom: 20 }} />
        {[0,1].map(i => <Sk key={i} w="100%" h="340px" s={{ marginBottom: 20 }} />)}
      </div>
    );
  }

  // ═══════════════════════════════
  //  MAIN RENDER
  // ═══════════════════════════════

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 40px 80px', fontFamily: "'Inter',sans-serif", color: C.gray }}>

      {/* ══════ PAGE HEADER ══════ */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ ...lbl, color: C.red, letterSpacing: '0.3em', marginBottom: 8 }}>ZAI ECOSYSTEM</div>
        <h1 style={{ fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 300, lineHeight: 1.05, margin: '0 0 8px', color: C.black }}>
          Community
        </h1>
        <p style={{ color: C.muted, fontSize: '14px', margin: 0, fontWeight: 300 }}>
          A global family of zai owners — connected by the mountain.
        </p>
      </div>

      {/* ══════════════════════════════════════════════════
          TOP SECTION: Members table (left) + Cards (right)
      ═══════════════════════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 32, marginBottom: 48, alignItems: 'start' }}>

        {/* ──── LEFT: ZAI MEMBERS TABLE ──── */}
        <div>
          {/* Table header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
            <span style={{ ...lbl, fontSize: '11px', letterSpacing: '0.25em', color: C.gray, fontWeight: 600 }}>ZAI MEMBERS</span>
            <span style={{ fontSize: '11px', color: C.muted }}>{totalCount} registered</span>
          </div>

          {/* Column headers */}
          <div style={{
            display: 'grid', gridTemplateColumns: isAdmin ? '2fr 1.2fr 0.8fr 70px' : '2fr 1.2fr 0.8fr',
            padding: '10px 0', borderBottom: bdr,
          }}>
            <span style={{ ...lbl, fontSize: '9px' }}>MEMBER</span>
            <span style={{ ...lbl, fontSize: '9px' }}>LOCATION</span>
            <span style={{ ...lbl, fontSize: '9px' }}>SINCE</span>
            {isAdmin && <span style={{ ...lbl, fontSize: '9px' }}>ADMIN</span>}
          </div>

          {/* Member rows */}
          {visibleMembers.map((m, idx) => (
            <div key={m.id} style={{
              display: 'grid',
              gridTemplateColumns: isAdmin ? '2fr 1.2fr 0.8fr 70px' : '2fr 1.2fr 0.8fr',
              alignItems: 'center',
              padding: '10px 0',
              borderBottom: bdr,
              opacity: m.isBlocked ? 0.4 : 1,
              transition: 'background .15s',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = C.surface)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>

              {/* Member name with colored dot */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: m.isBlocked ? C.muted : getMemberDotColor(idx),
                }} />
                <span style={{ fontSize: '13px', fontWeight: 400, color: C.black }}>
                  {m.name}
                </span>
                {m.isBlocked && (
                  <span style={{
                    fontSize: '8px', padding: '1px 5px', letterSpacing: '0.1em', textTransform: 'uppercase',
                    background: 'rgba(200,16,46,0.08)', color: C.red, fontWeight: 600,
                  }}>blocked</span>
                )}
              </div>

              {/* Location */}
              <span style={{ fontSize: '12px', color: C.muted }}>{getMemberLocation(m)}</span>

              {/* Since */}
              <span style={{ fontSize: '12px', color: C.muted }}>{fmtDate(m.joinedAt)}</span>

              {/* Admin actions */}
              {isAdmin && (
                <div>
                  {m.isBlocked ? (
                    <button onClick={() => unblockMember(m.id)}
                      style={{ fontSize: '9px', padding: '2px 6px', background: C.surface, color: C.gray, border: bdr, cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}>
                      Unblock
                    </button>
                  ) : (
                    <button onClick={() => blockMember(m.id, m.name)}
                      style={{ fontSize: '9px', padding: '2px 6px', background: 'rgba(200,16,46,0.05)', color: C.red, border: '1px solid rgba(200,16,46,0.12)', cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}>
                      Block
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Pagination / showing count */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0' }}>
            <span style={{ fontSize: '11px', color: C.muted }}>
              Showing {showingCount} of {totalCount} members
            </span>
            {showingCount < members.length && (
              <button onClick={() => setMemberPage(p => p + 1)}
                style={{
                  fontSize: '11px', color: C.black, background: 'none', border: 'none',
                  cursor: 'pointer', textDecoration: 'underline', fontFamily: "'Inter',sans-serif",
                }}>
                Show more
              </button>
            )}
          </div>
        </div>

        {/* ──── RIGHT: STACKED CARDS ──── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* STAY IN THE LOOP — WhatsApp card */}
          <div style={{ border: bdr, background: C.pureWhite, padding: '24px' }}>
            <div style={{ ...lbl, fontSize: '10px', letterSpacing: '0.22em', marginBottom: 14, color: C.gray, fontWeight: 600 }}>
              STAY IN THE LOOP
            </div>
            <p style={{ fontSize: '12px', color: C.muted, lineHeight: 1.55, margin: '0 0 18px', fontWeight: 300 }}>
              Follow our WhatsApp channel for event announcements, new product drops, and exclusive updates from the zai team.
            </p>

            {/* WhatsApp channel info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%', background: C.green, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.553 4.122 1.523 5.86L0 24l6.335-1.652A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.82c-1.977 0-3.865-.527-5.518-1.523l-.396-.234-3.763.982.998-3.648-.257-.41A9.794 9.794 0 012.18 12C2.18 6.583 6.583 2.18 12 2.18S21.82 6.583 21.82 12 17.417 21.82 12 21.82z"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: C.black }}>zai Experience Club Channel</div>
                <div style={{ fontSize: '10px', color: C.muted }}>1,843 followers · updated weekly</div>
              </div>
            </div>

            {/* Follow button */}
            <a href="https://whatsapp.com/channel/YOUR_CHANNEL_ID" target="_blank" rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                width: '100%', padding: '12px', background: C.green, color: '#fff',
                textDecoration: 'none', fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em',
                textTransform: 'uppercase', border: 'none', cursor: 'pointer',
                borderRadius: 6, transition: 'opacity .2s',
                fontFamily: "'Inter',sans-serif",
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.553 4.122 1.523 5.86L0 24l6.335-1.652A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.82c-1.977 0-3.865-.527-5.518-1.523l-.396-.234-3.763.982.998-3.648-.257-.41A9.794 9.794 0 012.18 12C2.18 6.583 6.583 2.18 12 2.18S21.82 6.583 21.82 12 17.417 21.82 12 21.82z"/>
              </svg>
              FOLLOW WHATSAPP CHANNEL
            </a>

            <p style={{ fontSize: '10px', color: C.muted, margin: '12px 0 0', textAlign: 'center', fontWeight: 300 }}>
              You will be redirected to WhatsApp. No personal data is shared.
            </p>
          </div>

          {/* SHARE YOUR EXPERIENCE — Upload card */}
          <div style={{ border: bdr, background: C.pureWhite, padding: '24px' }}>
            <div style={{ ...lbl, fontSize: '10px', letterSpacing: '0.22em', marginBottom: 14, color: C.gray, fontWeight: 600 }}>
              SHARE YOUR EXPERIENCE
            </div>
            <p style={{ fontSize: '12px', color: C.muted, lineHeight: 1.55, margin: '0 0 18px', fontWeight: 300 }}>
              Upload a photo from your zai adventures and tell the community about it. Your post will appear in the timeline below.
            </p>
            <button onClick={() => setShowUpload(true)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                width: '100%', padding: '12px', background: C.red, color: '#fff',
                fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
                border: 'none', cursor: 'pointer', borderRadius: 6,
                fontFamily: "'Inter',sans-serif", transition: 'background .2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = C.burgundy)}
              onMouseLeave={e => (e.currentTarget.style.background = C.red)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              UPLOAD & SHARE
            </button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════
          COMMUNITY TIMELINE
      ═══════════════════════════════════════ */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 24, borderBottom: bdr, paddingBottom: 14 }}>
          <span style={{ ...lbl, fontSize: '11px', letterSpacing: '0.25em', color: C.gray, fontWeight: 600 }}>COMMUNITY TIMELINE</span>
          <span style={{ fontSize: '11px', color: C.muted }}>{photos.length} post{photos.length !== 1 ? 's' : ''}</span>
        </div>

        {photos.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center', background: C.surface, border: bdr }}>
            <div style={{ fontSize: '40px', marginBottom: 12, opacity: 0.15 }}>📷</div>
            <div style={{ fontSize: '15px', fontWeight: 300, color: C.black, marginBottom: 4 }}>No posts yet</div>
            <p style={{ color: C.muted, fontSize: '12px', margin: 0 }}>Be the first to share your zai moment!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {photos.map(photo => (
              <div key={photo.id}>

                {/* Author row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  {/* Avatar circle */}
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', background: C.mid, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '13px', color: C.white, fontWeight: 500,
                  }}>
                    {(photo.authorName?.charAt(0) || 'M').toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '13px', fontWeight: 500, color: C.black }}>{photo.authorName}</span>
                      {/* Location badge — placeholder from name/caption */}
                      <span style={{
                        fontSize: '10px', padding: '2px 8px', background: C.surface, color: C.muted,
                        borderRadius: 3,
                      }}>
                        Member
                      </span>
                    </div>
                  </div>
                  <span style={{ fontSize: '11px', color: C.muted }}>{fmtFullDate(photo.createdAt)}</span>
                  {isAdmin && (
                    <button onClick={() => deletePhoto(photo.id)} title="Delete (admin)"
                      style={{ background: 'none', border: 'none', fontSize: '13px', color: C.red, cursor: 'pointer', padding: '2px 6px', marginLeft: 4 }}>×</button>
                  )}
                </div>

                {/* Photo — full width with rounded corners */}
                <div onClick={() => openPhoto(photo.id)}
                  style={{ cursor: 'pointer', borderRadius: 8, overflow: 'hidden', background: C.black, marginBottom: 12 }}>
                  <img src={photo.url} alt={photo.caption}
                    style={{ width: '100%', maxHeight: 520, objectFit: 'cover', display: 'block' }} />
                </div>

                {/* Caption */}
                {photo.caption && (
                  <p style={{ fontSize: '13px', color: C.gray, margin: '0 0 10px', lineHeight: 1.6, fontWeight: 300 }}>
                    {photo.caption}
                  </p>
                )}

                {/* Reactions + comments link */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <ReactionBar photo={photo} />
                  <button onClick={() => openPhoto(photo.id)}
                    style={{ background: 'none', border: 'none', fontSize: '11px', color: C.muted, cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}>
                    {photo.commentCount} comment{photo.commentCount !== 1 ? 's' : ''} →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══════ UPLOAD MODAL ══════ */}
      {showUpload && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.8)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '2rem',
        }}
          onClick={() => { setShowUpload(false); setUploadFile(null); setUploadPreview(null); setUploadCaption(''); }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: C.white, maxWidth: 520, width: '100%', boxShadow: '0 24px 80px rgba(0,0,0,0.4)' }}>

            {/* Modal header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: bdr }}>
              <span style={{ ...lbl, fontSize: '11px', letterSpacing: '0.22em', color: C.gray, fontWeight: 600 }}>UPLOAD & SHARE</span>
              <button onClick={() => { setShowUpload(false); setUploadFile(null); setUploadPreview(null); setUploadCaption(''); }}
                style={{ background: 'none', border: 'none', fontSize: '18px', color: C.muted, cursor: 'pointer' }}>×</button>
            </div>

            {/* Image area */}
            <div style={{ padding: '24px' }}>
              {!uploadPreview ? (
                <label style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: '48px 20px', border: `2px dashed ${C.border}`, cursor: 'pointer',
                  color: C.muted, fontSize: '12px', textAlign: 'center',
                }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12, opacity: 0.4 }}>
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                  Click to select an image
                  <span style={{ fontSize: '10px', marginTop: 4 }}>JPG, PNG, or TIFF · Max 4 MB</span>
                  <input type="file" accept="image/jpeg,image/png,image/tiff" onChange={handleFileChange} style={{ display: 'none' }} />
                </label>
              ) : (
                <div style={{ position: 'relative', marginBottom: 16 }}>
                  <img src={uploadPreview} alt="Preview" style={{ width: '100%', maxHeight: 300, objectFit: 'contain', display: 'block', background: C.black, borderRadius: 4 }} />
                  <button onClick={() => { setUploadFile(null); setUploadPreview(null); }}
                    style={{
                      position: 'absolute', top: 8, right: 8, background: 'rgba(10,10,10,0.7)', color: '#fff',
                      border: 'none', width: 28, height: 28, cursor: 'pointer', fontSize: '14px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4,
                    }}>×</button>
                </div>
              )}

              {/* Caption */}
              {uploadPreview && (
                <>
                  <div style={{ ...lbl, marginBottom: 6, marginTop: 4 }}>CAPTION</div>
                  <textarea placeholder="Tell us about this moment..." value={uploadCaption}
                    onChange={e => setUploadCaption(e.target.value)} rows={3}
                    style={{
                      width: '100%', padding: '10px 12px', border: bdr, fontSize: '13px',
                      boxSizing: 'border-box', fontFamily: "'Inter',sans-serif", resize: 'vertical',
                      background: C.pureWhite, color: C.black, marginBottom: 16,
                    }} />
                  <button onClick={handleUpload} disabled={!uploadFile || uploading}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      width: '100%', padding: '13px', background: (!uploadFile || uploading) ? C.muted : C.red,
                      color: '#fff', border: 'none', fontSize: '12px', fontWeight: 600,
                      letterSpacing: '0.08em', textTransform: 'uppercase',
                      cursor: (!uploadFile || uploading) ? 'not-allowed' : 'pointer',
                      fontFamily: "'Inter',sans-serif", borderRadius: 6,
                    }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                    {uploading ? 'UPLOADING TO IPFS...' : 'UPLOAD & SHARE'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════ PHOTO DETAIL MODAL ══════ */}
      {selectedPhoto && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.8)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '2rem',
        }}
          onClick={() => { setSelectedPhoto(null); setEmojiPickerPhotoId(null); setEmojiPickerPos(null); }}>
          <div onClick={e => e.stopPropagation()}
            style={{
              background: C.white, maxWidth: 860, width: '100%', maxHeight: '90vh',
              display: 'grid', gridTemplateColumns: '1fr 340px',
              boxShadow: '0 24px 80px rgba(0,0,0,0.5)', overflow: 'hidden',
            }}>

            {/* Left — image */}
            <div style={{ background: C.black, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 380 }}>
              <img src={selectedPhoto.url} alt={selectedPhoto.caption} style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain' }} />
            </div>

            {/* Right — info */}
            <div style={{ display: 'flex', flexDirection: 'column', borderLeft: bdr, maxHeight: '90vh' }}>

              {/* Author */}
              <div style={{ padding: '18px 20px', borderBottom: bdr }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', background: C.mid, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '12px', color: C.white, fontWeight: 500,
                    }}>
                      {(selectedPhoto.authorName?.charAt(0) || 'M').toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: C.black }}>{selectedPhoto.authorName}</div>
                      <div style={{ fontSize: '10px', color: C.muted }}>{fmtFullDate(selectedPhoto.createdAt)}</div>
                    </div>
                  </div>
                  {(selectedPhoto.authorId === user?.id || isAdmin) && (
                    <button onClick={() => deletePhoto(selectedPhoto.id)}
                      style={{ background: 'none', border: 'none', fontSize: '11px', cursor: 'pointer', color: C.red }}>
                      {isAdmin && selectedPhoto.authorId !== user?.id ? 'Remove' : 'Delete'}
                    </button>
                  )}
                </div>
                {selectedPhoto.caption && (
                  <p style={{ fontSize: '13px', color: C.gray, margin: '12px 0 0', lineHeight: 1.55, fontWeight: 300 }}>{selectedPhoto.caption}</p>
                )}
                <div style={{ marginTop: 14 }}>
                  <ReactionBar photo={selectedPhoto} />
                </div>
              </div>

              {/* Comments */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                {(!selectedPhoto.comments || selectedPhoto.comments.length === 0) ? (
                  <p style={{ fontSize: '12px', color: C.muted, textAlign: 'center', marginTop: 24 }}>No comments yet</p>
                ) : (
                  selectedPhoto.comments.map(c => (
                    <div key={c.id} style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: C.black }}>{c.authorName}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: '10px', color: C.muted }}>{timeAgo(c.createdAt)}</span>
                          {(c.authorId === user?.id || isAdmin) && (
                            <button onClick={() => deleteComment(selectedPhoto.id, c.id)}
                              style={{ background: 'none', border: 'none', fontSize: '12px', cursor: 'pointer', color: C.red }}>×</button>
                          )}
                        </div>
                      </div>
                      <p style={{ fontSize: '12px', color: C.gray, margin: '3px 0 0', lineHeight: 1.55, fontWeight: 300 }}>{c.text}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Comment input */}
              <div style={{ padding: '14px 20px', borderTop: bdr, display: 'flex', gap: '1px' }}>
                <input type="text" placeholder="Add a comment..." value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addComment()}
                  style={{ flex: 1, padding: '10px 12px', border: bdr, fontSize: '12px', fontFamily: "'Inter',sans-serif", background: C.pureWhite, color: C.black, outline: 'none' }} />
                <button onClick={addComment} disabled={!newComment.trim()}
                  style={{
                    padding: '10px 18px', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase',
                    background: newComment.trim() ? C.black : C.muted, color: C.white, border: 'none',
                    cursor: newComment.trim() ? 'pointer' : 'not-allowed', fontFamily: "'Inter',sans-serif", fontWeight: 500,
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
          zIndex: 2000, background: C.pureWhite, border: bdr,
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          padding: 10, display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 3, width: 200,
        }}
          onClick={e => e.stopPropagation()}>
          {REACTION_EMOJIS.map(emoji => (
            <button key={emoji} onClick={() => toggleReaction(emojiPickerPhotoId!, emoji)}
              style={{
                width: 28, height: 28, border: 'none', background: 'transparent',
                fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
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
