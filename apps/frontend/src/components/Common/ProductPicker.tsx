import React, { useState, useRef, useEffect } from 'react';

const C = {
  black: '#0a0a0a', white: '#f5f4f0', red: '#7A222E',
  gray: '#6a6a6a', border: '#e0ddd6', surface: '#f0ede6',
  pureWhite: '#ffffff', mid: '#2e2e2e',
  font: "'Inter', sans-serif",
};

export interface PickerProduct {
  id: string;
  name: string;
  image?: string;
  price?: string;
  currency?: string;
  collection?: string;
  available?: boolean;
}

interface ProductPickerProps {
  products: PickerProduct[];
  value: string;
  onChange: (id: string, product: PickerProduct | null) => void;
  placeholder?: string;
  showOther?: boolean;
  onOther?: () => void;
  isOther?: boolean;
  disabled?: boolean;
}

const ProductPicker: React.FC<ProductPickerProps> = ({
  products,
  value,
  onChange,
  placeholder = 'Select a product\u2026',
  showOther = false,
  onOther,
  isOther = false,
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const selected = products.find(p => p.id === value);

  return (
    <div ref={ref} style={{ position: 'relative', fontFamily: C.font }}>
      {/* Trigger */}
      <div
        onClick={() => { if (!disabled) setOpen(!open); }}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 4,
          background: C.pureWhite, cursor: disabled ? 'default' : 'pointer',
          minHeight: 44, transition: 'border-color 0.2s',
          borderColor: open ? C.mid : C.border,
        }}
      >
        {selected && !isOther ? (
          <>
            <Thumb src={selected.image} name={selected.name} size={32} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selected.name}
              </div>
              {selected.price && (
                <div style={{ fontSize: 11, color: C.gray }}>
                  {selected.currency || 'CHF'} {selected.price}
                </div>
              )}
            </div>
          </>
        ) : isOther ? (
          <span style={{ fontSize: 13, color: C.mid }}>Other (not listed)</span>
        ) : (
          <span style={{ fontSize: 13, color: C.gray }}>{placeholder}</span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: C.gray, flexShrink: 0, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }}>
          ▼
        </span>
      </div>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000,
          marginTop: 4, background: C.pureWhite, border: `1px solid ${C.border}`,
          borderRadius: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          maxHeight: 280, overflowY: 'auto',
        }}>
          {/* Empty option */}
          <div
            onClick={() => { onChange('', null); setOpen(false); }}
            style={{
              padding: '10px 12px', fontSize: 13, color: C.gray,
              cursor: 'pointer', transition: 'background 0.15s',
              borderBottom: `1px solid ${C.border}`,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = C.surface)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {placeholder}
          </div>

          {/* Product list */}
          {products.map(p => (
            <PickerRow
              key={p.id}
              product={p}
              isSelected={p.id === value}
              onSelect={() => {
                if (p.available === false) return;
                onChange(p.id, p);
                setOpen(false);
              }}
            />
          ))}

          {/* "Other" option */}
          {showOther && (
            <div
              onClick={() => { onOther?.(); setOpen(false); }}
              style={{
                padding: '10px 12px', fontSize: 13, color: C.mid,
                cursor: 'pointer', transition: 'background 0.15s',
                fontStyle: 'italic',
                background: isOther ? C.surface : 'transparent',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = C.surface)}
              onMouseLeave={e => (e.currentTarget.style.background = isOther ? C.surface : 'transparent')}
            >
              Other (not listed)
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ── Picker row with hover zoom ── */

const PickerRow: React.FC<{
  product: PickerProduct;
  isSelected: boolean;
  onSelect: () => void;
}> = ({ product, isSelected, onSelect }) => {
  const [hover, setHover] = useState(false);
  const [zoomPos, setZoomPos] = useState<{ top: number; left: number } | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    setHover(true);
    if (product.image && rowRef.current) {
      const rect = rowRef.current.getBoundingClientRect();
      // Position zoom popup to the left of the dropdown
      setZoomPos({
        top: rect.top,
        left: rect.left - 220,
      });
    }
  };

  const handleMouseLeave = () => {
    setHover(false);
    setZoomPos(null);
  };

  return (
    <div
      ref={rowRef}
      onClick={onSelect}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 12px',
        cursor: product.available === false ? 'default' : 'pointer',
        transition: 'background 0.15s',
        opacity: product.available === false ? 0.45 : 1,
        background: isSelected ? C.surface : hover ? C.surface : 'transparent',
        borderBottom: `1px solid ${C.border}`,
        position: 'relative',
      }}
    >
      <Thumb src={product.image} name={product.name} size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 500, overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {product.name}
        </div>
        <div style={{ fontSize: 11, color: C.gray, marginTop: 1 }}>
          {product.collection && <span>{product.collection} · </span>}
          {product.price && <span>{product.currency || 'CHF'} {product.price}</span>}
          {product.available === false && <span style={{ color: C.gray }}> · Out of stock</span>}
        </div>
      </div>
      {isSelected && (
        <span style={{ fontSize: 14, color: C.red, flexShrink: 0 }}>✓</span>
      )}

      {/* Zoom popup on hover */}
      {hover && product.image && zoomPos && (
        <div
          style={{
            position: 'fixed',
            top: zoomPos.top,
            left: zoomPos.left,
            width: 200,
            zIndex: 2000,
            pointerEvents: 'none',
          }}
        >
          <div style={{
            background: C.pureWhite,
            borderRadius: 8,
            border: `1px solid ${C.border}`,
            boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
            overflow: 'hidden',
          }}>
            <img
              src={product.image}
              alt={product.name}
              style={{ width: '100%', height: 'auto', display: 'block' }}
            />
            <div style={{
              padding: '8px 10px',
              borderTop: `1px solid ${C.border}`,
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.black }}>
                {product.name}
              </div>
              {product.price && (
                <div style={{ fontSize: 10, color: C.gray, marginTop: 2 }}>
                  {product.currency || 'CHF'} {product.price}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Thumbnail helper ── */

const Thumb: React.FC<{ src?: string; name?: string; size?: number }> = ({ src, name, size = 36 }) => {
  const [failed, setFailed] = useState(false);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name || 'Product'}
        onError={() => setFailed(true)}
        style={{
          width: size, height: size, borderRadius: 4,
          objectFit: 'cover', border: `1px solid ${C.border}`, flexShrink: 0,
        }}
      />
    );
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: 4,
      background: C.surface, border: `1px solid ${C.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, color: C.border, flexShrink: 0,
    }}>
      &#x2B21;
    </div>
  );
};

export default ProductPicker;
