import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
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
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, boxSizing: 'border-box' as const }} onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
      <div style={{
        position: 'relative', background: C.pureWhite, borderRadius: 12, padding: 'clamp(16px, 4vw, 28px)',
        width: '100%', maxWidth: 540, boxSizing: 'border-box' as const,
        maxHeight: '90vh', overflow: 'auto', WebkitOverflowScrolling: 'touch',
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
  const { t } = useTranslation();
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
          <span style={{ fontSize: 13, color: C.gray }}>{t('adminStore.common.selectPlaceholder')}</span>
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
          title={t('adminStore.common.clearSelection')}
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
              placeholder={t('adminStore.common.searchPlaceholder')}
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
                {t('adminStore.common.noProductsMatch', { search })}
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
  const { t } = useTranslation();
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
      alert(e?.response?.data?.error || t('adminStore.common.saveFailed'));
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm(t('adminStore.dealForm.confirmDeactivate'))) return;
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
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: C.gray }}>{t('adminStore.list.dealsCount', { count: deals.length })}</div>
        <button style={BTN_PRIMARY} onClick={() => setEditing({
          title: '', description: '', category: 'accessories', price_chf: '',
          max_points_discount: 0, image_url: '', ends_at: '', spots_total: 0,
          featured: false, product_id: null, contract_address: '',
        })}>{t('adminStore.list.newDeal')}</button>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 32, color: C.gray, fontSize: 13 }}>{t('adminStore.common.loading')}</div>}

      {!loading && deals.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48, color: C.gray, fontSize: 14 }}>{t('adminStore.list.noDeals')}</div>
      )}

      {!loading && deals.map(d => (
        <div key={d.id} style={{
          display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10,
          padding: '14px 16px', border: BR, borderRadius: 8, marginBottom: 8,
          background: C.pureWhite,
        }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: '1 1 220px', minWidth: 0 }}>
            {d.image_url && (
              <img src={d.image_url} alt="" style={{ width: 40, height: 40, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 600, wordBreak: 'break-word' }}>{d.title}</span>
                {d.featured && <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 6px', background: C.red, color: '#fff', borderRadius: 2, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t('adminStore.common.featured')}</span>}
                {d.contract_address && <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 6px', background: C.green, color: '#fff', borderRadius: 2, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t('adminStore.list.nft')}</span>}
              </div>
              <div style={{ fontSize: 12, color: C.gray }}>
                CHF {parseFloat(d.price_chf).toLocaleString('de-CH')} · {d.category}
                {d.ends_at && ` · ${t('adminStore.list.endsOn', { date: new Date(d.ends_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) })}`}
                {d.spots_total > 0 && ` · ${t('adminStore.list.spotsLeft', { left: d.spots_left, total: d.spots_total })}`}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button style={BTN_SECONDARY} onClick={() => setEditing({ ...d, price_chf: String(d.price_chf) })}>{t('adminStore.common.edit')}</button>
            <button style={BTN_DANGER} onClick={() => remove(d.id)}>{t('adminStore.common.remove')}</button>
          </div>
        </div>
      ))}

      {editing && (
        <Modal title={editing.id ? t('adminStore.dealForm.editTitle') : t('adminStore.dealForm.newTitle')} onClose={() => setEditing(null)}>
          {/* ── Product selection ── */}
          <Field label={t('adminStore.dealForm.linkProduct')}>
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
                <div style={{ fontSize: 11, color: C.gray, marginBottom: 2 }}>{t('adminStore.dealForm.inheritedFrom')}</div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>
                  {editing.title} — CHF {editing.price_chf}
                </div>
                <div style={{ fontSize: 11, color: C.gray }}>
                  {editing.category}
                  {editing.contract_address && <span style={{ color: C.green }}> · {t('adminStore.dealForm.nftAutoMint')}</span>}
                </div>
              </div>
            </div>
          )}

          <Field label={t('adminStore.dealForm.title')}>
            <input style={INPUT} value={editing.title || ''} onChange={e => set('title', e.target.value)} placeholder={t('adminStore.dealForm.titlePlaceholder')} />
          </Field>
          <Field label={t('adminStore.dealForm.description')}>
            <textarea style={{ ...INPUT, minHeight: 60, resize: 'vertical' }} value={editing.description || ''} onChange={e => set('description', e.target.value)} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <Field label={t('adminStore.dealForm.category')}>
              <select style={INPUT} value={editing.category || 'accessories'} onChange={e => set('category', e.target.value)}>
                <option value="accessories">{t('adminStore.dealForm.categoryOptions.accessories')}</option>
                <option value="apparel">{t('adminStore.dealForm.categoryOptions.apparel')}</option>
                <option value="skis">{t('adminStore.dealForm.categoryOptions.skis')}</option>
                <option value="event">{t('adminStore.dealForm.categoryOptions.event')}</option>
                <option value="experience">{t('adminStore.dealForm.categoryOptions.experience')}</option>
              </select>
            </Field>
            <Field label={t('adminStore.dealForm.price')}>
              <input style={INPUT} type="number" step="0.01" value={editing.price_chf || ''} onChange={e => set('price_chf', e.target.value)} />
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <Field label={t('adminStore.dealForm.maxPointsDiscount')}>
              <input style={INPUT} type="number" value={editing.max_points_discount || 0} onChange={e => set('max_points_discount', parseInt(e.target.value) || 0)} />
            </Field>
            <Field label={t('adminStore.dealForm.totalSpots')}>
              <input style={INPUT} type="number" value={editing.spots_total || 0} onChange={e => set('spots_total', parseInt(e.target.value) || 0)} />
            </Field>
          </div>
          <Field label={t('adminStore.dealForm.imageUrl')}>
            <input style={INPUT} value={editing.image_url || ''} onChange={e => set('image_url', e.target.value)} placeholder="https://..." />
          </Field>
          <Field label={t('adminStore.dealForm.endsAt')}>
            <input style={INPUT} type="datetime-local" value={editing.ends_at ? editing.ends_at.slice(0, 16) : ''} onChange={e => set('ends_at', e.target.value ? new Date(e.target.value).toISOString() : null)} />
          </Field>
          <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
            <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={editing.featured === true} onChange={e => set('featured', e.target.checked)} />
              {t('adminStore.common.featured')}
            </label>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button style={BTN_SECONDARY} onClick={() => setEditing(null)}>{t('adminStore.common.cancel')}</button>
            <button style={{ ...BTN_PRIMARY, opacity: saving ? 0.6 : 1 }} onClick={save} disabled={saving || !editing.title || !editing.price_chf}>
              {saving ? t('adminStore.common.saving') : editing.id ? t('adminStore.common.update') : t('adminStore.common.create')}
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
  const { t } = useTranslation();
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
          {t('adminStore.collectibles.infoText')}
        </div>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 32, color: C.gray, fontSize: 13 }}>{t('adminStore.common.loading')}</div>}

      {!loading && series.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48, color: C.gray, fontSize: 14 }}>{t('adminStore.collectibles.noSeries')}</div>
      )}

      {!loading && series.map(s => (
        <div key={s.id} style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{s.name}</div>
              <div style={{ fontSize: 12, color: C.gray }}>
                {t('adminStore.collectibles.season', { season: s.season })} · {t('adminStore.collectibles.cardsCount', { count: s.totalCards })} · {t('adminStore.collectibles.claimedByYou', { count: s.claimedCount })}
              </div>
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
                  {t('adminStore.collectibles.pts', { count: card.pointsReward })}
                  {card.locked && ` · ${card.lockReason}`}
                  {card.claimed && ` · ${t('adminStore.collectibles.claimed')}`}
                  {card.editionClosed && ` · ${t('adminStore.collectibles.closed')}`}
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
  const { t } = useTranslation();
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
      alert(e?.response?.data?.error || t('adminStore.common.saveFailed'));
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm(t('adminStore.mediaForm.confirmRemove'))) return;
    try {
      await apiService.delete(`/store/media/admin/${id}`);
      load();
    } catch {}
  };

  const set = (key: string, val: any) => setEditing((p: any) => ({ ...p, [key]: val }));

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: C.gray }}>{t('adminStore.list.storiesCount', { count: stories.length })}</div>
        <button style={BTN_PRIMARY} onClick={() => setEditing({
          title: '', media_type: 'article', category: 'editorial', description: '',
          media_url: '', thumbnail_url: '', duration: '', exclusive: true,
          published_at: new Date().toISOString(), featured: false,
        })}>{t('adminStore.list.newStory')}</button>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 32, color: C.gray, fontSize: 13 }}>{t('adminStore.common.loading')}</div>}

      {!loading && stories.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48, color: C.gray, fontSize: 14 }}>{t('adminStore.list.noStories')}</div>
      )}

      {!loading && stories.map(s => (
        <div key={s.id} style={{
          display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10,
          padding: '14px 16px', border: BR, borderRadius: 8, marginBottom: 8,
          background: C.pureWhite,
        }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: '1 1 220px', minWidth: 0 }}>
            {s.thumbnail_url && (
              <img src={s.thumbnail_url} alt="" style={{ width: 48, height: 36, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <span style={{ fontSize: 14, fontWeight: 600, wordBreak: 'break-word' }}>{s.title}</span>
                {s.featured && <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 6px', background: C.red, color: '#fff', borderRadius: 2, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t('adminStore.common.featured')}</span>}
              </div>
              <div style={{ fontSize: 12, color: C.gray }}>
                {s.media_type} · {s.category} · {fmtDate(s.published_at)}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button style={BTN_SECONDARY} onClick={() => setEditing({ ...s })}>{t('adminStore.common.edit')}</button>
            <button style={BTN_DANGER} onClick={() => remove(s.id)}>{t('adminStore.common.remove')}</button>
          </div>
        </div>
      ))}

      {editing && (
        <Modal title={editing.id ? t('adminStore.mediaForm.editTitle') : t('adminStore.mediaForm.newTitle')} onClose={() => setEditing(null)}>
          <Field label={t('adminStore.mediaForm.title')}>
            <input style={INPUT} value={editing.title || ''} onChange={e => set('title', e.target.value)} placeholder={t('adminStore.mediaForm.titlePlaceholder')} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <Field label={t('adminStore.mediaForm.type')}>
              <select style={INPUT} value={editing.media_type || 'article'} onChange={e => set('media_type', e.target.value)}>
                <option value="article">{t('adminStore.mediaForm.typeOptions.article')}</option>
                <option value="video">{t('adminStore.mediaForm.typeOptions.video')}</option>
                <option value="photo">{t('adminStore.mediaForm.typeOptions.photo')}</option>
                <option value="product_launch">{t('adminStore.mediaForm.typeOptions.productLaunch')}</option>
              </select>
            </Field>
            <Field label={t('adminStore.mediaForm.category')}>
              <select style={INPUT} value={editing.category || 'editorial'} onChange={e => set('category', e.target.value)}>
                <option value="editorial">{t('adminStore.mediaForm.categoryOptions.editorial')}</option>
                <option value="behind_the_scenes">{t('adminStore.mediaForm.categoryOptions.behindTheScenes')}</option>
                <option value="tech">{t('adminStore.mediaForm.categoryOptions.tech')}</option>
                <option value="lifestyle">{t('adminStore.mediaForm.categoryOptions.lifestyle')}</option>
                <option value="product">{t('adminStore.mediaForm.categoryOptions.product')}</option>
              </select>
            </Field>
          </div>
          <Field label={t('adminStore.mediaForm.description')}>
            <textarea style={{ ...INPUT, minHeight: 60, resize: 'vertical' }} value={editing.description || ''} onChange={e => set('description', e.target.value)} />
          </Field>
          <Field label={t('adminStore.mediaForm.mediaUrl')}>
            <input style={INPUT} value={editing.media_url || ''} onChange={e => set('media_url', e.target.value)} placeholder="https://..." />
          </Field>
          <Field label={t('adminStore.mediaForm.thumbnailUrl')}>
            <input style={INPUT} value={editing.thumbnail_url || ''} onChange={e => set('thumbnail_url', e.target.value)} placeholder="https://..." />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <Field label={t('adminStore.mediaForm.duration')}>
              <input style={INPUT} value={editing.duration || ''} onChange={e => set('duration', e.target.value)} placeholder="4:32" />
            </Field>
            <Field label={t('adminStore.mediaForm.publishedAt')}>
              <input style={INPUT} type="datetime-local" value={editing.published_at ? editing.published_at.slice(0, 16) : ''} onChange={e => set('published_at', e.target.value ? new Date(e.target.value).toISOString() : null)} />
            </Field>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
            <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={editing.exclusive !== false} onChange={e => set('exclusive', e.target.checked)} />
              {t('adminStore.mediaForm.exclusive')}
            </label>
            <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={editing.featured === true} onChange={e => set('featured', e.target.checked)} />
              {t('adminStore.common.featured')}
            </label>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button style={BTN_SECONDARY} onClick={() => setEditing(null)}>{t('adminStore.common.cancel')}</button>
            <button style={{ ...BTN_PRIMARY, opacity: saving ? 0.6 : 1 }} onClick={save} disabled={saving || !editing.title}>
              {saving ? t('adminStore.common.saving') : editing.id ? t('adminStore.common.update') : t('adminStore.common.create')}
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
  const { t } = useTranslation();
  const { user } = useAppContext();
  const isAdminUser = user?.role === 'admin' || user?.role === 'owner';
  const [tab, setTab] = useState<'deals' | 'collectibles' | 'media'>('deals');

  if (!isAdminUser) {
    return (
      <div style={{ padding: 48, fontFamily: C.font, textAlign: 'center' }}>
        <p style={{ fontSize: 16, color: C.gray }}>{t('adminStore.accessDenied')}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 'clamp(20px, 5vw, 48px) clamp(16px, 5vw, 48px) 0', fontFamily: C.font, color: C.black, boxSizing: 'border-box' as const }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ marginBottom: '2.5rem', paddingBottom: '2rem', borderBottom: BR }}>
          <div style={RED_LABEL}>{t('adminStore.header.badge')}</div>
          <h1 style={{ fontSize: 'clamp(28px, 3vw, 36px)', fontWeight: 300, lineHeight: 1.15, margin: '6px 0 6px' }}>
            {t('adminStore.header.title')}
          </h1>
          <p style={{ color: C.gray, fontSize: 13, margin: 0 }}>
            {t('adminStore.header.subtitle')}
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0, borderBottom: BR, marginBottom: 28 }}>
          {([
            { key: 'deals', label: t('adminStore.tabs.deals') },
            { key: 'collectibles', label: t('adminStore.tabs.collectibles') },
            { key: 'media', label: t('adminStore.tabs.media') },
          ] as const).map(tabItem => (
            <button key={tabItem.key} onClick={() => setTab(tabItem.key)} style={{
              padding: '12px 20px', background: 'none', border: 'none',
              borderBottom: tab === tabItem.key ? `2px solid ${C.black}` : '2px solid transparent',
              fontSize: 12, fontWeight: tab === tabItem.key ? 700 : 500,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              cursor: 'pointer', fontFamily: C.font,
              color: tab === tabItem.key ? C.black : C.gray,
            }}>{tabItem.label}</button>
          ))}
        </div>

        {tab === 'deals' && <DealsManager />}
        {tab === 'collectibles' && <CollectiblesManager />}
        {tab === 'media' && <MediaManager />}
      </div>
    </div>
  );
}
