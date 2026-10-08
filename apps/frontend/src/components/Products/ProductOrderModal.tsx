import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiService } from '../../services/api';
import Modal from '../Common/Modal';
import Button from '../Common/Button';
import { Thumb } from '../Common/ProductPicker';

/**
 * Admin: arrange the products in the "Claim a Product" picker, and switch off
 * the ones that should no longer be offered.
 *
 * A product is dragged by its handle (mouse or finger); with a mouse the whole
 * row can be grabbed. The handle also moves with the arrow keys. Nothing is
 * stored until Save, which sends the complete order — the server replaces the
 * previous one wholesale.
 *
 * Written with pointer events rather than a drag-and-drop library: HTML5 drag
 * and drop does not work on touch screens, and this is one list.
 */

interface OrderItem {
  contractAddress: string;
  name: string;
  image: string;
  createdAt: string;
  sortPosition: number | null;
  /** Switched off: kept in the list here, left out of the member's picker. */
  hidden: boolean;
}

const C = {
  black: '#0a0a0a', red: '#7A222E', gray: '#6a6a6a', border: '#e0ddd6',
  surface: '#f0ede6', pureWhite: '#ffffff', green: '#2e7d32',
  font: "'Inter', sans-serif",
};

/** Within this many px of the list's top or bottom edge, a held row scrolls it. */
const EDGE = 56;
/** Scroll speed at the very edge, in px per frame. */
const MAX_SCROLL = 14;

const ProductOrderModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [dragKey, setDragKey] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const handleRefs = useRef(new Map<string, HTMLButtonElement>());
  const itemsRef = useRef(items);
  itemsRef.current = items;
  // grab: where in the row it was picked up, so the row doesn't jump to the pointer.
  const drag = useRef<{ key: string; grab: number; clientY: number; raf: number } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDirty(false);
    setSaved(false);
    apiService.get('/products/claimable?all=1')
      .then(res => {
        if (cancelled) return;
        const payload = res.data as any;
        if (!payload?.success) throw new Error('load failed');
        setItems((payload.data || []).map((p: any) => ({
          contractAddress: p.contractAddress,
          name: p.name,
          image: p.image,
          createdAt: p.createdAt || '',
          sortPosition: p.sortPosition ?? null,
          hidden: p.hidden === true,
        })));
      })
      .catch(() => { if (!cancelled) setError(t('admin.productOrder.loadFailed')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen, t]);

  /** Pointer position within the list's content, so it holds while the list scrolls. */
  const contentY = (clientY: number) => {
    const el = listRef.current!;
    return clientY - el.getBoundingClientRect().top + el.scrollTop;
  };

  /** Keep the held row under the pointer. offsetTop ignores transforms, so this is exact. */
  const followPointer = () => {
    const d = drag.current;
    const row = d && rowRefs.current.get(d.key);
    if (!d || !row || !listRef.current) return;
    row.style.transform = `translateY(${contentY(d.clientY) - d.grab - row.offsetTop}px)`;
  };

  /** Move the held row past any neighbour whose midpoint its own midpoint has crossed. */
  const step = () => {
    const d = drag.current;
    if (!d || !listRef.current) return;
    const list = itemsRef.current;
    const i = list.findIndex(x => x.contractAddress === d.key);
    const row = rowRefs.current.get(d.key);
    if (i < 0 || !row) return;

    const centre = contentY(d.clientY) - d.grab + row.offsetHeight / 2;
    const mid = (k: number) => {
      const r = rowRefs.current.get(list[k].contractAddress);
      return r ? r.offsetTop + r.offsetHeight / 2 : NaN;
    };
    let j = i;
    while (j > 0 && centre < mid(j - 1)) j--;
    while (j < list.length - 1 && centre > mid(j + 1)) j++;

    if (j !== i) {
      const next = [...list];
      const [moved] = next.splice(i, 1);
      next.splice(j, 0, moved);
      itemsRef.current = next;
      setItems(next);
      setDirty(true);
      setSaved(false);
    }
    followPointer();
  };

  // After a reorder renders, the held row sits in a new slot: re-anchor it.
  useLayoutEffect(() => { followPointer(); }, [items]);

  /** While a row is held near the top or bottom edge, scroll the list. */
  const autoScroll = () => {
    const d = drag.current;
    const el = listRef.current;
    if (!d || !el) return;
    const r = el.getBoundingClientRect();
    let dy = 0;
    if (d.clientY < r.top + EDGE) dy = -MAX_SCROLL * Math.min(1, (r.top + EDGE - d.clientY) / EDGE);
    else if (d.clientY > r.bottom - EDGE) dy = MAX_SCROLL * Math.min(1, (d.clientY - (r.bottom - EDGE)) / EDGE);
    if (dy) {
      el.scrollTop += dy;
      step();
    }
    d.raf = requestAnimationFrame(autoScroll);
  };

  const startDrag = (e: React.PointerEvent, key: string) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (drag.current || saving) return;
    e.preventDefault();
    e.stopPropagation();
    const row = rowRefs.current.get(key);
    if (!row || !listRef.current) return;

    const pointerId = e.pointerId;
    drag.current = { key, grab: contentY(e.clientY) - row.offsetTop, clientY: e.clientY, raf: 0 };
    setDragKey(key);

    // On window, not the element: React may move the held row's node while
    // reordering, which would drop a pointer capture taken on it.
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId || !drag.current) return;
      ev.preventDefault();
      drag.current.clientY = ev.clientY;
      step();
    };
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      if (drag.current) cancelAnimationFrame(drag.current.raf);
      const held = rowRefs.current.get(key);
      if (held) held.style.transform = '';
      drag.current = null;
      setDragKey(null);
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    drag.current.raf = requestAnimationFrame(autoScroll);
  };

  const moveBy = (key: string, delta: number) => {
    const list = itemsRef.current;
    const i = list.findIndex(x => x.contractAddress === key);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= list.length) return;
    const next = [...list];
    const [moved] = next.splice(i, 1);
    next.splice(j, 0, moved);
    setItems(next);
    setDirty(true);
    setSaved(false);
    // Keep focus on the handle so repeated presses keep moving the same product.
    requestAnimationFrame(() => {
      const h = handleRefs.current.get(key);
      h?.focus();
      h?.scrollIntoView({ block: 'nearest' });
    });
  };

  const toggleHidden = (key: string) => {
    setItems(prev => prev.map(p => (p.contractAddress === key ? { ...p, hidden: !p.hidden } : p)));
    setDirty(true);
    setSaved(false);
  };

  const sortNewestFirst = () => {
    setItems(prev => [...prev].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    setDirty(true);
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await apiService.put('/products/admin/claimable-order', {
        order: items.map(p => p.contractAddress),
        hidden: items.filter(p => p.hidden).map(p => p.contractAddress),
      });
      setItems(prev => prev.map((p, i) => ({ ...p, sortPosition: i + 1 })));
      setDirty(false);
      setSaved(true);
    } catch {
      setError(t('admin.productOrder.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const close = () => {
    if (dirty && !window.confirm(t('admin.productOrder.discardConfirm'))) return;
    onClose();
  };

  const formatDay = (iso: string) => {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const hasNew = items.some(p => p.sortPosition === null);
  // On a phone the intro wraps taller and the buttons stack, leaving less room.
  const narrow = typeof window !== 'undefined' && window.matchMedia('(max-width: 480px)').matches;

  return (
    <Modal isOpen={isOpen} onClose={close} title={t('admin.productOrder.title')} size="md" closeOnClickOutside={!dirty}>
      <div style={{ fontFamily: C.font, color: C.black }}>
        <p style={{ fontSize: 13, color: C.gray, margin: '0 0 6px', lineHeight: 1.5 }}>
          {t('admin.productOrder.subtitle')}
        </p>
        <p style={{ fontSize: 13, color: C.gray, margin: '0 0 12px', lineHeight: 1.5 }}>
          {t('admin.productOrder.switchHint')}
        </p>

        {loading && (
          <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: C.gray }}>
            {t('admin.productOrder.loading')}
          </div>
        )}

        {!loading && items.length > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: C.gray }}>
                {hasNew ? t('admin.productOrder.newHint') : ''}
              </span>
              <button
                type="button"
                onClick={sortNewestFirst}
                disabled={saving}
                style={{
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: C.red, fontFamily: C.font,
                }}
              >
                {t('admin.productOrder.newestFirst')}
              </button>
            </div>

            <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
              {/* Scroll container and offsetParent of the rows: no border or
                  padding here, so offsetTop and contentY share an origin. */}
              <div
                ref={listRef}
                style={{
                  // Sized to fit inside the modal (85vh) beside its header, intro and
                  // buttons, so Save stays in view instead of a second scrollbar.
                  position: 'relative', overflowY: 'auto',
                  maxHeight: narrow ? 'max(160px, calc(85vh - 490px))' : 'max(160px, calc(85vh - 370px))',
                  userSelect: 'none', WebkitUserSelect: 'none', background: C.surface,
                }}
              >
                {items.map((p, i) => {
                  const held = dragKey === p.contractAddress;
                  return (
                    <div
                      key={p.contractAddress}
                      ref={el => { if (el) rowRefs.current.set(p.contractAddress, el); else rowRefs.current.delete(p.contractAddress); }}
                      onPointerDown={e => { if (e.pointerType === 'mouse') startDrag(e, p.contractAddress); }}
                      onDragStart={e => e.preventDefault()}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 12px 8px 4px',
                        background: held ? '#fbf7f2' : C.pureWhite,
                        borderBottom: `1px solid ${C.border}`,
                        cursor: held ? 'grabbing' : 'grab',
                        position: 'relative', zIndex: held ? 2 : 1,
                        boxShadow: held ? '0 6px 18px rgba(0,0,0,0.16)' : 'none',
                      }}
                    >
                      <button
                        type="button"
                        ref={el => { if (el) handleRefs.current.set(p.contractAddress, el); else handleRefs.current.delete(p.contractAddress); }}
                        aria-label={t('admin.productOrder.dragHandle', { name: p.name })}
                        onPointerDown={e => startDrag(e, p.contractAddress)}
                        onKeyDown={e => {
                          if (e.key === 'ArrowUp') { e.preventDefault(); moveBy(p.contractAddress, -1); }
                          if (e.key === 'ArrowDown') { e.preventDefault(); moveBy(p.contractAddress, 1); }
                        }}
                        style={{
                          // touchAction none: a finger on the handle drags the
                          // row instead of scrolling the list.
                          touchAction: 'none', cursor: held ? 'grabbing' : 'grab',
                          width: 32, height: 40, flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'none', border: 'none', padding: 0,
                          color: C.gray, fontSize: 18, lineHeight: 1,
                        }}
                      >
                        ⠿
                      </button>
                      {/* Position number: left out on a phone, where the name needs the room. */}
                      {!narrow && (
                        <span style={{ width: 22, fontSize: 11, color: C.gray, textAlign: 'right', flexShrink: 0 }}>
                          {i + 1}
                        </span>
                      )}
                      <span style={{ display: 'flex', flexShrink: 0, opacity: p.hidden ? 0.4 : 1 }}>
                        <Thumb src={p.image} name={p.name} size={36} />
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Name on a line of its own: beside the badges a long
                            name was squeezed to nothing on a phone. */}
                        <div style={{
                          fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          opacity: p.hidden ? 0.45 : 1,
                        }}>
                          {p.name}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, color: C.gray, opacity: p.hidden ? 0.45 : 1 }}>{formatDay(p.createdAt)}</span>
                          {p.sortPosition === null && (
                            <span style={{
                              fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                              padding: '2px 6px', borderRadius: 3, flexShrink: 0,
                              background: '#fef9e7', color: '#b8860b',
                            }}>
                              {t('admin.productOrder.newBadge')}
                            </span>
                          )}
                          {p.hidden && (
                            <span style={{
                              fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                              padding: '2px 6px', borderRadius: 3, flexShrink: 0,
                              background: '#ecebe8', color: C.gray,
                            }}>
                              {t('admin.productOrder.disabledBadge')}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={!p.hidden}
                        aria-label={t('admin.productOrder.toggleLabel', { name: p.name })}
                        title={t('admin.productOrder.toggleLabel', { name: p.name })}
                        // Not a drag: with a mouse the whole row starts one.
                        onPointerDown={e => e.stopPropagation()}
                        onClick={() => toggleHidden(p.contractAddress)}
                        disabled={saving}
                        style={{
                          // 44px hit area around a 36x20 switch, for fingers.
                          flexShrink: 0, width: 44, height: 36, padding: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'none', border: 'none', cursor: 'pointer',
                        }}
                      >
                        <span style={{
                          position: 'relative', width: 36, height: 20, borderRadius: 10,
                          background: p.hidden ? '#cfcac0' : C.green, transition: 'background 0.15s',
                        }}>
                          <span style={{
                            position: 'absolute', top: 2, left: p.hidden ? 2 : 18,
                            width: 16, height: 16, borderRadius: '50%', background: C.pureWhite,
                            boxShadow: '0 1px 2px rgba(0,0,0,0.25)', transition: 'left 0.15s',
                          }} />
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {error && <p style={{ color: C.red, fontSize: 13, margin: '12px 0 0' }}>{error}</p>}

        <div style={narrow
          // Stacked full width, Save on top: side by side they don't fit, and
          // wrapping pushed Save below the fold.
          ? { display: 'flex', flexDirection: 'column-reverse', alignItems: 'stretch', gap: 8, marginTop: 16 }
          : { display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
          {saved && !dirty && (
            <span style={{ fontSize: 12, color: C.green, marginRight: 'auto' }}>✓ {t('admin.productOrder.saved')}</span>
          )}
          <Button variant="ghost" onClick={close} disabled={saving}>
            {t('admin.productOrder.cancel')}
          </Button>
          <Button variant="burgundy" onClick={save} disabled={!dirty || saving || loading} isLoading={saving}>
            {saving ? t('admin.productOrder.saving') : t('admin.productOrder.save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ProductOrderModal;
