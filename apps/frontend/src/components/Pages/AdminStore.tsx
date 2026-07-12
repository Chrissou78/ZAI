import { useState, useEffect, useCallback, useRef } from 'react';
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

/* ── Product Dropdown ─────────────────────────────────── */
interface Product {
  id: string;
  name: string;
  image: string;
  description: string;
  price: string;
  currency: string;
  contractAddress?: string;
}

function inferCategory(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('ski suit') || n.includes('hoodie') || n.includes('gilet') || n.includes('midlayer') || n.includes('shirt') || n.includes('beanie')) return 'apparel';
  if (n.includes('goggle') || n.includes('helmet') || n.includes('capalina') || n.includes('carbon')) return 'accessories';
  if (n.includes('experience')) return 'experience';
  return 'skis';
}

function ProductDropdown({
  products,
  selectedId,
  onSelect,
}: {
  products: Product[];
  selectedId: string | null;
  onSelect: (p: Product | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = products.find(p => p.id === selectedId);
  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          ...INPUT,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          minHeight: 42,
          background: C.pureWhite,
        }}
      >
        {selected ? (
          <>
            <img
              src={selected.image}
              alt=""
              style={{ width: 28, height: 28, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }}
            />
            <span style={{ fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selected.name}
            </span>
            <span style={{ fontSize: 11, color: C.gray, flexShrink: 0 }}>
              CHF {selected.price}
            </span>
          </>
        ) : (
          <span style={{ fontSize: 13, color: C.gray }}>Select a product…</span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: C.gray, flexShrink: 0 }}>▼</span>
      </div>

      {selected && (
        <button
          onClick={(e) => { e.stopPropagation(); onSelect(null); }}
          style={{
            position: 'absolute', right: 32, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', fontSize: 14, cursor: 'pointer',
            color: C.gray, padding: '0 4px',
          }}
          title="Clear selection"
        >
          ×
        </button>
      )}

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: C.pureWhite, border: BR, borderRadius: '0 0 8px 8px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 320, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: '8px 10px', borderBottom: BR }}>
            <input
              autoFocus
              placeholder="Search products…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                ...INPUT,
                border: 'none',
                background: C.surface,
                borderRadius: 6,
                fontSize: 12,
                padding: '8px 10px',
              }}
            />
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 260 }}>
            {filtered.length === 0 && (
              <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: C.gray }}>
                No products match "{search}"
              </div>
            )}
            {filtered.map(p => (
              <div
                key={p.id}
                onClick={() => { onSelect(p); setOpen(false); setSearch(''); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', cursor: 'pointer',
                  transition: 'background 0.15s',
                  background: p.id === selectedId ? C.surface : 'transparent',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = C.surface)}
                onMouseLeave={e => (e.currentTarget.style.background = p.id === selectedId ? C.surface : 'transparent')}
              >
                <img
                  src={p.image}
                  alt=""
                  style={{ width: 36, height: 36, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 500, overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: 11, color: C.gray }}>
                    CHF {p.price} · {inferCategory(p.name)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// DEALS MANAGER
// ═══════════════════════════════════════════════════════════
function DealsManager() {
  const [deals, setDeals] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiService.get('/store/deals');
      if (r.data?.success) setDeals(r.data.data || []);
    } catch {} finally { setLoading(false); }
  }, []);

  const loadProducts = useCallback(async () => {
    try {
      const r = await apiService.get('/products/catalog');
      if (r.data?.success) {
        const catalog = (r.data.data || []).filter(
          (p: Product) => !p.name.toLowerCase().includes('experience club card')
        );
        setProducts(catalog);
      }
    } catch {}
  }, []);

  useEffect(() => { load(); loadProducts(); }, [load, loadProducts]);

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

  const handleProductSelect = (product: Product | null) => {
    if (!product) {
      set('product_id', null);
      set('contract_address', '');
      return;
    }
    setEditing((prev: any) => ({
      ...prev,
      product_id: product.id,
      title: prev.title || product.name,
      description: prev.description || product.description || `Exclusive deal on ${product.name}`,
      category: inferCategory(product.name),
      image_url: product.image || '',
      price_chf: product.price ? product.price.replace(/'/g, '') : prev.price_chf,
      contract_address: product.contractAddress || '',
    }));
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: C.gray }}>{deals.length} deal{deals.length !== 1 ? 's' : ''}</div>
        <button style={BTN_PRIMARY} onClick={() => setEditing({
          title: '', description: '', category: 'accessories', price_chf: '',
          max_points_discount: 0, image_url: '', ends_at: '', spots_total: 0,
          featured: false, product_id: null, contract_address: '',
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
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1, minWidth: 0 }}>
            {d.image_url && (
              <img src={d.image_url} alt="" style={{ width: 40, height: 40, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
            )}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{d.title}</span>
                {d.featured && <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 6px', background: C.red, color: '#fff', borderRadius: 2, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Featured</span>}
                {d.contract_address && <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 6px', background: C.green, color: '#fff', borderRadius: 2, textTransform: 'uppercase', letterSpacing: '0.1em' }}>NFT</span>}
              </div>
              <div style={{ fontSize: 12, color: C.gray }}>
                CHF {parseFloat(d.price_chf).toLocaleString('de-CH')} · {d.category}
                {d.ends_at && ` · Ends ${new Date(d.ends_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                {d.spots_total > 0 && ` · ${d.spots_left}/${d.spots_total} spots`}
              </div>
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
          {/* ── Product selection ── */}
          <Field label="Link to Product (optional — auto-fills fields)">
            <ProductDropdown
              products={products}
              selectedId={editing.product_id || null}
              onSelect={handleProductSelect}
            />
          </Field>

          {/* Inherited preview */}
          {editing.product_id && editing.image_url && (
            <div style={{
              display: 'flex', gap: 12, alignItems: 'center',
              padding: '10px 14px', background: C.surface, borderRadius: 8,
              marginBottom: 16, border: BR,
            }}>
              <img
                src={editing.image_url}
                alt=""
                style={{ width: 48, height: 48, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: C.gray, marginBottom: 2 }}>Inherited from product</div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>
                  {editing.title} — CHF {editing.price_chf}
                </div>
                <div style={{ fontSize: 11, color: C.gray }}>
                  {editing.category}
                  {editing.contract_address && <span style={{ color: C.green }}> · NFT auto-mint enabled</span>}
                </div>
              </div>
            </div>
          )}

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
        <div style={{ marginBottom: '2.5rem', paddingBottom: '2rem', borderBottom: BR }}>
          <div style={RED_LABEL}>admin</div>
          <h1 style={{ fontSize: 'clamp(28px, 3vw, 36px)', fontWeight: 300, lineHeight: 1.15, margin: '6px 0 6px' }}>
            Store & Content
          </h1>
          <p style={{ color: C.gray, fontSize: 13, margin: 0 }}>
            Manage deals, collectible drops, and media stories.
          </p>
        </div>

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

        {tab === 'deals' && <DealsManager />}
        {tab === 'collectibles' && <CollectiblesManager />}
        {tab === 'media' && <MediaManager />}
      </div>
    </div>
  );
}
