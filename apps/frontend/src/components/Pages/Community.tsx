import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../../context/AppContext';
import { apiService } from '../../services/api';
import Button from '../Common/Button';

// ─── Types ───

interface Member {
  id: string;
  name: string;
  avatar: string;
  wallet?: string;
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
  taggedMembers: string[];
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

type Tab = 'feed' | 'members';

// ─── Constants ───

const REACTION_EMOJIS = [
  '❤️', '🔥', '👏', '🤩', '😍', '🙌',
  '⛷️', '🏔️', '🎿', '🏂', '❄️', '🌨️',
  '💪', '🥇', '🏆', '⭐', '💎', '👌',
  '😂', '🫶', '🙏', '🎉', '💯', '🚀',
];

// ─── Styles ───

const sectionBorder = '1px solid #e0ddd6';
const bgMuted = '#f0ede6';
const textMuted = '#6a6a6a';
const textDark = '#1a1a1a';
const accent = '#c8102e';
const gold = '#b8a06a';

const labelStyle: React.CSSProperties = {
  fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: textMuted,
};
const sectionTitle: React.CSSProperties = {
  fontSize: '11px', letterSpacing: '0.25em', textTransform: 'uppercase', color: textDark,
};

const adminBadgeStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '4px',
  padding: '2px 8px', borderRadius: '10px', fontSize: '9px',
  letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 600,
  background: 'rgba(200,16,46,0.08)', color: accent, border: `1px solid rgba(200,16,46,0.2)`,
};

const adminBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', fontSize: '11px', cursor: 'pointer',
  color: accent, padding: '2px 6px', borderRadius: '3px', transition: 'background 0.15s',
};

// ─── Helpers ───

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(d).toLocaleDateString();
}

function fmtDate(d: string) {
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

// ─── Component ───

const Community: React.FC = () => {
  const { user } = useAppContext();
  const [activeTab, setActiveTab] = useState<Tab>('feed');

  const [isAdmin, setIsAdmin] = useState(false);

  // Members state
  const [members, setMembers] = useState<Member[]>([]);
  const [stats, setStats] = useState<CommunityStats>({ totalMembers: 0, totalPhotos: 0 });

  // Gallery state
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [newComment, setNewComment] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [uploadCaption, setUploadCaption] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [taggedMembers, setTaggedMembers] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);

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
      const res = await apiService.post('/community/gallery', { image: uploadPreview, caption: uploadCaption, taggedMembers });
      if (res.data?.success) {
        setPhotos(prev => [res.data.data, ...prev]);
        setShowUpload(false); setUploadCaption(''); setUploadFile(null); setUploadPreview(null); setTaggedMembers([]);
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
      const res = await apiService.post(`/community/gallery/${photoId}/reactions`, { emoji });
      if (res.data?.success) {
        const action = res.data.action as string;
        const userName = user?.givenName || user?.name || 'Member';

        setPhotos(prev => prev.map(p => {
          if (p.id !== photoId) return p;
          const reactions = [...(p.reactions || [])];
          if (action === 'added') {
            reactions.push({ emoji, userId: user?.id || '', userName });
          } else {
            const idx = reactions.findIndex(r => r.emoji === emoji && r.userId === user?.id);
            if (idx >= 0) reactions.splice(idx, 1);
          }
          return { ...p, reactions };
        }));

        if (selectedPhoto?.id === photoId) {
          setSelectedPhoto(prev => {
            if (!prev) return null;
            const reactions = [...(prev.reactions || [])];
            if (action === 'added') {
              reactions.push({ emoji, userId: user?.id || '', userName });
            } else {
              const idx = reactions.findIndex(r => r.emoji === emoji && r.userId === user?.id);
              if (idx >= 0) reactions.splice(idx, 1);
            }
            return { ...prev, reactions };
          });
        }

        setShowEmojiPicker(null);
      }
    } catch (err: any) { alert(err.response?.data?.error || 'Failed to react'); }
  };

  // ─── Admin: block / unblock member ───

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

  // ─── ReactionBar sub-component ───

  const ReactionBar = ({ photo, overlay = false }: { photo: Photo; overlay?: boolean }) => {
    const grouped = groupReactions(photo.reactions || [], user?.id);
    const hasReactions = Object.keys(grouped).length > 0;
    const pickerOpen = showEmojiPicker === photo.id;

    // Non-overlay version (used under photo cards in grid)
    if (!overlay) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', minHeight: '28px' }}>
          {hasReactions && Object.entries(grouped).map(([emoji, info]) => (
            <button
              key={emoji}
              onClick={(e) => { e.stopPropagation(); toggleReaction(photo.id, emoji); }}
              title={info.users.join(', ')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                padding: '3px 8px', borderRadius: '12px', fontSize: '13px',
                border: info.reacted ? `1px solid ${accent}` : '1px solid #e0ddd6',
                background: info.reacted ? 'rgba(200,16,46,0.06)' : '#fff',
                cursor: 'pointer', transition: 'all 0.15s', lineHeight: 1,
              }}
            >
              <span>{emoji}</span>
              <span style={{ fontSize: '10px', fontWeight: 600, color: info.reacted ? accent : textMuted }}>{info.count}</span>
            </button>
          ))}
          <div style={{ position: 'relative' }}>
            <button
              onClick={(e) => { e.stopPropagation(); setShowEmojiPicker(pickerOpen ? null : photo.id); }}
              style={{
                width: 28, height: 28, borderRadius: '50%', border: '1px solid #e0ddd6',
                background: pickerOpen ? bgMuted : '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '16px', transition: 'all 0.15s',
              }}
              title="Add reaction"
            >{pickerOpen ? '×' : '😊'}</button>
            {pickerOpen && (
              <div onClick={(e) => e.stopPropagation()} style={{
                position: 'absolute', bottom: '110%', right: '-8px',
                background: 'rgba(255,255,255,0.97)', borderRadius: '16px',
                padding: '10px', display: 'grid', gridTemplateColumns: 'repeat(4, 42px)', gap: '4px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.25)', zIndex: 10,
                backdropFilter: 'blur(12px)',
                maxHeight: '260px', overflowY: 'auto',
              }}>
                {REACTION_EMOJIS.map(em => (
                  <button key={em} onClick={(e) => { e.stopPropagation(); toggleReaction(photo.id, em); }}
                    style={{ width: 42, height: 42, border: 'none', background: 'transparent', borderRadius: '6px', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = bgMuted)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >{em}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    // ── Overlay version (floating widget on the photo) ──
    return (
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute', bottom: '12px', left: '12px', right: '12px',
          display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap',
          zIndex: 5,
        }}
      >
        {/* Existing reaction pills */}
        {hasReactions && Object.entries(grouped).map(([emoji, info]) => (
          <button
            key={emoji}
            onClick={(e) => { e.stopPropagation(); toggleReaction(photo.id, emoji); }}
            title={info.users.join(', ')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              padding: '4px 10px', borderRadius: '14px', fontSize: '14px',
              border: 'none',
              background: info.reacted ? 'rgba(200,16,46,0.85)' : 'rgba(0,0,0,0.55)',
              color: '#fff',
              cursor: 'pointer', transition: 'all 0.2s', lineHeight: 1,
              backdropFilter: 'blur(8px)',
            }}
          >
            <span>{emoji}</span>
            <span style={{ fontSize: '11px', fontWeight: 600 }}>{info.count}</span>
          </button>
        ))}

        {/* Emoji quick-pick widget */}
        <div style={{ position: 'relative', marginLeft: 'auto' }}>
          <button
            onClick={(e) => { e.stopPropagation(); setShowEmojiPicker(pickerOpen ? null : photo.id); }}
            style={{
              width: 36, height: 36, borderRadius: '50%', border: 'none',
              background: pickerOpen ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.5)',
              color: pickerOpen ? textDark : '#fff',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '18px', transition: 'all 0.2s',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            }}
            title="React"
          >
            {pickerOpen ? '×' : '😊'}
          </button>
          {pickerOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'absolute', bottom: '110%', left: '50%', transform: 'translateX(-50%)',
                background: '#fff', border: '1px solid #e0ddd6', borderRadius: '12px',
                padding: '8px', display: 'grid', gridTemplateColumns: 'repeat(6, 38px)', gap: '2px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 10,
              }}
            >
              {REACTION_EMOJIS.map(em => (
                <button
                  key={em}
                  onClick={(e) => { e.stopPropagation(); toggleReaction(photo.id, em); }}
                  style={{
                    width: 38, height: 38, border: 'none', background: 'transparent',
                    borderRadius: '50%', cursor: 'pointer', fontSize: '22px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(200,16,46,0.1)';
                    e.currentTarget.style.transform = 'scale(1.25)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >{em}</button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ─── Render ───

  if (isLoading) {
    return (
      <div style={{ padding: '3rem 4rem 5rem', textAlign: 'center' }}>
        <div style={{ fontSize: '16px', color: textMuted }}>Loading community...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '3rem 4rem 5rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: sectionBorder }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.4rem' }}>
          <div style={{ fontSize: '11px', letterSpacing: '0.3em', textTransform: 'uppercase', color: accent }}>
            zai ecosystem
          </div>
          {isAdmin && <span style={adminBadgeStyle}>Moderator</span>}
        </div>
        <h1 style={{ fontSize: 'clamp(24px, 3.5vw, 40px)', fontWeight: 300, lineHeight: 1.15, margin: '0 0 0.3rem' }}>
          Community
        </h1>
        <p style={{ color: textMuted, fontSize: '13px', maxWidth: '520px', margin: 0 }}>
          A global family of zai owners — connected by the mountain.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', fontSize: '11px', color: textMuted }}>
          <span>{stats.totalMembers} members</span>
          <span>·</span>
          <span>{stats.totalPhotos} photos</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: '2rem', borderBottom: sectionBorder }}>
        {(['feed', 'members'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 20px', fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase',
              background: 'transparent', border: 'none',
              borderBottom: activeTab === tab ? `2px solid ${accent}` : '2px solid transparent',
              color: activeTab === tab ? textDark : textMuted,
              cursor: 'pointer', fontWeight: activeTab === tab ? 600 : 400, transition: 'all 0.2s',
            }}
          >
            {tab === 'feed' ? 'Feed' : 'Members'}
          </button>
        ))}
      </div>

      {/* ═══════════ FEED TAB ═══════════ */}
      {activeTab === 'feed' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div style={sectionTitle}>Community Feed</div>
            <button
              onClick={() => setShowUpload(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                background: accent, color: '#fff', border: 'none',
                padding: '11px 24px', borderRadius: '4px',
                fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em',
                cursor: 'pointer', transition: 'all 0.2s',
                boxShadow: '0 2px 8px rgba(200,16,46,0.25)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#e01232';
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(200,16,46,0.35)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = accent;
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(200,16,46,0.25)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <span style={{ fontSize: '16px', lineHeight: 1 }}>+</span>
              Share a moment
            </button>
          </div>

          {/* Upload form */}
          {showUpload && (
            <div style={{ border: sectionBorder, padding: '1.5rem', marginBottom: '1.5rem', background: '#fff' }}>
              <div style={{ ...sectionTitle, marginBottom: '1rem' }}>Share a photo</div>
              {!uploadPreview ? (
                <label style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: '2rem', border: '2px dashed #d0cdc5', borderRadius: '4px', cursor: 'pointer',
                  color: textMuted, fontSize: '13px', marginBottom: '1rem',
                }}>
                  Click to select an image (max 4 MB)
                  <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                </label>
              ) : (
                <div style={{ marginBottom: '1rem', position: 'relative' }}>
                  <img src={uploadPreview} alt="Preview" style={{ width: '100%', maxHeight: '300px', objectFit: 'contain', borderRadius: '4px' }} />
                  <button onClick={() => { setUploadFile(null); setUploadPreview(null); }} style={{
                    position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', color: '#fff',
                    border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', fontSize: '14px',
                  }}>×</button>
                </div>
              )}
              <input type="text" placeholder="Add a caption..." value={uploadCaption} onChange={e => setUploadCaption(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: sectionBorder, fontSize: '13px', marginBottom: '0.75rem', boxSizing: 'border-box' }} />
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ ...labelStyle, marginBottom: '0.5rem' }}>Tag members (optional)</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {members.filter(m => !m.isBlocked).slice(0, 20).map(m => (
                    <button key={m.id}
                      onClick={() => setTaggedMembers(prev => prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id])}
                      style={{
                        padding: '4px 10px', fontSize: '11px', borderRadius: '12px', cursor: 'pointer',
                        border: taggedMembers.includes(m.id) ? `1px solid ${accent}` : sectionBorder,
                        background: taggedMembers.includes(m.id) ? '#fef2f2' : '#fff',
                        color: taggedMembers.includes(m.id) ? accent : textMuted,
                      }}>
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <Button variant="primary" size="sm" onClick={handleUpload} disabled={!uploadFile || uploading}>
                  {uploading ? 'Uploading to IPFS...' : 'Share'}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => {
                  setShowUpload(false); setUploadFile(null); setUploadPreview(null); setUploadCaption(''); setTaggedMembers([]);
                }}>Cancel</Button>
              </div>
            </div>
          )}

          {/* Photo grid */}
          {photos.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', background: bgMuted, border: sectionBorder }}>
              <p style={{ color: textMuted, margin: 0 }}>No posts yet. Be the first to share your zai moment!</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
              {photos.map(photo => (
                <div key={photo.id} style={{ border: sectionBorder, borderRadius: '6px', overflow: 'hidden', background: '#fff', transition: 'box-shadow 0.2s', position: 'relative' }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>
                  {isAdmin && (
                    <button onClick={(e) => { e.stopPropagation(); deletePhoto(photo.id); }}
                      title="Delete photo (admin)"
                      style={{
                        position: 'absolute', top: 6, right: 6, zIndex: 5,
                        width: 26, height: 26, borderRadius: '50%', border: 'none',
                        background: 'rgba(200,16,46,0.85)', color: '#fff', fontSize: '14px',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: 0.7, transition: 'opacity 0.2s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}>
                      ×
                    </button>
                  )}
                  <div onClick={() => openPhoto(photo.id)} style={{ aspectRatio: '1', overflow: 'hidden', background: '#1a1a1a', cursor: 'pointer' }}>
                    <img src={photo.url} alt={photo.caption} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </div>
                  <div style={{ padding: '10px 12px' }}>
                    <div onClick={() => openPhoto(photo.id)} style={{ cursor: 'pointer' }}>
                      <div style={{ fontSize: '12px', color: textDark, fontWeight: 500, marginBottom: '4px' }}>{photo.authorName}</div>
                      {photo.caption && (
                        <div style={{ fontSize: '12px', color: textMuted, marginBottom: '6px' }}>
                          {photo.caption.length > 60 ? photo.caption.slice(0, 60) + '...' : photo.caption}
                        </div>
                      )}
                    </div>
                    <div style={{ marginTop: '6px', marginBottom: '6px' }}>
                      <ReactionBar photo={photo} />
                    </div>
                    <div onClick={() => openPhoto(photo.id)} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: textMuted, cursor: 'pointer' }}>
                      <span>{photo.commentCount} comment{photo.commentCount !== 1 ? 's' : ''}</span>
                      <span>{timeAgo(photo.createdAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Photo detail modal ── */}
          {selectedPhoto && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '2rem' }}
              onClick={() => { setSelectedPhoto(null); setShowEmojiPicker(null); }}>
              <div onClick={e => e.stopPropagation()}
                style={{ background: '#fff', borderRadius: '4px', maxWidth: '800px', width: '100%', maxHeight: '90vh', overflow: 'auto', display: 'grid', gridTemplateColumns: '1fr 320px' }}>
                <div style={{ background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px', position: 'relative' }}>
                  <img src={selectedPhoto.url} alt={selectedPhoto.caption} style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }} />
                  <ReactionBar photo={selectedPhoto} overlay />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', borderLeft: sectionBorder }}>
                  <div style={{ padding: '14px', borderBottom: sectionBorder }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: textDark }}>{selectedPhoto.authorName}</div>
                        <div style={{ fontSize: '10px', color: textMuted }}>{fmtDate(selectedPhoto.createdAt)}</div>
                      </div>
                      {(selectedPhoto.authorId === user?.id || isAdmin) && (
                        <button onClick={() => deletePhoto(selectedPhoto.id)} style={{
                          ...adminBtnStyle, color: accent, fontSize: '11px',
                        }}>
                          {isAdmin && selectedPhoto.authorId !== user?.id ? 'Remove (mod)' : 'Delete'}
                        </button>
                      )}
                    </div>
                    {selectedPhoto.caption && (
                      <p style={{ fontSize: '13px', color: textDark, margin: '8px 0 0', lineHeight: 1.5 }}>{selectedPhoto.caption}</p>
                    )}
                    {selectedPhoto.taggedMembers && selectedPhoto.taggedMembers.length > 0 && (
                      <div style={{ fontSize: '10px', color: textMuted, marginTop: '6px' }}>
                        Tagged: {selectedPhoto.taggedMembers.map(id => members.find(m => m.id === id)?.name || id.slice(0, 6)).join(', ')}
                      </div>
                    )}
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>
                    {(!selectedPhoto.comments || selectedPhoto.comments.length === 0) ? (
                      <p style={{ fontSize: '12px', color: textMuted, textAlign: 'center' }}>No comments yet</p>
                    ) : (
                      selectedPhoto.comments.map(c => (
                        <div key={c.id} style={{ marginBottom: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: textDark }}>{c.authorName}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '10px', color: textMuted }}>{timeAgo(c.createdAt)}</span>
                              {(c.authorId === user?.id || isAdmin) && (
                                <button onClick={() => deleteComment(selectedPhoto.id, c.id)}
                                  title={isAdmin && c.authorId !== user?.id ? 'Remove comment (mod)' : 'Delete comment'}
                                  style={{ ...adminBtnStyle, fontSize: '12px', padding: '0 4px' }}>
                                  ×
                                </button>
                              )}
                            </div>
                          </div>
                          <p style={{ fontSize: '12px', color: textDark, margin: '2px 0 0', lineHeight: 1.5 }}>{c.text}</p>
                        </div>
                      ))
                    )}
                  </div>

                  <div style={{ padding: '14px', borderTop: sectionBorder, display: 'flex', gap: '8px' }}>
                    <input type="text" placeholder="Add a comment..." value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addComment()}
                      style={{ flex: 1, padding: '8px 10px', border: sectionBorder, fontSize: '12px' }} />
                    <Button variant="primary" size="sm" onClick={addComment} disabled={!newComment.trim()}>Post</Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════ MEMBERS TAB ═══════════ */}
      {activeTab === 'members' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={sectionTitle}>zai Members</div>
              {isAdmin && <span style={{ ...adminBadgeStyle, fontSize: '8px' }}>Admin view</span>}
            </div>
            <div style={{ fontSize: '11px', color: textMuted }}>{members.length} of {stats.totalMembers} registered</div>
          </div>

          <div style={{ border: sectionBorder, borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: isAdmin ? '2fr 1fr 100px' : '2fr 1fr',
              borderBottom: sectionBorder, background: bgMuted,
            }}>
              {['Member', 'Since', ...(isAdmin ? ['Admin'] : [])].map(h => (
                <div key={h} style={{ padding: '10px 14px', ...labelStyle }}>{h}</div>
              ))}
            </div>

            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
              {members.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: textMuted }}>No members found</div>
              ) : (
                members.map((m, i) => (
                  <div key={m.id} style={{
                    display: 'grid',
                    gridTemplateColumns: isAdmin ? '2fr 1fr 100px' : '2fr 1fr',
                    alignItems: 'center',
                    borderBottom: i < members.length - 1 ? sectionBorder : 'none',
                    background: m.isBlocked ? 'rgba(200,16,46,0.04)' : (i % 2 === 0 ? '#fff' : '#f9f8f6'),
                    transition: 'background 0.15s',
                    opacity: m.isBlocked ? 0.6 : 1,
                  }}
                    onMouseEnter={e => { if (!m.isBlocked) e.currentTarget.style.background = bgMuted; }}
                    onMouseLeave={e => { if (!m.isBlocked) e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#f9f8f6'; }}
                  >
                    <div style={{ padding: '11px 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%', background: m.isBlocked ? '#999' : textDark,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '10px', color: gold, flexShrink: 0, fontWeight: 500,
                      }}>
                        {m.avatar}
                      </div>
                      <span>{m.name}</span>
                      {m.isBlocked && (
                        <span style={{
                          fontSize: '9px', padding: '1px 6px', borderRadius: '8px',
                          background: 'rgba(200,16,46,0.1)', color: accent, fontWeight: 600,
                          letterSpacing: '0.1em', textTransform: 'uppercase',
                        }}>blocked</span>
                      )}
                    </div>
                    <div style={{ padding: '11px 14px', fontSize: '11px', color: textMuted }}>
                      {fmtDate(m.joinedAt)}
                    </div>
                    {isAdmin && (
                      <div style={{ padding: '11px 14px' }}>
                        {m.isBlocked ? (
                          <button onClick={() => unblockMember(m.id)}
                            style={{
                              background: 'none', border: `1px solid ${accent}`, borderRadius: '3px',
                              padding: '4px 10px', fontSize: '10px', color: accent, cursor: 'pointer',
                              letterSpacing: '0.1em', textTransform: 'uppercase', transition: 'all 0.2s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = accent; e.currentTarget.style.color = '#fff'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = accent; }}>
                            Unblock
                          </button>
                        ) : (
                          <button onClick={() => blockMember(m.id, m.name)}
                            style={{
                              background: 'none', border: sectionBorder, borderRadius: '3px',
                              padding: '4px 10px', fontSize: '10px', color: textMuted, cursor: 'pointer',
                              letterSpacing: '0.1em', textTransform: 'uppercase', transition: 'all 0.2s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.color = accent; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e0ddd6'; e.currentTarget.style.color = textMuted; }}>
                            Block
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Community;
