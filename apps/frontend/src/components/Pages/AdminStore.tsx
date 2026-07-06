import { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../../context/AppContext';
import { apiService } from '../../services/api';

const C = {
  black: '#0a0a0a', white: '#f5f4f0', red: '#7A222E',
  gray: '#6a6a6a', border: '#e0ddd6', surface: '#f0ede6',
  pureWhite: '#ffffff', green: '#4caf7d', font: "'Inter', sans-serif",
  mid: '#2e2e2e',
};
const BR = `1px solid ${C.border}`;
const LABEL: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase',
  color: C.gray, fontWeight: 500, marginBottom: 6,
};
const RED_LABEL: React.CSSProperties = {
  fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase',
  color: C.red, fontWeight: 500, fontFamily: C.font,
};
const INPUT: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: BR, fontSize: 13,
  fontFamily: C.font, borderRadius: 4, boxSizing: 'border-box' as const,
  background: C.pureWhite,
};
const BTN_PRIMARY: React.CSSProperties = {
  padding: '10px 20px', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
  textTransform: 'uppercase', border: 'none', borderRadius: 4,
  background: C.red, color: '#fff', cursor: 'pointer', fontFamily: C.font,
};
const BTN_SECONDARY: React.CSSProperties = {
  ...BTN_PRIMARY, background: 'transparent', border: `1px solid ${C.border}`, color: C.mid,
};
const BTN_DANGER: React.CSSProperties = {
  ...BTN_PRIMARY, background: 'transparent', border: `1px solid ${C.red}`, color: C.red,
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={LABEL}>{label}</div>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
      <div style={{
        position: 'relative', background: C.pureWhite, borderRadius: 12, padding: '28px',
        width: '100%', maxWidth: 540, maxHeight: '90vh', overflow: 'auto',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 400, margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: C.gray }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// DEALS MANAGER
// ═══════════════════════════════════════════════════════════
function DealsManager() {
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null); // null = closed, {} = new, {id:...} = edit
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiService.get('/store/deals');
      if (r.data?.success) setDeals(r.data.data || []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      if (editing.id) {
        await apiService.put(`/store/deals/admin/${editing.id}`, editing);
      } else {
        await apiService.post('/store/deals/admin', editing);
      }
      setEditing(null);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Save failed');
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm('Deactivate this deal?')) return;
    try {
      await apiService.delete(`/store/deals/admin/${id}`);
      load();
    } catch {}
  };

  const set = (key: string, val: any) => setEditing((p: any) => ({ ...p, [key]: val }));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: C.gray }}>{deals.length} deal{deals.length !== 1 ? 's' : ''}</div>
        <button style={BTN_PRIMARY} onClick={() => setEditing({
          title: '', description: '', category: 'accessories', price_chf: '',
          max_points_discount: 0, image_url: '', ends_at: '', spots_total: 0,
          members_only: true, featured: false,
        })}>+ New Deal</button>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 32, color: C.gray, fontSize: 13 }}>Loading…</div>}

      {!loading && deals.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48, color: C.gray, fontSize: 14 }}>No deals yet. Create your first deal.</div>
      )}

      {!loading && deals.map(d => (
        <div key={d.id} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 16px', border: BR, borderRadius: 8, marginBottom: 8,
          background: C.pureWhite,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{d.title}</span>
              {d.featured && <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 6px', background: C.red, color: '#fff', borderRadius: 2, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Featured</span>}
              {d.members_only && <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 6px', background: C.black, color: '#fff', borderRadius: 2, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Members</span>}
            </div>
            <div style={{ fontSize: 12, color: C.gray }}>
              CHF {parseFloat(d.price_chf).toLocaleString('de-CH')} · {d.category}
              {d.ends_at && ` · Ends ${new Date(d.ends_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
              {d.spots_total > 0 && ` · ${d.spots_left}/${d.spots_total} spots`}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button style={BTN_SECONDARY} onClick={() => setEditing({ ...d, price_chf: String(d.price_chf) })}>Edit</button>
            <button style={BTN_DANGER} onClick={() => remove(d.id)}>Remove</button>
          </div>
        </div>
      ))}

      {editing && (
        <Modal title={editing.id ? 'Edit Deal' : 'New Deal'} onClose={() => setEditing(null)}>
          <Field label="Title">
            <input style={INPUT} value={editing.title || ''} onChange={e => set('title', e.target.value)} placeholder="zai Sunglasses" />
          </Field>
          <Field label="Description">
            <textarea style={{ ...INPUT, minHeight: 60, resize: 'vertical' }} value={editing.description || ''} onChange={e => set('description', e.target.value)} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Category">
              <select style={INPUT} value={editing.category || 'accessories'} onChange={e => set('category', e.target.value)}>
                <option value="accessories">Accessories</option>
                <option value="apparel">Apparel</option>
                <option value="skis">Skis</option>
                <option value="event">Event</option>
                <option value="experience">Experience</option>
              </select>
            </Field>
            <Field label="Price (CHF)">
              <input style={INPUT} type="number" step="0.01" value={editing.price_chf || ''} onChange={e => set('price_chf', e.target.value)} />
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Max Points Discount">
              <input style={INPUT} type="number" value={editing.max_points_discount || 0} onChange={e => set('max_points_discount', parseInt(e.target.value) || 0)} />
            </Field>
            <Field label="Total Spots (0 = unlimited)">
              <input style={INPUT} type="number" value={editing.spots_total || 0} onChange={e => set('spots_total', parseInt(e.target.value) || 0)} />
            </Field>
          </div>
          <Field label="Image URL">
            <input style={INPUT} value={editing.image_url || ''} onChange={e => set('image_url', e.target.value)} placeholder="https://..." />
          </Field>
          <Field label="Ends At">
            <input style={INPUT} type="datetime-local" value={editing.ends_at ? editing.ends_at.slice(0, 16) : ''} onChange={e => set('ends_at', e.target.value ? new Date(e.target.value).toISOString() : null)} />
          </Field>
          <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
            <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={editing.members_only !== false} onChange={e => set('members_only', e.target.checked)} />
              Members Only
            </label>
            <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={editing.featured === true} onChange={e => set('featured', e.target.checked)} />
              Featured
            </label>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button style={BTN_SECONDARY} onClick={() => setEditing(null)}>Cancel</button>
            <button style={{ ...BTN_PRIMARY, opacity: saving ? 0.6 : 1 }} onClick={save} disabled={saving || !editing.title || !editing.price_chf}>
              {saving ? 'Saving…' : editing.id ? 'Update' : 'Create'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// COLLECTIBLES MANAGER
// ═══════════════════════════════════════════════════════════
function CollectiblesManager() {
  const [series, setSeries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiService.get('/store/collectibles/series');
      if (r.data?.success) setSeries(r.data.data || []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // For now, collectibles are managed via Engage (NFTs) + DB seed.
  // This panel shows current state and allows future inline editing.

  return (
    <div>
      <div style={{ padding: '16px 20px', background: C.surface, borderRadius: 8, marginBottom: 20, border: BR }}>
        <div style={{ fontSize: 13, color: C.gray, lineHeight: 1.6 }}>
          Collectible drops are created via the database and linked to Engage NFTs.
          This panel shows the current state of all series and cards.
          To add a new series or card, use the database directly or contact the dev team.
        </div>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 32, color: C.gray, fontSize: 13 }}>Loading…</div>}

      {!loading && series.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48, color: C.gray, fontSize: 14 }}>No collectible series found.</div>
      )}

      {!loading && series.map(s => (
        <div key={s.id} style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{s.name}</div>
              <div style={{ fontSize: 12, color: C.gray }}>Season {s.season} · {s.totalCards} cards · {s.claimedCount} claimed by you</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {s.cards.map((card: any) => (
              <div key={card.id} style={{
                padding: '12px 14px', border: BR, borderRadius: 6,
                background: card.locked ? C.surface : C.pureWhite,
                opacity: card.locked ? 0.7 : 1,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{card.cardNumber}. {card.name}</span>
                  <span style={{
                    fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 2,
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                    background: card.rarity === 'epic' ? C.red : card.rarity === 'rare' ? '#b8860b' : C.gray,
                    color: '#fff',
                  }}>{card.rarity}</span>
                </div>
                <div style={{ fontSize: 11, color: C.gray }}>
                  {card.pointsReward} pts
                  {card.locked && ` · ${card.lockReason}`}
                  {card.claimed && ' · ✓ Claimed'}
                  {card.editionClosed && ' · Closed'}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MEDIA MANAGER
// ═══════════════════════════════════════════════════════════
function MediaManager() {
  const [stories, setStories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiService.get('/store/media');
      if (r.data?.success) setStories(r.data.data || []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      if (editing.id) {
        await apiService.put(`/store/media/admin/${editing.id}`, editing);
      } else {
        await apiService.post('/store/media/admin', editing);
      }
      setEditing(null);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Save failed');
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm('Remove this story?')) return;
    try {
      await apiService.delete(`/store/media/admin/${id}`);
      load();
    } catch {}
  };

  const set = (key: string, val: any) => setEditing((p: any) => ({ ...p, [key]: val }));

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: C.gray }}>{stories.length} stor{stories.length !== 1 ? 'ies' : 'y'}</div>
        <button style={BTN_PRIMARY} onClick={() => setEditing({
          title: '', media_type: 'article', category: 'editorial', description: '',
          media_url: '', thumbnail_url: '', duration: '', exclusive: true,
          published_at: new Date().toISOString(), featured: false,
        })}>+ New Story</button>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 32, color: C.gray, fontSize: 13 }}>Loading…</div>}

      {!loading && stories.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48, color: C.gray, fontSize: 14 }}>No stories yet. Create your first story.</div>
      )}

      {!loading && stories.map(s => (
        <div key={s.id} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 16px', border: BR, borderRadius: 8, marginBottom: 8,
          background: C.pureWhite,
        }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1, minWidth: 0 }}>
            {s.thumbnail_url && (
              <img src={s.thumbnail_url} alt="" style={{ width: 48, height: 36, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
            )}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{s.title}</span>
                {s.featured && <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 6px', background: C.red, color: '#fff', borderRadius: 2, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Featured</span>}
              </div>
              <div style={{ fontSize: 12, color: C.gray }}>
                {s.media_type} · {s.category} · {fmtDate(s.published_at)}
                {s.exclusive && ' · Exclusive'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button style={BTN_SECONDARY} onClick={() => setEditing({ ...s })}>Edit</button>
            <button style={BTN_DANGER} onClick={() => remove(s.id)}>Remove</button>
          </div>
        </div>
      ))}

      {editing && (
        <Modal title={editing.id ? 'Edit Story' : 'New Story'} onClose={() => setEditing(null)}>
          <Field label="Title">
            <input style={INPUT} value={editing.title || ''} onChange={e => set('title', e.target.value)} placeholder="Workshop: Ski Tuning Masterclass" />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Type">
              <select style={INPUT} value={editing.media_type || 'article'} onChange={e => set('media_type', e.target.value)}>
                <option value="article">Article</option>
                <option value="video">Video</option>
                <option value="photo">Photo</option>
                <option value="product_launch">Product Launch</option>
              </select>
            </Field>
            <Field label="Category">
              <select style={INPUT} value={editing.category || 'editorial'} onChange={e => set('category', e.target.value)}>
                <option value="editorial">Editorial</option>
                <option value="behind_the_scenes">Behind the Scenes</option>
                <option value="tech">Tech</option>
                <option value="lifestyle">Lifestyle</option>
                <option value="product">Product</option>
              </select>
            </Field>
          </div>
          <Field label="Description">
            <textarea style={{ ...INPUT, minHeight: 60, resize: 'vertical' }} value={editing.description || ''} onChange={e => set('description', e.target.value)} />
          </Field>
          <Field label="Media URL (video/article link)">
            <input style={INPUT} value={editing.media_url || ''} onChange={e => set('media_url', e.target.value)} placeholder="https://..." />
          </Field>
          <Field label="Thumbnail URL">
            <input style={INPUT} value={editing.thumbnail_url || ''} onChange={e => set('thumbnail_url', e.target.value)} placeholder="https://..." />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Duration (for video)">
              <input style={INPUT} value={editing.duration || ''} onChange={e => set('duration', e.target.value)} placeholder="4:32" />
            </Field>
            <Field label="Published At">
              <input style={INPUT} type="datetime-local" value={editing.published_at ? editing.published_at.slice(0, 16) : ''} onChange={e => set('published_at', e.target.value ? new Date(e.target.value).toISOString() : null)} />
            </Field>
          </div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
            <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={editing.exclusive !== false} onChange={e => set('exclusive', e.target.checked)} />
              Exclusive
            </label>
            <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={editing.featured === true} onChange={e => set('featured', e.target.checked)} />
              Featured
            </label>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button style={BTN_SECONDARY} onClick={() => setEditing(null)}>Cancel</button>
            <button style={{ ...BTN_PRIMARY, opacity: saving ? 0.6 : 1 }} onClick={save} disabled={saving || !editing.title}>
              {saving ? 'Saving…' : editing.id ? 'Update' : 'Create'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN ADMIN STORE PAGE
// ═══════════════════════════════════════════════════════════
export default function AdminStore() {
  const { user } = useAppContext();
  const isAdminUser = user?.role === 'admin' || user?.role === 'owner';
  const [tab, setTab] = useState<'deals' | 'collectibles' | 'media'>('deals');

  if (!isAdminUser) {
    return (
      <div style={{ padding: 48, fontFamily: C.font, textAlign: 'center' }}>
        <p style={{ fontSize: 16, color: C.gray }}>Admin access required.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '48px 48px 0', fontFamily: C.font, color: C.black }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '2.5rem', paddingBottom: '2rem', borderBottom: BR }}>
          <div style={RED_LABEL}>admin</div>
          <h1 style={{ fontSize: 'clamp(28px, 3vw, 36px)', fontWeight: 300, lineHeight: 1.15, margin: '6px 0 6px' }}>
            Store & Content
          </h1>
          <p style={{ color: C.gray, fontSize: 13, margin: 0 }}>
            Manage deals, collectible drops, and media stories.
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: BR, marginBottom: 28 }}>
          {([
            { key: 'deals', label: 'Deals' },
            { key: 'collectibles', label: 'Collectibles' },
            { key: 'media', label: 'Media & Stories' },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '12px 20px', background: 'none', border: 'none',
              borderBottom: tab === t.key ? `2px solid ${C.black}` : '2px solid transparent',
              fontSize: 12, fontWeight: tab === t.key ? 700 : 500,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              cursor: 'pointer', fontFamily: C.font,
              color: tab === t.key ? C.black : C.gray,
            }}>{t.label}</button>
          ))}
        </div>

        {/* Tab Content */}
        {tab === 'deals' && <DealsManager />}
        {tab === 'collectibles' && <CollectiblesManager />}
        {tab === 'media' && <MediaManager />}
      </div>
    </div>
  );
}
