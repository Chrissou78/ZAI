import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  location?: string;
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

const MEMBER_DOT_COLORS = ['#7A222E','#2563eb','#f59e0b','#10b981','#8b5cf6','#ec4899','#06b6d4','#f97316'];
const MEMBERS_PER_PAGE = 7;
const PHOTOS_PER_PAGE = 20;

// ─── Design tokens ───

const C = {
  black: '#0a0a0a', white: '#f5f4f0', red: '#7A222E', burgundy: '#7D1E2C',
  gray: '#1a1a1a', mid: '#2e2e2e', muted: '#6a6a6a', border: '#e0ddd6',
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
  s.textContent = `
    @keyframes zaiShimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
    .zai-members-scroll::-webkit-scrollbar{width:5px}
    .zai-members-scroll::-webkit-scrollbar-track{background:${C.surface}}
    .zai-members-scroll::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px}
    .zai-members-scroll::-webkit-scrollbar-thumb:hover{background:${C.muted}}
  `;
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
  if (m.city && m.country) return `${m.city}, ${m.country}`;
  if (m.city) return m.city;
  if (m.country) return m.country;
  return '—';
}

const lbl: React.CSSProperties = {
  fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase',
  color: C.muted, fontWeight: 500,
};

// ─── Small Icons ───

const HeartIcon = ({ filled = false, size = 14, color = C.muted }: { filled?: boolean; size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
);

const CommentIcon = ({ size = 14, color = C.muted }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);

const ShareIcon = ({ size = 14, color = C.muted }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
    <polyline points="16 6 12 2 8 6"/>
    <line x1="12" y1="2" x2="12" y2="15"/>
  </svg>
);

const MapPinIcon = ({ size = 12, color = C.muted }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
    <circle cx="12" cy="10" r="3"/>
  </svg>
);

const SearchIcon = ({ size = 14, color = C.muted }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

// ─── Photo Zoom (popup) — UPDATED: text beside image, landscape enlarged ───

const PhotoZoomContent: React.FC<{
  selectedPhoto: any;
  user: any;
  isAdmin: boolean;
  deletePhoto: (id: string) => void;
  fmtFullDate: (d: string) => string;
  ReactionBar: React.FC<{ photo: any }>;
  timeAgo: (d: string) => string;
  deleteComment: (photoId: string, commentId: string) => void;
  newComment: string;
  setNewComment: (v: string) => void;
  addComment: () => void;
  C: any;
  bdr: string;
}> = ({ selectedPhoto, user, isAdmin, deletePhoto, fmtFullDate, ReactionBar, timeAgo, deleteComment, newComment, setNewComment, addComment, C, bdr }) => {
  const [imgSize, setImgSize] = React.useState<{ w: number; h: number } | null>(null);
  const [isSmallScreen, setIsSmallScreen] = React.useState(false);

  React.useEffect(() => {
    const check = () => setIsSmallScreen(window.innerHeight < 700 || window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
  };

  const isLandscape = imgSize ? imgSize.w >= imgSize.h : null;

  // ── KEY CHANGE: Always use side-by-side (grid) layout for both orientations.
  //    Only fall back to vertical stacking on small screens.
  const useVerticalLayout = isSmallScreen;

  // ── KEY CHANGE: Landscape images get a much wider popup and larger image area.
  const getPopupWidth = (): string => {
    if (!imgSize || isSmallScreen) return isSmallScreen ? '96vw' : 'min(92vw, 960px)';

    if (isLandscape) {
      // Landscape: wider popup so the image is enlarged
      const maxVw = window.innerWidth * 0.94;
      return `${Math.min(1120, maxVw)}px`;
    }

    // Portrait: standard side-by-side
    return 'min(92vw, 860px)';
  };

  // ── KEY CHANGE: Grid columns adapt — landscape gets more space for image
  const getGridColumns = (): string => {
    if (isLandscape) {
      // Landscape: image takes ~65%, comments ~35%
      return `1fr clamp(260px, 30vw, 340px)`;
    }
    // Portrait: image ~60%, comments ~40%
    return `1fr clamp(260px, 35vw, 340px)`;
  };

  // Comments panel (unchanged)
  const commentsPanel = (
    <div style={{
      display: 'flex', flexDirection: 'column',
      borderLeft: useVerticalLayout ? 'none' : bdr,
      borderTop: useVerticalLayout ? bdr : 'none',
      width: '100%',
      minHeight: 0,
      flex: useVerticalLayout ? '0 1 auto' : '1 1 0%',
      maxHeight: useVerticalLayout ? '40vh' : 'none',
      overflow: 'hidden',
    }}>
      {/* Author header */}
      <div style={{ padding: '14px 16px', borderBottom: bdr, flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', background: C.mid, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11px', color: C.white, fontWeight: 500,
            }}>
              {(selectedPhoto.authorName?.charAt(0) || 'M').toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: C.black }}>{selectedPhoto.authorName}</div>
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
          <p style={{
            fontSize: '12px', color: C.gray, margin: '10px 0 0', lineHeight: 1.55, fontWeight: 300,
            ...(isSmallScreen ? { maxHeight: '3em', overflow: 'hidden', textOverflow: 'ellipsis' } : {}),
          }}>{selectedPhoto.caption}</p>
        )}
        {selectedPhoto.location && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
            <MapPinIcon size={11} color={C.muted} />
            <span style={{ fontSize: '10px', color: C.muted }}>{selectedPhoto.location}</span>
          </div>
        )}
        <div style={{ marginTop: 10 }}>
          <ReactionBar photo={selectedPhoto} />
        </div>
      </div>
      {/* Comments list */}
      <div style={{
        flex: '1 1 auto', overflowY: 'auto', padding: '12px 16px', minHeight: 0,
      }}>
        {(!selectedPhoto.comments || selectedPhoto.comments.length === 0) ? (
          <p style={{ fontSize: '12px', color: C.muted, textAlign: 'center', marginTop: 16 }}>No comments yet</p>
        ) : (
          selectedPhoto.comments.map((c: any) => (
            <div key={c.id} style={{ marginBottom: 14 }}>
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
      <div style={{ padding: '10px 16px', borderTop: bdr, display: 'flex', gap: '1px', flexShrink: 0 }}>
        <input type="text" placeholder="Add a comment..." value={newComment}
          onChange={e => setNewComment(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addComment()}
          style={{ flex: 1, padding: '9px 10px', border: bdr, fontSize: '12px', fontFamily: "'Inter',sans-serif", background: C.pureWhite, color: C.black, outline: 'none', borderRadius: '4px 0 0 4px' }} />
        <button onClick={addComment} disabled={!newComment.trim()}
          style={{
            padding: '9px 14px', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase',
            background: newComment.trim() ? C.black : C.muted, color: C.white, border: 'none',
            cursor: newComment.trim() ? 'pointer' : 'not-allowed', fontFamily: "'Inter',sans-serif", fontWeight: 500,
            borderRadius: '0 4px 4px 0',
          }}>Post</button>
      </div>
    </div>
  );

  return (
    <div onClick={e => e.stopPropagation()}
      style={{
        background: C.white,
        width: getPopupWidth(),
        maxHeight: '92vh',
        // ── KEY CHANGE: always grid (side-by-side) unless small screen
        display: imgSize === null ? 'flex' : (useVerticalLayout ? 'flex' : 'grid'),
        flexDirection: useVerticalLayout ? 'column' : undefined,
        gridTemplateColumns: useVerticalLayout ? undefined : getGridColumns(),
        gridTemplateRows: useVerticalLayout ? undefined : '1fr',
        boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
        overflow: useVerticalLayout ? 'auto' : 'hidden',
        borderRadius: 6,
        alignItems: imgSize === null ? 'center' : undefined,
        justifyContent: imgSize === null ? 'center' : undefined,
      }}>

      {/* Loading placeholder */}
      {imgSize === null && (
        <div style={{ padding: 40, textAlign: 'center', color: C.gray, fontSize: 13 }}>
          Loading…
          <img src={selectedPhoto.url} alt="" onLoad={handleImageLoad} style={{ display: 'none' }} />
        </div>
      )}

      {/* Layout once dimensions known */}
      {imgSize !== null && (
        <>
          {/* ── KEY CHANGE: image always beside text in grid mode;
              landscape images get a taller max-height so they appear enlarged ── */}
          <img
            src={selectedPhoto.url}
            alt={selectedPhoto.caption}
            style={{
              width: '100%',
              height: useVerticalLayout ? 'auto' : '100%',
              maxHeight: isSmallScreen
                ? '45vh'
                : useVerticalLayout
                  ? '55vh'
                  : isLandscape
                    ? '92vh'   // landscape: let the image fill more vertical space
                    : '90vh',
              objectFit: useVerticalLayout ? 'cover' : 'contain',
              display: 'block',
              flexShrink: 0,
              background: C.black,
            }}
          />
          {commentsPanel}
        </>
      )}
    </div>
  );
};

// ═══════════════════════════════════
//  COMPONENT
// ═══════════════════════════════════

// ═══════════════════════════════════
//  ZAI INSIGHTS — exclusive media & stories
//  (moved here from the old "Media & Stories" tab on Deals & Collectibles)
// ═══════════════════════════════════

function ZaiInsights({ stories, fmtDate, C }: { stories: any[]; fmtDate: (d: string) => string; C: any }) {
  const RED_LABEL: React.CSSProperties = {
    fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: C.red, fontWeight: 500,
  };

  const featuredStory = stories.find(s => s.featured) || stories[0];
  const regularStories = stories.filter(s => s !== featuredStory);

  if (!stories.length) {
    return (
      <div style={{ textAlign: 'center', padding: 48, color: C.muted, fontSize: 14 }}>
        No stories yet. Check back soon.
      </div>
    );
  }

  return (
    <div>
      {featuredStory && (
        <>
          <div style={RED_LABEL}>TOP STORY</div>
          <div style={{
            background: C.black, borderRadius: 10, overflow: 'hidden',
            marginTop: 12, marginBottom: 32, position: 'relative', color: C.white,
          }}>
            {featuredStory.thumbnail_url && (
              <img src={featuredStory.thumbnail_url} alt="" style={{ width: '100%', height: 280, objectFit: 'cover', opacity: 0.5 }} />
            )}
            {!featuredStory.thumbnail_url && <div style={{ height: 280, background: 'linear-gradient(135deg, #1a1a1a, #333)' }} />}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '28px 32px' }}>
              {featuredStory.media_type === 'video' && (
                <div style={{ position: 'absolute', top: 16, left: 16, fontSize: 10, fontWeight: 600, background: C.red, padding: '4px 10px', borderRadius: 3 }}>
                  ▶ VIDEO{featuredStory.duration ? ` · ${featuredStory.duration}` : ''}
                </div>
              )}
              {featuredStory.media_type === 'video' && (
                <div style={{ position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%,-50%)', width: 56, height: 56, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <span style={{ fontSize: 20, marginLeft: 3 }}>▶</span>
                </div>
              )}
              <div style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#999', marginBottom: 8 }}>
                {featuredStory.category} · EXCLUSIVE
              </div>
              <h2 style={{ fontSize: 'clamp(18px, 2.5vw, 26px)', fontWeight: 400, margin: '0 0 6px' }}>{featuredStory.title}</h2>
              <div style={{ fontSize: 13, color: '#aaa' }}>{featuredStory.description}</div>
            </div>
          </div>
        </>
      )}

      <div style={RED_LABEL}>ALL STORIES</div>
      <div style={{ marginTop: 16 }}>
        {regularStories.map(story => (
          <div key={story.id} style={{
            display: 'flex', gap: 16, padding: '16px 0',
            borderBottom: `1px solid ${C.border}`, alignItems: 'center',
          }}>
            <div style={{
              width: 72, height: 56, borderRadius: 6, overflow: 'hidden',
              background: C.surface, flexShrink: 0, position: 'relative',
            }}>
              {story.thumbnail_url
                ? <img src={story.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: C.muted, textTransform: 'uppercase' }}>{story.media_type}</div>
              }
              {story.media_type === 'video' && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 10, padding: '2px 6px', borderRadius: 2 }}>▶</span>
                </div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.red, fontWeight: 500, marginBottom: 3 }}>
                {story.media_type === 'video' ? '▶ ' : ''}{story.media_type} · {story.category}
                {story.media_type === 'product_launch' && ' ●'}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2, color: C.black }}>{story.title}</div>
              <div style={{ fontSize: 12, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{story.description}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 11, color: C.muted }}>{fmtDate(story.published_at)}</div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 4, cursor: 'pointer', color: C.black }}>
                {story.media_type === 'video' ? 'WATCH →' : story.media_type === 'photo' ? 'VIEW →' : 'READ →'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const Community: React.FC = () => {
  const { user } = useAppContext();
  const [isAdmin, setIsAdmin] = useState(false);

  const [members, setMembers] = useState<Member[]>([]);
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

  // Photo pagination
  const [photoPage, setPhotoPage] = useState(1);

  // Members directory state
  const [memberSearch, setMemberSearch] = useState('');
  const [memberPage, setMemberPage] = useState(1);

  // zai Insights (media & stories, moved here from the old Updates page)
  const [mainTab, setMainTab] = useState<'feed' | 'insights'>('feed');
  const [stories, setStories] = useState<any[]>([]);

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
      const res = await apiService.get('/community/gallery', { params: { limit: 200, offset: 0 } });
      if (res.data?.success) {
        setPhotos(res.data.data || []);
        if (res.data.isAdmin !== undefined) setIsAdmin(res.data.isAdmin);
      }
    } catch (err) { console.error('Error fetching gallery:', err); }
  }, []);

  const fetchStories = useCallback(async () => {
    try {
      const res = await apiService.get('/store/media');
      if (res.data?.success) setStories(res.data.data || []);
    } catch (err) { console.error('Error fetching zai insights:', err); }
  }, []);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await Promise.all([fetchMembers(), fetchStats(), fetchPhotos(), fetchStories()]);
      setIsLoading(false);
    })();
  }, [fetchMembers, fetchStats, fetchPhotos, fetchStories]);

  // ─── Photo pagination ───

  const totalPhotoPages = Math.max(1, Math.ceil(photos.length / PHOTOS_PER_PAGE));

  const pagedPhotos = useMemo(
    () => photos.slice((photoPage - 1) * PHOTOS_PER_PAGE, photoPage * PHOTOS_PER_PAGE),
    [photos, photoPage],
  );

  // Split paged photos into two columns for masonry
  const leftCol = useMemo(() => pagedPhotos.filter((_, i) => i % 2 === 0), [pagedPhotos]);
  const rightCol = useMemo(() => pagedPhotos.filter((_, i) => i % 2 !== 0), [pagedPhotos]);

  // Scroll to top of feed when page changes
  useEffect(() => {
    if (photoPage > 1) {
      document.getElementById('zai-feed-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [photoPage]);

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
        setPhotoPage(1);
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

  // ─── Members directory ───

  const filteredMembers = members.filter(m =>
    m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
    getMemberLocation(m).toLowerCase().includes(memberSearch.toLowerCase())
  );
  const totalMemberPages = Math.max(1, Math.ceil(filteredMembers.length / MEMBERS_PER_PAGE));
  const pagedMembers = filteredMembers.slice((memberPage - 1) * MEMBERS_PER_PAGE, memberPage * MEMBERS_PER_PAGE);

  useEffect(() => { setMemberPage(1); }, [memberSearch]);

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
              cursor: 'pointer', borderRadius: 3,
            }}>
            <span>{emoji}</span>
            <span style={{ fontSize: '10px', fontWeight: 600, color: info.reacted ? C.red : C.muted }}>{info.count}</span>
          </button>
        ))}
        <button onClick={e => openEmojiPicker(e, photo.id)}
          style={{
            marginLeft: hasReactions ? 4 : 0, width: 28, height: 28, border: bdr,
            background: emojiPickerPhotoId === photo.id ? C.surface : C.pureWhite,
            fontSize: '14px', color: C.muted, cursor: 'pointer', borderRadius: 3,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          title="Add reaction">
          {emojiPickerPhotoId === photo.id ? '×' : '😊'}
        </button>
      </div>
    );
  };

  // ─── Photo Card (UNCHANGED — original masonry card) ───

  const PhotoCard = ({ photo }: { photo: Photo }) => {
    const reactionCount = (photo.reactions || []).length;
    return (
      <div style={{ background: C.pureWhite, border: bdr, borderRadius: 6, overflow: 'hidden', breakInside: 'avoid', marginBottom: 20 }}>
        <div onClick={() => openPhoto(photo.id)} style={{ cursor: 'pointer', position: 'relative', overflow: 'hidden' }}>
          <img src={photo.url} alt={photo.caption} loading="lazy" decoding="async"
            style={{ width: '100%', display: 'block', objectFit: 'cover' }} />
        </div>
        <div style={{ padding: '12px 14px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', background: C.mid, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '12px', color: C.white, fontWeight: 500,
          }}>
            {(photo.authorName?.charAt(0) || 'M').toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: C.black }}>{photo.authorName}</div>
          </div>
          <span style={{ fontSize: '10px', color: C.muted, flexShrink: 0 }}>{fmtFullDate(photo.createdAt)}</span>
          {isAdmin && (
            <button onClick={() => deletePhoto(photo.id)} title="Delete (admin)"
              style={{ background: 'none', border: 'none', fontSize: '13px', color: C.red, cursor: 'pointer', padding: '2px 4px', flexShrink: 0 }}>×</button>
          )}
        </div>
        {photo.caption && (
          <p style={{
            fontSize: '12px', color: C.gray, margin: 0, padding: '10px 14px 0',
            lineHeight: 1.6, fontWeight: 300, fontStyle: 'italic',
          }}>
            &ldquo;{photo.caption}&rdquo;
          </p>
        )}
        <div style={{
          padding: '10px 14px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderTop: `1px solid ${C.surface2}`, marginTop: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <MapPinIcon size={11} color={C.muted} />
            <span style={{ fontSize: '10px', color: C.muted, letterSpacing: '0.02em' }}>
              {photo.location || ''}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={e => { e.stopPropagation(); openEmojiPicker(e, photo.id); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, padding: 0 }}>
              <HeartIcon size={13} color={C.muted} />
              {reactionCount > 0 && <span style={{ fontSize: '10px', color: C.muted }}>{reactionCount}</span>}
            </button>
            <button onClick={() => openPhoto(photo.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, padding: 0 }}>
              <CommentIcon size={13} color={C.muted} />
              {photo.commentCount > 0 && <span style={{ fontSize: '10px', color: C.muted }}>{photo.commentCount}</span>}
            </button>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}>
              <ShareIcon size={13} color={C.muted} />
            </button>
            <div style={{ display: 'flex', gap: 3, marginLeft: 4 }}>
              {MEMBER_DOT_COLORS.slice(0, Math.min(4, Math.max(1, reactionCount))).map((c, i) => (
                <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── Pagination bar (shared) ───

  const PaginationBar: React.FC<{
    current: number;
    total: number;
    onChange: (p: number) => void;
    itemCount: number;
    label?: string;
  }> = ({ current, total, onChange, itemCount, label = 'posts' }) => {
    if (total <= 1) return null;

    const pages: (number | '…')[] = [];
    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      if (current > 3) pages.push('…');
      const start = Math.max(2, current - 1);
      const end = Math.min(total - 1, current + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (current < total - 2) pages.push('…');
      pages.push(total);
    }

    return (
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        gap: 6, padding: '28px 0 8px', flexWrap: 'wrap',
      }}>
        <button
          disabled={current <= 1}
          onClick={() => onChange(Math.max(1, current - 1))}
          style={{
            padding: '7px 14px', fontSize: 11, fontWeight: 600,
            border: bdr, borderRadius: 4, fontFamily: "'Inter',sans-serif",
            background: C.pureWhite,
            color: current <= 1 ? C.border : C.mid,
            cursor: current <= 1 ? 'default' : 'pointer',
          }}
        >
          ← Prev
        </button>

        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`e${i}`} style={{ fontSize: 12, color: C.muted, padding: '0 2px' }}>…</span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p as number)}
              style={{
                width: 32, height: 32, fontSize: 12,
                fontWeight: p === current ? 700 : 500,
                border: p === current ? `1px solid ${C.black}` : bdr,
                borderRadius: 4, fontFamily: "'Inter',sans-serif",
                background: p === current ? C.black : C.pureWhite,
                color: p === current ? '#fff' : C.mid,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {p}
            </button>
          )
        )}

        <button
          disabled={current >= total}
          onClick={() => onChange(Math.min(total, current + 1))}
          style={{
            padding: '7px 14px', fontSize: 11, fontWeight: 600,
            border: bdr, borderRadius: 4, fontFamily: "'Inter',sans-serif",
            background: C.pureWhite,
            color: current >= total ? C.border : C.mid,
            cursor: current >= total ? 'default' : 'pointer',
          }}
        >
          Next →
        </button>

        <span style={{ fontSize: 11, color: C.muted, marginLeft: 8 }}>
          {itemCount} {label}
        </span>
      </div>
    );
  };

  // ═══════════════════════════════
  //  LOADING
  // ═══════════════════════════════

  if (isLoading) {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 40px 80px', fontFamily: "'Inter',sans-serif" }}>
        <Sk w="90px" h="10px" s={{ marginBottom: 10 }} />
        <Sk w="240px" h="38px" s={{ marginBottom: 8 }} />
        <Sk w="380px" h="13px" s={{ marginBottom: 36 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 32 }}>
          <div style={{ columns: 2, columnGap: 20 }}>
            {[0,1,2,3].map(i => <Sk key={i} w="100%" h={i % 2 === 0 ? '320px' : '260px'} s={{ marginBottom: 20, breakInside: 'avoid' }} />)}
          </div>
          <div>
            <Sk w="100%" h="180px" s={{ marginBottom: 16 }} />
            <Sk w="100%" h="300px" s={{ marginBottom: 16 }} />
            <Sk w="100%" h="200px" />
          </div>
        </div>
      </div>
    );
  }

  const totalCount = stats.totalMembers || members.length;

  // ═══════════════════════════════
  //  RENDER
  // ═══════════════════════════════

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 40px 80px', fontFamily: "'Inter',sans-serif", color: C.gray }}>

      {/* ══════ PAGE HEADER ══════ */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ ...lbl, color: C.red, letterSpacing: '0.3em', marginBottom: 8, fontSize: '10px' }}>ZAI ECOSYSTEM</div>
        <h1 style={{ fontSize: 'clamp(32px, 4vw, 40px)', fontWeight: 300, lineHeight: 1.15, margin: '0 0 8px', color: C.black }}>
          Community
        </h1>
        <p style={{ color: C.muted, fontSize: '14px', margin: 0, fontWeight: 300 }}>
          A global family of zai owners — connected by the mountain.
        </p>
      </div>

      {/* ══════ TABS ══════ */}
      <div id="zai-feed-top" style={{
        display: 'flex', alignItems: 'center', gap: 24, marginBottom: 28,
        borderBottom: bdr, paddingBottom: 0,
      }}>
        <button onClick={() => setMainTab('feed')} style={{
          background: 'none', border: 'none', borderBottom: mainTab === 'feed' ? `2px solid ${C.black}` : '2px solid transparent',
          padding: '10px 0', fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase',
          fontWeight: mainTab === 'feed' ? 600 : 400, color: mainTab === 'feed' ? C.black : C.muted,
          cursor: 'pointer', fontFamily: "'Inter',sans-serif",
        }}>
          ALL STORIES
        </button>
        <button onClick={() => setMainTab('insights')} style={{
          background: 'none', border: 'none', borderBottom: mainTab === 'insights' ? `2px solid ${C.black}` : '2px solid transparent',
          padding: '10px 0', fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase',
          fontWeight: mainTab === 'insights' ? 600 : 400, color: mainTab === 'insights' ? C.black : C.muted,
          cursor: 'pointer', fontFamily: "'Inter',sans-serif",
        }}>
          zai Insights
        </button>
        {mainTab === 'feed' && (
          <span style={{
            padding: '10px 0', fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase',
            color: C.muted, fontWeight: 400, borderBottom: '2px solid transparent',
          }}>
            {photos.length} POST{photos.length !== 1 ? 'S' : ''}
          </span>
        )}
      </div>

      {mainTab === 'insights' ? (
        <ZaiInsights stories={stories} fmtDate={fmtFullDate} C={C} />
      ) : (
      <>
      {/* ══════ MAIN GRID ══════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 32, alignItems: 'start' }}>

        {/* ──── LEFT: Masonry photo grid (paginated) — UNCHANGED ──── */}
        <div>
          {photos.length === 0 ? (
            <div style={{ padding: '60px 24px', textAlign: 'center', background: C.surface, border: bdr, borderRadius: 6 }}>
              <div style={{ fontSize: '40px', marginBottom: 12, opacity: 0.15 }}>📷</div>
              <div style={{ fontSize: '15px', fontWeight: 300, color: C.black, marginBottom: 4 }}>No posts yet</div>
              <p style={{ color: C.muted, fontSize: '12px', margin: 0 }}>Be the first to share your zai moment!</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 20 }}>
                <div style={{ flex: 1 }}>
                  {leftCol.map(photo => <PhotoCard key={photo.id} photo={photo} />)}
                </div>
                <div style={{ flex: 1 }}>
                  {rightCol.map(photo => <PhotoCard key={photo.id} photo={photo} />)}
                </div>
              </div>

              {/* Photo feed pagination */}
              <PaginationBar
                current={photoPage}
                total={totalPhotoPages}
                onChange={setPhotoPage}
                itemCount={photos.length}
                label="posts"
              />
            </>
          )}
        </div>

        {/* ──── RIGHT: Sidebar widgets ──── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, position: 'sticky', top: 24 }}>

          {/* SHARE YOUR JOURNEY */}
          <div style={{ border: bdr, background: C.pureWhite, padding: '20px', borderRadius: 6 }}>
            <div style={{ ...lbl, fontSize: '10px', letterSpacing: '0.22em', marginBottom: 12, color: C.gray, fontWeight: 600 }}>
              SHARE YOUR JOURNEY
            </div>
            <p style={{ fontSize: '12px', color: C.muted, lineHeight: 1.55, margin: '0 0 16px', fontWeight: 300 }}>
              Upload a high-fidelity image from your zai winter adventure. Tell the community about the performance, powder conditions, or alpine peaks.
            </p>
            <button onClick={() => setShowUpload(true)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                width: '100%', padding: '11px', background: C.red, color: '#fff',
                fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
                border: 'none', cursor: 'pointer', borderRadius: 5,
                fontFamily: "'Inter',sans-serif", transition: 'background .2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = C.burgundy)}
              onMouseLeave={e => (e.currentTarget.style.background = C.red)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              UPLOAD & SHARE PHOTO
            </button>
          </div>

          {/* DIRECTORY — ZAI MEMBERS */}
          <div style={{ border: bdr, background: C.pureWhite, borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ ...lbl, fontSize: '10px', letterSpacing: '0.22em', color: C.gray, fontWeight: 600 }}>DIRECTORY</span>
              <span style={{ ...lbl, fontSize: '9px', letterSpacing: '0.18em', color: C.red, fontWeight: 600 }}>ZAI MEMBERS</span>
            </div>
            <div style={{ padding: '0 20px 4px', fontSize: '10px', color: C.muted }}>{totalCount} registered</div>
            <div style={{ padding: '8px 20px 12px', position: 'relative' }}>
              <div style={{ position: 'absolute', left: 28, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <SearchIcon size={12} color={C.muted} />
              </div>
              <input type="text" placeholder="Search members or locations..."
                value={memberSearch} onChange={e => setMemberSearch(e.target.value)}
                style={{
                  width: '100%', padding: '8px 10px 8px 28px', border: bdr, fontSize: '11px',
                  fontFamily: "'Inter',sans-serif", background: C.surface, color: C.black,
                  boxSizing: 'border-box', borderRadius: 4, outline: 'none',
                }} />
            </div>
            <div style={{ borderTop: bdr }}>
              {pagedMembers.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', fontSize: '11px', color: C.muted }}>No members found</div>
              ) : (
                pagedMembers.map((m, idx) => {
                  const globalIdx = (memberPage - 1) * MEMBERS_PER_PAGE + idx;
                  return (
                    <div key={m.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px',
                      borderBottom: bdr, opacity: m.isBlocked ? 0.4 : 1,
                      transition: 'background .15s', cursor: 'default',
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = C.surface)}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <div style={{
                        width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                        background: m.isBlocked ? C.muted : getMemberDotColor(globalIdx),
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12px', fontWeight: 500, color: C.black, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                          <span style={{
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            maxWidth: 140, display: 'inline-block', flexShrink: 1,
                          }}>{m.name}</span>
                          {m.isBlocked && (
                            <span style={{
                              fontSize: '7px', padding: '1px 4px', letterSpacing: '0.1em', textTransform: 'uppercase',
                              background: 'rgba(200,16,46,0.08)', color: C.red, fontWeight: 600, flexShrink: 0,
                            }}>blocked</span>
                          )}
                        </div>
                        <div style={{
                          fontSize: '10px', color: C.muted, marginTop: 1,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{getMemberLocation(m)}</div>
                      </div>
                      <div style={{ fontSize: '10px', color: C.muted, flexShrink: 0, textAlign: 'right' }}>
                        {fmtDate(m.joinedAt)}
                      </div>
                      {isAdmin && (
                        <div style={{ flexShrink: 0, marginLeft: 4 }}>
                          {m.isBlocked ? (
                            <button onClick={() => unblockMember(m.id)}
                              style={{ fontSize: '8px', padding: '2px 5px', background: C.surface, color: C.gray, border: bdr, cursor: 'pointer', fontFamily: "'Inter',sans-serif", borderRadius: 2 }}>
                              Unblock
                            </button>
                          ) : (
                            <button onClick={() => blockMember(m.id, m.name)}
                              style={{ fontSize: '8px', padding: '2px 5px', background: 'rgba(200,16,46,0.05)', color: C.red, border: '1px solid rgba(200,16,46,0.12)', cursor: 'pointer', fontFamily: "'Inter',sans-serif", borderRadius: 2 }}>
                              Block
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 20px', borderTop: bdr,
            }}>
              <button onClick={() => setMemberPage(p => Math.max(1, p - 1))} disabled={memberPage <= 1}
                style={{
                  background: 'none', border: 'none', fontSize: '10px', color: memberPage <= 1 ? C.border : C.muted,
                  cursor: memberPage <= 1 ? 'default' : 'pointer', fontFamily: "'Inter',sans-serif", letterSpacing: '0.05em',
                }}>‹ PREV</button>
              <span style={{ fontSize: '10px', color: C.muted }}>Page {memberPage} of {totalMemberPages}</span>
              <button onClick={() => setMemberPage(p => Math.min(totalMemberPages, p + 1))} disabled={memberPage >= totalMemberPages}
                style={{
                  background: 'none', border: 'none', fontSize: '10px',
                  color: memberPage >= totalMemberPages ? C.border : C.muted,
                  cursor: memberPage >= totalMemberPages ? 'default' : 'pointer',
                  fontFamily: "'Inter',sans-serif", letterSpacing: '0.05em',
                }}>NEXT ›</button>
            </div>
          </div>

          {/* FOLLOW ZAI */}
          <div style={{ border: bdr, background: C.pureWhite, padding: '20px', borderRadius: 6 }}>
            <div style={{ ...lbl, fontSize: '9px', letterSpacing: '0.22em', marginBottom: 2, color: C.muted, fontWeight: 400 }}>
              FOLLOW ZAI
            </div>
            <div style={{ ...lbl, fontSize: '10px', letterSpacing: '0.22em', marginBottom: 12, color: C.gray, fontWeight: 600 }}>
              STAY IN THE LOOP
            </div>
            <p style={{ fontSize: '11px', color: C.muted, lineHeight: 1.55, margin: '0 0 16px', fontWeight: 300 }}>
              Follow our WhatsApp channel for event announcements, new model drops, and exclusive stories from the Davos manufactory.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', background: C.green, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.553 4.122 1.523 5.86L0 24l6.335-1.652A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.82c-1.977 0-3.865-.527-5.518-1.523l-.396-.234-3.763.982.998-3.648-.257-.41A9.794 9.794 0 012.18 12C2.18 6.583 6.583 2.18 12 2.18S21.82 6.583 21.82 12 17.417 21.82 12 21.82z"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 500, color: C.black }}>zai Experience Club</div>
                <div style={{ fontSize: '9px', color: C.muted }}>1,843 followers · Updated weekly</div>
              </div>
            </div>
            <a href="https://whatsapp.com/channel/YOUR_CHANNEL_ID" target="_blank" rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                width: '100%', padding: '11px', background: C.green, color: '#fff',
                textDecoration: 'none', fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em',
                textTransform: 'uppercase', borderRadius: 5, transition: 'opacity .2s',
                fontFamily: "'Inter',sans-serif", border: 'none', boxSizing: 'border-box',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.553 4.122 1.523 5.86L0 24l6.335-1.652A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.82c-1.977 0-3.865-.527-5.518-1.523l-.396-.234-3.763.982.998-3.648-.257-.41A9.794 9.794 0 012.18 12C2.18 6.583 6.583 2.18 12 2.18S21.82 6.583 21.82 12 17.417 21.82 12 21.82z"/>
              </svg>
              FOLLOW WHATSAPP CHANNEL
            </a>
            <p style={{ fontSize: '9px', color: C.muted, margin: '10px 0 0', textAlign: 'center', fontWeight: 300 }}>
              You will be redirected to WhatsApp. No personal data is shared.
            </p>
          </div>
        </div>
      </div>
      </>
      )}

      {/* ══════ UPLOAD MODAL ══════ */}
      {showUpload && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.8)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '2rem',
        }}
          onClick={() => { setShowUpload(false); setUploadFile(null); setUploadPreview(null); setUploadCaption(''); }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: C.white, maxWidth: 520, width: '100%', boxShadow: '0 24px 80px rgba(0,0,0,0.4)', borderRadius: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: bdr }}>
              <span style={{ ...lbl, fontSize: '11px', letterSpacing: '0.22em', color: C.gray, fontWeight: 600 }}>UPLOAD & SHARE</span>
              <button onClick={() => { setShowUpload(false); setUploadFile(null); setUploadPreview(null); setUploadCaption(''); }}
                style={{ background: 'none', border: 'none', fontSize: '18px', color: C.muted, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ padding: '24px' }}>
              {!uploadPreview ? (
                <label style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: '48px 20px', border: `2px dashed ${C.border}`, cursor: 'pointer',
                  color: C.muted, fontSize: '12px', textAlign: 'center', borderRadius: 6,
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
              {uploadPreview && (
                <>
                  <div style={{ ...lbl, marginBottom: 6, marginTop: 4 }}>CAPTION</div>
                  <textarea placeholder="Tell us about this moment..." value={uploadCaption}
                    onChange={e => setUploadCaption(e.target.value)} rows={3}
                    style={{
                      width: '100%', padding: '10px 12px', border: bdr, fontSize: '13px',
                      boxSizing: 'border-box', fontFamily: "'Inter',sans-serif", resize: 'vertical',
                      background: C.pureWhite, color: C.black, marginBottom: 16, borderRadius: 4,
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
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          padding: 'clamp(0.5rem, 2vw, 2rem)',
        }}
          onClick={() => { setSelectedPhoto(null); setEmojiPickerPhotoId(null); setEmojiPickerPos(null); }}>
          <PhotoZoomContent
            selectedPhoto={selectedPhoto}
            user={user}
            isAdmin={isAdmin}
            deletePhoto={deletePhoto}
            fmtFullDate={fmtFullDate}
            ReactionBar={ReactionBar}
            timeAgo={timeAgo}
            deleteComment={deleteComment}
            newComment={newComment}
            setNewComment={setNewComment}
            addComment={addComment}
            C={C}
            bdr={bdr}
          />
        </div>
      )}

      {/* ══════ EMOJI PICKER ══════ */}
      {emojiPickerPhotoId && emojiPickerPos && (
        <div style={{
          position: 'fixed',
          top: Math.min(emojiPickerPos.top, window.innerHeight - 240),
          left: Math.min(emojiPickerPos.left, window.innerWidth - 220),
          zIndex: 2000, background: C.pureWhite, border: bdr,
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)', borderRadius: 6,
          padding: 10, display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 3, width: 200,
        }}
          onClick={e => e.stopPropagation()}>
          {REACTION_EMOJIS.map(emoji => (
            <button key={emoji} onClick={() => toggleReaction(emojiPickerPhotoId!, emoji)}
              style={{
                width: 28, height: 28, border: 'none', background: 'transparent',
                fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'transform .1s', borderRadius: 4,
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
