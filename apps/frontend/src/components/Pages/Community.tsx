import React, { useState, useEffect, useRef, useCallback } from 'react';
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
}

interface Comment {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  createdAt: string;
}

interface ChatMessage {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  recipientId?: string | null;
  createdAt: string;
}

interface CommunityStats {
  totalMembers: number;
  totalPhotos: number;
  totalMessages: number;
}

interface DMConversation {
  partnerId: string;
  partnerName: string;
  lastMessageAt: string;
}

type Tab = 'members' | 'feed' | 'chat';

// ─── Styles ───

const sectionBorder = '1px solid #e0ddd6';
const bgMuted = '#f0ede6';
const textMuted = '#6a6a6a';
const textDark = '#1a1a1a';
const accent = '#c8102e';

const labelStyle: React.CSSProperties = {
  fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: textMuted,
};
const sectionTitle: React.CSSProperties = {
  fontSize: '11px', letterSpacing: '0.25em', textTransform: 'uppercase', color: textDark,
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

// ─── Component ───

const Community: React.FC = () => {
  const { user } = useAppContext();
  const [activeTab, setActiveTab] = useState<Tab>('feed');

  // Members state
  const [members, setMembers] = useState<Member[]>([]);
  const [stats, setStats] = useState<CommunityStats>({ totalMembers: 0, totalPhotos: 0, totalMessages: 0 });

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

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [dmPartner, setDmPartner] = useState<Member | null>(null);
  const [dmConversations, setDmConversations] = useState<DMConversation[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [isLoading, setIsLoading] = useState(true);

  // ─── Data fetching ───

  const fetchMembers = useCallback(async () => {
    try {
      const res = await apiService.get('/community/members', { params: { limit: 100, offset: 0 } });
      if (res.data?.success) setMembers(res.data.data || []);
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
      if (res.data?.success) setPhotos(res.data.data || []);
    } catch (err) { console.error('Error fetching gallery:', err); }
  }, []);

  const fetchChat = useCallback(async (recipientId?: string) => {
    try {
      const params: any = { limit: 100, offset: 0 };
      if (recipientId) params.with = recipientId;
      const res = await apiService.get('/community/chat', { params });
      if (res.data?.success) setChatMessages(res.data.data || []);
    } catch (err) { console.error('Error fetching chat:', err); }
  }, []);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await apiService.get('/community/chat/conversations');
      if (res.data?.success) setDmConversations(res.data.data || []);
    } catch (err) { console.error('Error fetching conversations:', err); }
  }, []);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await Promise.all([fetchMembers(), fetchStats(), fetchPhotos()]);
      setIsLoading(false);
    })();
  }, [fetchMembers, fetchStats, fetchPhotos]);

  // Poll chat every 5s when on the chat tab
  useEffect(() => {
    if (activeTab !== 'chat') return;
    fetchChat(dmPartner?.id);
    fetchConversations();
    const iv = setInterval(() => fetchChat(dmPartner?.id), 5000);
    return () => clearInterval(iv);
  }, [activeTab, dmPartner, fetchChat, fetchConversations]);

  // Scroll to bottom when chat updates
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

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
      const res = await apiService.post('/community/gallery', {
        image: uploadPreview,
        caption: uploadCaption,
        taggedMembers,
      });
      if (res.data?.success) {
        setPhotos(prev => [res.data.data, ...prev]);
        setShowUpload(false);
        setUploadCaption('');
        setUploadFile(null);
        setUploadPreview(null);
        setTaggedMembers([]);
        fetchStats();
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const openPhoto = async (photoId: string) => {
    try {
      const res = await apiService.get(`/community/gallery/${photoId}`);
      if (res.data?.success) setSelectedPhoto(res.data.data);
    } catch (err) { console.error('Error opening photo:', err); }
  };

  const addComment = async () => {
    if (!selectedPhoto || !newComment.trim()) return;
    try {
      const res = await apiService.post(`/community/gallery/${selectedPhoto.id}/comments`, { text: newComment });
      if (res.data?.success) {
        setSelectedPhoto(prev => prev ? {
          ...prev,
          commentCount: prev.commentCount + 1,
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
    try {
      await apiService.delete(`/community/gallery/${photoId}/comments/${commentId}`);
      setSelectedPhoto(prev => prev ? {
        ...prev,
        commentCount: Math.max(prev.commentCount - 1, 0),
        comments: (prev.comments || []).filter(c => c.id !== commentId),
      } : null);
    } catch (err: any) { alert(err.response?.data?.error || 'Failed to delete comment'); }
  };

  // ─── Chat actions ───

  const sendMessage = async () => {
    if (!chatInput.trim()) return;
    setChatSending(true);
    try {
      const payload: any = { text: chatInput };
      if (dmPartner) payload.recipientId = dmPartner.id;
      const res = await apiService.post('/community/chat', payload);
      if (res.data?.success) {
        setChatMessages(prev => [...prev, res.data.data]);
        setChatInput('');
      }
    } catch (err: any) { alert(err.response?.data?.error || 'Failed to send'); }
    finally { setChatSending(false); }
  };

  const openDM = (member: Member) => {
    setDmPartner(member);
    setActiveTab('chat');
  };

  const backToGeneral = () => {
    setDmPartner(null);
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
        <div style={{ fontSize: '11px', letterSpacing: '0.3em', textTransform: 'uppercase', color: accent, marginBottom: '0.4rem' }}>
          zai ecosystem
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
          <span>·</span>
          <span>{stats.totalMessages || 0} messages</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: '2rem', borderBottom: sectionBorder }}>
        {(['feed', 'members', 'chat'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 20px',
              fontSize: '11px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab ? `2px solid ${accent}` : '2px solid transparent',
              color: activeTab === tab ? textDark : textMuted,
              cursor: 'pointer',
              fontWeight: activeTab === tab ? 600 : 400,
              transition: 'all 0.2s',
            }}
          >
            {tab === 'feed' ? 'Feed' : tab === 'members' ? 'Members' : 'Chat'}
          </button>
        ))}
      </div>

      {/* ═══════════ FEED TAB ═══════════ */}
      {activeTab === 'feed' && (
        <div>
          {/* Upload button */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div style={sectionTitle}>Community Feed</div>
            <Button variant="primary" size="sm" onClick={() => setShowUpload(true)}>
              Share a moment
            </Button>
          </div>

          {/* Upload form */}
          {showUpload && (
            <div style={{ border: sectionBorder, padding: '1.5rem', marginBottom: '1.5rem', background: '#fff' }}>
              <div style={{ ...sectionTitle, marginBottom: '1rem' }}>Share a photo</div>

              {!uploadPreview ? (
                <label style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: '2rem', border: `2px dashed #d0cdc5`, borderRadius: '4px', cursor: 'pointer',
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
                  }}>
                    ×
                  </button>
                </div>
              )}

              <input
                type="text"
                placeholder="Add a caption..."
                value={uploadCaption}
                onChange={e => setUploadCaption(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', border: sectionBorder, fontSize: '13px',
                  marginBottom: '0.75rem', boxSizing: 'border-box',
                }}
              />

              {/* Tag members */}
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ ...labelStyle, marginBottom: '0.5rem' }}>Tag members (optional)</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {members.slice(0, 20).map(m => (
                    <button
                      key={m.id}
                      onClick={() => setTaggedMembers(prev =>
                        prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id]
                      )}
                      style={{
                        padding: '4px 10px', fontSize: '11px', borderRadius: '12px', cursor: 'pointer',
                        border: taggedMembers.includes(m.id) ? `1px solid ${accent}` : sectionBorder,
                        background: taggedMembers.includes(m.id) ? '#fef2f2' : '#fff',
                        color: taggedMembers.includes(m.id) ? accent : textMuted,
                      }}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <Button variant="primary" size="sm" onClick={handleUpload} disabled={!uploadFile || uploading}>
                  {uploading ? 'Uploading to IPFS...' : 'Share'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => {
                  setShowUpload(false); setUploadFile(null); setUploadPreview(null);
                  setUploadCaption(''); setTaggedMembers([]);
                }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Photo grid */}
          {photos.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', background: bgMuted, border: sectionBorder }}>
              <p style={{ color: textMuted, margin: 0 }}>No posts yet. Be the first to share your zai moment!</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
              {photos.map(photo => (
                <div
                  key={photo.id}
                  onClick={() => openPhoto(photo.id)}
                  style={{
                    border: sectionBorder, borderRadius: '4px', overflow: 'hidden', cursor: 'pointer',
                    background: '#fff', transition: 'box-shadow 0.2s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
                >
                  <div style={{ aspectRatio: '1', overflow: 'hidden', background: '#1a1a1a' }}>
                    <img src={photo.url} alt={photo.caption} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </div>
                  <div style={{ padding: '10px 12px' }}>
                    <div style={{ fontSize: '12px', color: textDark, fontWeight: 500, marginBottom: '4px' }}>
                      {photo.authorName}
                    </div>
                    {photo.caption && (
                      <div style={{ fontSize: '12px', color: textMuted, marginBottom: '6px' }}>
                        {photo.caption.length > 60 ? photo.caption.slice(0, 60) + '...' : photo.caption}
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: textMuted }}>
                      <span>{photo.commentCount} comment{photo.commentCount !== 1 ? 's' : ''}</span>
                      <span>{timeAgo(photo.createdAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Photo modal */}
          {selectedPhoto && (
            <div
              style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '2rem',
              }}
              onClick={() => setSelectedPhoto(null)}
            >
              <div
                onClick={e => e.stopPropagation()}
                style={{
                  background: '#fff', borderRadius: '4px', maxWidth: '800px', width: '100%',
                  maxHeight: '90vh', overflow: 'auto', display: 'grid',
                  gridTemplateColumns: '1fr 320px',
                }}
              >
                {/* Image */}
                <div style={{ background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
                  <img src={selectedPhoto.url} alt={selectedPhoto.caption} style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }} />
                </div>

                {/* Details + comments */}
                <div style={{ display: 'flex', flexDirection: 'column', borderLeft: sectionBorder }}>
                  {/* Author */}
                  <div style={{ padding: '14px', borderBottom: sectionBorder }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: textDark }}>{selectedPhoto.authorName}</div>
                        <div style={{ fontSize: '10px', color: textMuted }}>{fmtDate(selectedPhoto.createdAt)}</div>
                      </div>
                      {selectedPhoto.authorId === user?.id && (
                        <button onClick={() => deletePhoto(selectedPhoto.id)} style={{
                          background: 'none', border: 'none', color: accent, fontSize: '11px', cursor: 'pointer',
                        }}>Delete</button>
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

                  {/* Comments */}
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
                              {c.authorId === user?.id && (
                                <button onClick={() => deleteComment(selectedPhoto.id, c.id)} style={{
                                  background: 'none', border: 'none', color: accent, fontSize: '10px', cursor: 'pointer',
                                }}>×</button>
                              )}
                            </div>
                          </div>
                          <p style={{ fontSize: '12px', color: textDark, margin: '2px 0 0', lineHeight: 1.5 }}>{c.text}</p>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Comment input */}
                  <div style={{ padding: '14px', borderTop: sectionBorder, display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="Add a comment..."
                      value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addComment()}
                      style={{ flex: 1, padding: '8px 10px', border: sectionBorder, fontSize: '12px' }}
                    />
                    <Button variant="primary" size="sm" onClick={addComment} disabled={!newComment.trim()}>
                      Post
                    </Button>
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
            <div style={sectionTitle}>zai Members</div>
            <div style={{ fontSize: '11px', color: textMuted }}>{members.length} of {stats.totalMembers} registered</div>
          </div>

          <div style={{ border: sectionBorder, borderRadius: '4px', overflow: 'hidden' }}>
            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 80px', borderBottom: sectionBorder, background: bgMuted }}>
              {['Member', 'Since', ''].map(h => (
                <div key={h} style={{ padding: '10px 14px', ...labelStyle }}>{h}</div>
              ))}
            </div>

            {/* Rows */}
            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
              {members.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: textMuted }}>No members found</div>
              ) : (
                members.map((m, i) => (
                  <div
                    key={m.id}
                    style={{
                      display: 'grid', gridTemplateColumns: '2fr 1fr 80px', alignItems: 'center',
                      borderBottom: i < members.length - 1 ? sectionBorder : 'none',
                      background: i % 2 === 0 ? '#fff' : '#f9f8f6',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = bgMuted)}
                    onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#f9f8f6')}
                  >
                    <div style={{ padding: '11px 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%', background: textDark,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '10px', color: '#b8a06a', flexShrink: 0, fontWeight: 500,
                      }}>
                        {m.avatar}
                      </div>
                      {m.name}
                    </div>
                    <div style={{ padding: '11px 14px', fontSize: '11px', color: textMuted }}>
                      {fmtDate(m.joinedAt)}
                    </div>
                    <div style={{ padding: '11px 14px' }}>
                      <button
                        onClick={() => openDM(m)}
                        style={{
                          background: 'none', border: sectionBorder, borderRadius: '3px',
                          padding: '4px 10px', fontSize: '10px', color: textMuted, cursor: 'pointer',
                          letterSpacing: '0.1em', textTransform: 'uppercase',
                        }}
                      >
                        Msg
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ CHAT TAB ═══════════ */}
      {activeTab === 'chat' && (
        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '1.5rem', minHeight: '500px' }}>
          {/* Sidebar: General + DM list */}
          <div style={{ border: sectionBorder, borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', background: bgMuted, borderBottom: sectionBorder, ...sectionTitle }}>
              Conversations
            </div>

            {/* General chat */}
            <div
              onClick={backToGeneral}
              style={{
                padding: '12px 14px', cursor: 'pointer', borderBottom: sectionBorder,
                background: !dmPartner ? '#f0ede6' : '#fff',
                transition: 'background 0.15s',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: !dmPartner ? 600 : 400, color: textDark }}>General Chat</div>
              <div style={{ fontSize: '10px', color: textMuted }}>Open to everyone</div>
            </div>

            {/* DM conversations */}
            {dmConversations.map(conv => (
              <div
                key={conv.partnerId}
                onClick={() => {
                  const m = members.find(m => m.id === conv.partnerId);
                  if (m) setDmPartner(m);
                  else setDmPartner({ id: conv.partnerId, name: conv.partnerName, avatar: conv.partnerName.charAt(0).toUpperCase(), joinedAt: '', isPublic: false });
                }}
                style={{
                  padding: '12px 14px', cursor: 'pointer', borderBottom: sectionBorder,
                  background: dmPartner?.id === conv.partnerId ? '#f0ede6' : '#fff',
                  transition: 'background 0.15s',
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: dmPartner?.id === conv.partnerId ? 600 : 400, color: textDark }}>{conv.partnerName}</div>
                <div style={{ fontSize: '10px', color: textMuted }}>{timeAgo(conv.lastMessageAt)}</div>
              </div>
            ))}
          </div>

          {/* Chat messages area */}
          <div style={{ border: sectionBorder, borderRadius: '4px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Chat header */}
            <div style={{ padding: '12px 14px', background: bgMuted, borderBottom: sectionBorder, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={sectionTitle}>
                {dmPartner ? `Chat with ${dmPartner.name}` : 'General Chat'}
              </div>
              {dmPartner && (
                <button onClick={backToGeneral} style={{
                  background: 'none', border: 'none', fontSize: '11px', color: accent, cursor: 'pointer',
                }}>Back to General</button>
              )}
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px', maxHeight: '400px' }}>
              {chatMessages.length === 0 ? (
                <p style={{ fontSize: '12px', color: textMuted, textAlign: 'center', marginTop: '2rem' }}>
                  {dmPartner ? `Start a conversation with ${dmPartner.name}` : 'No messages yet. Say hello!'}
                </p>
              ) : (
                chatMessages.map(msg => {
                  const isMe = msg.authorId === user?.id;
                  return (
                    <div key={msg.id} style={{ marginBottom: '12px', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: textDark }}>{isMe ? 'You' : msg.authorName}</span>
                        <span style={{ fontSize: '10px', color: textMuted }}>{timeAgo(msg.createdAt)}</span>
                      </div>
                      <div style={{
                        padding: '8px 12px', borderRadius: '12px', maxWidth: '70%', fontSize: '13px', lineHeight: 1.5,
                        background: isMe ? textDark : bgMuted,
                        color: isMe ? '#fff' : textDark,
                      }}>
                        {msg.text}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div style={{ padding: '14px', borderTop: sectionBorder, display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder={dmPartner ? `Message ${dmPartner.name}...` : 'Message the community...'}
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !chatSending && sendMessage()}
                style={{ flex: 1, padding: '10px 12px', border: sectionBorder, fontSize: '13px' }}
              />
              <Button variant="primary" size="sm" onClick={sendMessage} disabled={!chatInput.trim() || chatSending}>
                {chatSending ? '...' : 'Send'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Community;
