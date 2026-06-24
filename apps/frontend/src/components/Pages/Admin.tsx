import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { apiService } from '../../services/api';
import Modal from '../Common/Modal';
import Button from '../Common/Button';
import AuthImage from '../Common/AuthImage';
import ProductPicker from '../Common/ProductPicker';

/* ───── Types ───── */

interface ClaimRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  rwaId: string | null;
  productId: string | null;
  productName: string;
  productImage: string;
  proofImageUrl: string;
  status: 'pending' | 'minting' | 'validated' | 'rejected' | 'error';
  adminNote: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  nftId: string | null;
  mintTx: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ClaimableProduct {
  rwaId: string;
  name: string;
  image: string;
  price: string;
  currency: string;
}

/* ───── Design tokens ───── */

const C = {
  black: '#0a0a0a', white: '#f5f4f0', red: '#7A222E', burgundy: '#7D1E2C',
  gray: '#6a6a6a', border: '#e0ddd6', surface: '#f0ede6', green: '#4caf7d',
  pureWhite: '#ffffff', mid: '#2e2e2e',
  font: "'Inter', sans-serif",
};
const bdr = `1px solid ${C.border}`;
const lbl: React.CSSProperties = {
  fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase',
  color: C.gray, fontWeight: 500,
};
const sectionLabel: React.CSSProperties = {
  fontSize: '11px', letterSpacing: '0.3em', textTransform: 'uppercase',
  color: C.red, fontWeight: 500, fontFamily: C.font,
};

const statusColors: Record<string, { bg: string; color: string }> = {
  pending:   { bg: '#fef9e7', color: '#b8860b' },
  minting:   { bg: '#e8f0fe', color: '#1967d2' },
  validated: { bg: '#e8f5e9', color: '#2e7d32' },
  rejected:  { bg: '#fce8e6', color: '#c62828' },
  error:     { bg: '#fce8e6', color: '#c62828' },
};

const formatDate = (d: string) => {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

/* ═══════════════════════════════════════════
   IMAGE CACHE + BUFFER SYSTEM
   ═══════════════════════════════════════════ */

/*  Blob URL cache — survives re-renders, avoids re-fetching.
    Key = original URL or API path, Value = blob: URL              */
const imgCache = new Map<string, string>();

/*  Tracks in-flight fetches so we don't duplicate requests        */
const imgInflight = new Map<string, Promise<string>>();

/**
 * Determine if a URL needs authenticated (proxied) fetching.
 * MinIO internal URLs and /api/ proof paths both need the auth proxy.
 */
const needsAuthFetch = (url: string): boolean => {
  if (!url) return false;
  if (url.startsWith('/api/')) return true;
  if (url.includes('minio') || url.includes(':9000')) return true;
  // Anything that is NOT http(s) starting with our own domain or a CDN
  if (url.startsWith('http') && !url.includes(window.location.hostname)) return true;
  return false;
};

/**
 * Resolve a single image URL → blob URL (cached).
 * Auth images go through apiService; public ones through fetch.
 */
const resolveImage = async (url: string): Promise<string> => {
  if (!url) return '';
  if (imgCache.has(url)) return imgCache.get(url)!;
  if (imgInflight.has(url)) return imgInflight.get(url)!;

  const work = (async () => {
    try {
      let blobUrl: string;
      if (needsAuthFetch(url)) {
        // For MinIO / internal URLs, proxy through our API image endpoint
        // or fetch with auth headers
        const proxyUrl = url.startsWith('/api/')
          ? url
          : `/api/img-proxy?url=${encodeURIComponent(url)}`;
        const res = await apiService.get(proxyUrl, { responseType: 'blob' });
        blobUrl = URL.createObjectURL(res.data as unknown as Blob);
      } else {
        // Public URL — simple fetch
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        blobUrl = URL.createObjectURL(blob);
      }
      imgCache.set(url, blobUrl);
      return blobUrl;
    } catch {
      imgCache.set(url, '');       // cache failure too to avoid retries
      return '';
    } finally {
      imgInflight.delete(url);
    }
  })();

  imgInflight.set(url, work);
  return work;
};

/**
 * Prefetch an array of image URLs in the background (fire-and-forget).
 * Used to buffer the next page of images while the user views the current one.
 */
const prefetchImages = (urls: string[]) => {
  urls.forEach(u => { if (u && !imgCache.has(u)) resolveImage(u); });
};

/* ═══════════════════════════════════════════
   CACHED IMAGE COMPONENT
   ═══════════════════════════════════════════ */

const CachedImg: React.FC<{
  src: string;
  alt: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}> = ({ src, alt, style, onClick }) => {
  const [blobUrl, setBlobUrl] = useState<string>(imgCache.get(src) || '');
  const [loading, setLoading] = useState(!imgCache.has(src));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!src) { setLoading(false); setFailed(true); return; }
    if (imgCache.has(src)) {
      const cached = imgCache.get(src)!;
      if (cached) { setBlobUrl(cached); setLoading(false); }
      else { setFailed(true); setLoading(false); }
      return;
    }
    let cancelled = false;
    setLoading(true);
    resolveImage(src).then(url => {
      if (cancelled) return;
      if (url) { setBlobUrl(url); setLoading(false); }
      else { setFailed(true); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [src]);

  const boxStyle: React.CSSProperties = {
    ...style,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };

  if (loading) {
    return (
      <div style={{ ...boxStyle, background: C.surface }}>
        <div style={{
          width: 14, height: 14, border: `2px solid ${C.border}`,
          borderTopColor: C.gray, borderRadius: '50%',
          animation: 'zai-spin 0.7s linear infinite',
        }} />
      </div>
    );
  }

  if (failed || !blobUrl) {
    return (
      <div style={{ ...boxStyle, background: C.surface, color: C.border, fontSize: 16, cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
        &#x2B21;
      </div>
    );
  }

  return (
    <img
      src={blobUrl}
      alt={alt}
      onClick={onClick}
      style={style}
      decoding="async"
    />
  );
};

/* ═══════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════ */

const PAGE_SIZE = 20;
const PREFETCH_AHEAD = 1;   // prefetch N pages ahead

/* ═══════════════════════════════════════════
   ADMIN COMPONENT
   ═══════════════════════════════════════════ */

const Admin: React.FC = () => {
  const { user } = useAppContext();
  const [claims, setClaims] = useState<ClaimRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('pending');
  const [page, setPage] = useState(1);

  const [selectedClaim, setSelectedClaim] = useState<ClaimRequest | null>(null);
  const [claimableProducts, setClaimableProducts] = useState<ClaimableProduct[]>([]);
  const [selectedRwaId, setSelectedRwaId] = useState<string>('');
  const [ecCardInfo, setEcCardInfo] = useState<{ rwaId: string; name: string; image: string } | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const isAdminUser = user?.role === 'admin' || user?.role === 'owner';

  /* ── Pagination helpers ── */

  const totalPages = Math.max(1, Math.ceil(claims.length / PAGE_SIZE));

  const paginatedClaims = useMemo(
    () => claims.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [claims, page],
  );

  // Reset page when filter changes
  useEffect(() => { setPage(1); }, [filter]);

  /* ── Prefetch next page images when current page changes ── */

  useEffect(() => {
    if (claims.length === 0) return;

    // Prefetch images for current page (should already be loading via CachedImg)
    // Plus the next PREFETCH_AHEAD pages
    for (let p = page; p <= Math.min(page + PREFETCH_AHEAD, totalPages); p++) {
      const slice = claims.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE);
      const urls: string[] = [];
      slice.forEach(c => {
        if (c.productImage) urls.push(c.productImage);
        urls.push(`/api/products/claim-proof/${c.id}`);
      });
      prefetchImages(urls);
    }
  }, [claims, page, totalPages]);

  /* ── Fetch claims ── */

  const fetchClaims = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params = filter ? `?status=${filter}` : '';
      const res = await apiService.get(`/products/claim-requests${params}`);
      if (res.data?.success) {
        setClaims(res.data.data || []);
      } else {
        setError(res.data?.error || 'Failed to load claims');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to load claims');
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchClaims(); }, [fetchClaims]);

  /* ── Claimable products ── */

  const fetchClaimableProducts = async () => {
    try {
      const res = await apiService.get('/products/claimable');
      if (res.data?.success) setClaimableProducts((res.data as any).data || []);
    } catch { /* silent */ }
  };

  /* ── Review modal ── */

  const openReview = (claim: ClaimRequest) => {
    setSelectedClaim(claim);
    setSelectedRwaId(claim.rwaId || claim.productId || '');
    setAdminNote(claim.adminNote || '');
    setActionError(null);
    setEcCardInfo(null);

    const n = (claim.productName || '').toLowerCase();
    const isEC = n.includes('experience') && n.includes('card');
    if (isEC) {
      apiService.get('/products/experience-card')
        .then(res => {
          const card = (res.data as any)?.data;
          if (card?.rwaId) {
            setEcCardInfo({ rwaId: card.rwaId, name: card.name, image: card.image });
            setSelectedRwaId(card.rwaId);
          }
        })
        .catch(() => {});
    } else {
      fetchClaimableProducts();
    }
  };

  const isExperienceCardClaim = !!selectedClaim && (() => {
    const n = (selectedClaim.productName || '').toLowerCase();
    return n.includes('experience') && n.includes('card');
  })();

  /* ── Validate ── */

  const handleValidate = async () => {
    if (!selectedClaim || !selectedRwaId) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await apiService.post(`/products/claim-requests/${selectedClaim.id}/validate`, {
        rwaId: selectedRwaId, adminNote,
      });
      if (res.data?.success) {
        const mintResult = (res.data as any).mintResult;
        if (mintResult && !mintResult.success) {
          setActionError(`Validated but mint issue: ${mintResult.error || 'Unknown error'}`);
          fetchClaims();
        } else {
          setSelectedClaim(null);
          fetchClaims();
        }
      } else {
        setActionError(res.data?.error || 'Validation failed');
      }
    } catch (err: any) {
      setActionError(err?.response?.data?.error || err?.message || 'Validation failed');
    } finally {
      setActionLoading(false);
    }
  };

  /* ── Reject ── */

  const handleReject = async () => {
    if (!selectedClaim) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await apiService.post(`/products/claim-requests/${selectedClaim.id}/reject`, { adminNote });
      if (res.data?.success) {
        setSelectedClaim(null);
        fetchClaims();
      } else {
        setActionError(res.data?.error || 'Rejection failed');
      }
    } catch (err: any) {
      setActionError(err?.response?.data?.error || err?.message || 'Rejection failed');
    } finally {
      setActionLoading(false);
    }
  };

  const selectedClaimableProduct = claimableProducts.find(p => p.rwaId === selectedRwaId);

  /* ── Access gate ── */

  if (!isAdminUser) {
    return (
      <div style={{ padding: '48px', fontFamily: C.font, textAlign: 'center' }}>
        <p style={{ fontSize: 16, color: C.gray }}>Admin access required.</p>
      </div>
    );
  }

  /* ═════════════ RENDER ═════════════ */

  return (
    <div style={{ padding: '48px 48px 0', fontFamily: C.font, color: C.black }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '2.5rem', paddingBottom: '2rem', borderBottom: bdr }}>
          <div style={sectionLabel}>admin</div>
          <h1 style={{ fontSize: 'clamp(28px, 3vw, 36px)', fontWeight: 300, lineHeight: 1.15, margin: '6px 0 6px' }}>
            Claim Requests
          </h1>
          <p style={{ color: C.gray, fontSize: '13px', margin: 0 }}>
            Review proof-of-purchase submissions and validate product claims.
          </p>
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {['pending', 'validated', 'rejected', 'all'].map(f => {
            const active = (filter === f) || (f === 'all' && !filter);
            return (
              <button
                key={f}
                onClick={() => setFilter(f === 'all' ? '' : f)}
                style={{
                  padding: '8px 16px', fontSize: 11, fontWeight: 600,
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                  border: bdr, borderRadius: 4, cursor: 'pointer',
                  fontFamily: C.font,
                  background: active ? C.black : C.pureWhite,
                  color: active ? '#fff' : C.mid,
                  transition: 'all 0.2s',
                }}
              >
                {f}
              </button>
            );
          })}

          {/* Count badge */}
          {!isLoading && claims.length > 0 && (
            <span style={{
              display: 'flex', alignItems: 'center', fontSize: 11,
              color: C.gray, marginLeft: 4,
            }}>
              {claims.length} claim{claims.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Loading */}
        {isLoading && (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <div style={{
              width: 32, height: 32, border: `3px solid ${C.border}`,
              borderTopColor: C.red, borderRadius: '50%',
              animation: 'zai-spin 0.8s linear infinite', margin: '0 auto 16px',
            }} />
            <span style={{ fontSize: 13, color: C.gray }}>Loading claims…</span>
          </div>
        )}

        {/* Error */}
        {error && !isLoading && (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <p style={{ color: C.red, fontSize: 14, marginBottom: 16 }}>{error}</p>
            <Button onClick={fetchClaims}>Retry</Button>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !error && claims.length === 0 && (
          <div style={{ textAlign: 'center', padding: 48, color: C.gray }}>
            <p style={{ fontSize: 14 }}>No {filter || ''} claim requests.</p>
          </div>
        )}

        {/* ═══ Claims list ═══ */}
        {!isLoading && !error && claims.length > 0 && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {paginatedClaims.map(claim => {
                const sc = statusColors[claim.status] || statusColors.pending;
                return (
                  <div
                    key={claim.id}
                    onClick={() => openReview(claim)}
                    style={{
                      display: 'flex', gap: 16, padding: 16,
                      border: bdr, borderRadius: 8, background: C.pureWhite,
                      cursor: 'pointer', transition: 'box-shadow 0.2s',
                      alignItems: 'center',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)')}
                    onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
                  >
                    {/* Product image — cached + proxied */}
                    <div style={{
                      width: 56, height: 56, borderRadius: 6, overflow: 'hidden',
                      flexShrink: 0, border: bdr, background: C.surface,
                    }}>
                      <CachedImg
                        src={claim.productImage}
                        alt={claim.productName || 'Product'}
                        style={{
                          width: 56, height: 56, objectFit: 'cover',
                          borderRadius: 6, display: 'block',
                        }}
                      />
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{
                          fontSize: 14, fontWeight: 600,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {claim.productName || 'Unnamed product'}
                        </span>
                        <span style={{
                          fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                          padding: '2px 8px', borderRadius: 3, flexShrink: 0,
                          background: sc.bg, color: sc.color,
                        }}>
                          {claim.status}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: C.mid, marginBottom: 2 }}>
                        {claim.userName || claim.userId}
                      </div>
                      <div style={{ fontSize: 11, color: C.gray }}>
                        Submitted {formatDate(claim.createdAt)}
                      </div>
                    </div>

                    {/* Proof thumbnail — cached + proxied */}
                    <div style={{
                      width: 48, height: 48, borderRadius: 4, overflow: 'hidden',
                      background: C.surface, flexShrink: 0, border: bdr,
                    }}>
                      <CachedImg
                        src={`/api/products/claim-proof/${claim.id}`}
                        alt="Proof"
                        style={{
                          width: 48, height: 48, objectFit: 'cover',
                          borderRadius: 4, display: 'block',
                        }}
                      />
                    </div>

                    {/* Arrow */}
                    <div style={{ display: 'flex', alignItems: 'center', color: C.gray, fontSize: 18, flexShrink: 0 }}>
                      →
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ═══ Pagination ═══ */}
            {totalPages > 1 && (
              <div style={{
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                gap: 8, padding: '28px 0 16px', flexWrap: 'wrap',
              }}>
                {/* Prev */}
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  style={{
                    padding: '7px 14px', fontSize: 12, fontWeight: 600,
                    border: bdr, borderRadius: 4, fontFamily: C.font,
                    background: C.pureWhite,
                    color: page <= 1 ? C.border : C.mid,
                    cursor: page <= 1 ? 'default' : 'pointer',
                  }}
                >
                  ← Prev
                </button>

                {/* Page numbers */}
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    style={{
                      width: 32, height: 32, fontSize: 12, fontWeight: p === page ? 700 : 500,
                      border: p === page ? `1px solid ${C.black}` : bdr,
                      borderRadius: 4, fontFamily: C.font,
                      background: p === page ? C.black : C.pureWhite,
                      color: p === page ? '#fff' : C.mid,
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    {p}
                  </button>
                ))}

                {/* Next */}
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  style={{
                    padding: '7px 14px', fontSize: 12, fontWeight: 600,
                    border: bdr, borderRadius: 4, fontFamily: C.font,
                    background: C.pureWhite,
                    color: page >= totalPages ? C.border : C.mid,
                    cursor: page >= totalPages ? 'default' : 'pointer',
                  }}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ════════════ REVIEW MODAL ════════════ */}
      {selectedClaim && (
        <Modal isOpen onClose={() => setSelectedClaim(null)} title="Review Claim Request">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Product info card */}
            <div style={{
              display: 'flex', gap: 14, padding: 16,
              background: C.surface, borderRadius: 8, border: bdr,
            }}>
              <div style={{ width: 64, height: 64, borderRadius: 6, overflow: 'hidden', flexShrink: 0, border: bdr }}>
                <CachedImg
                  src={selectedClaim.productImage}
                  alt={selectedClaim.productName || 'Product'}
                  style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6, display: 'block' }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
                  {selectedClaim.productName || 'Unnamed product'}
                </div>
                <div style={{ fontSize: 12, color: C.gray, marginBottom: 2 }}>
                  Claim ID: <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{selectedClaim.id}</span>
                </div>
                <div style={{ fontSize: 12, color: C.gray }}>
                  Submitted {formatDate(selectedClaim.createdAt)}
                </div>
              </div>
            </div>

            {/* User info */}
            <div>
              <div style={{ ...lbl, marginBottom: 8 }}>Submitted By</div>
              <div style={{
                padding: '12px 16px', borderRadius: 8, border: bdr,
                background: C.pureWhite,
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>
                  {selectedClaim.userName || selectedClaim.userId}
                </div>
                {selectedClaim.userEmail && (
                  <div style={{ fontSize: 12, color: C.gray }}>{selectedClaim.userEmail}</div>
                )}
                <div style={{ fontSize: 11, color: C.gray, marginTop: 2, fontFamily: 'monospace' }}>
                  {selectedClaim.userId}
                </div>
              </div>
            </div>

            {/* Proof image */}
            <div>
              <div style={{ ...lbl, marginBottom: 8 }}>Proof of Purchase</div>
              <div
                style={{
                  borderRadius: 8, overflow: 'hidden', cursor: 'zoom-in',
                  background: C.surface, maxHeight: 300, border: bdr,
                }}
                onClick={() => setZoomImage(`/api/products/claim-proof/${selectedClaim.id}`)}
              >
                <CachedImg
                  src={`/api/products/claim-proof/${selectedClaim.id}`}
                  alt="Proof of purchase"
                  style={{
                    width: '100%', height: 'auto', display: 'block',
                    maxHeight: 300, objectFit: 'contain',
                  }}
                />
              </div>
              <div style={{ fontSize: 11, color: C.gray, marginTop: 4 }}>Click to zoom</div>
            </div>

            {/* Status (non-pending) */}
            {selectedClaim.status !== 'pending' && (
              <div style={{
                padding: '12px 16px', borderRadius: 8,
                background: statusColors[selectedClaim.status]?.bg || C.surface,
                color: statusColors[selectedClaim.status]?.color || C.mid,
                fontSize: 13, fontWeight: 600,
              }}>
                Status: {selectedClaim.status.toUpperCase()}
                {selectedClaim.adminNote && (
                  <div style={{ fontWeight: 400, marginTop: 4, fontSize: 12 }}>
                    Note: {selectedClaim.adminNote}
                  </div>
                )}
                {selectedClaim.mintTx && (
                  <div style={{ fontWeight: 400, marginTop: 4, fontSize: 11, fontFamily: 'monospace' }}>
                    Mint TX: {selectedClaim.mintTx}
                  </div>
                )}
              </div>
            )}

            {/* Admin actions (pending only) */}
            {selectedClaim.status === 'pending' && (
              <>
                <div>
                  <div style={{ ...lbl, marginBottom: 8 }}>
                    {isExperienceCardClaim ? 'Product to Mint' : 'Select Product to Mint'}
                  </div>
                  {isExperienceCardClaim ? (
                    <div style={{
                      display: 'flex', gap: 10, alignItems: 'center',
                      padding: '10px 12px', background: C.surface,
                      borderRadius: 6, border: bdr,
                    }}>
                      <div style={{ width: 36, height: 36, borderRadius: 4, overflow: 'hidden', flexShrink: 0, border: bdr }}>
                        <CachedImg
                          src={ecCardInfo?.image || selectedClaim.productImage}
                          alt={ecCardInfo?.name || 'Experience Card'}
                          style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4, display: 'block' }}
                        />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>
                          {ecCardInfo?.name || 'zai Experience Club Card'}
                        </div>
                        <div style={{ fontSize: 11, color: C.gray }}>
                          Membership card · selected automatically
                        </div>
                      </div>
                    </div>
                  ) : (
                    <ProductPicker
                      products={claimableProducts.map(p => ({
                        id: p.rwaId, name: p.name, image: p.image,
                        price: p.price, currency: p.currency,
                      }))}
                      value={selectedRwaId}
                      onChange={(id) => setSelectedRwaId(id)}
                      placeholder="— Select a product —"
                    />
                  )}
                </div>

                <div>
                  <div style={{ ...lbl, marginBottom: 8 }}>Admin Note (optional)</div>
                  <textarea
                    value={adminNote}
                    onChange={e => setAdminNote(e.target.value)}
                    placeholder="Add a note…"
                    style={{
                      width: '100%', padding: '10px 12px', border: bdr,
                      fontSize: 13, fontFamily: C.font, borderRadius: 4,
                      minHeight: 60, resize: 'vertical', boxSizing: 'border-box',
                    }}
                  />
                </div>

                {actionError && (
                  <div style={{
                    color: C.red, fontSize: 13, padding: '10px 14px',
                    background: '#fce8e6', borderRadius: 6,
                  }}>
                    {actionError}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                  <button
                    onClick={handleReject}
                    disabled={actionLoading}
                    style={{
                      padding: '10px 20px', fontSize: 11, fontWeight: 600,
                      letterSpacing: '0.1em', textTransform: 'uppercase',
                      border: `1px solid ${C.red}`, borderRadius: 4,
                      background: 'transparent', color: C.red,
                      cursor: actionLoading ? 'default' : 'pointer',
                      fontFamily: C.font, opacity: actionLoading ? 0.5 : 1,
                      transition: 'all 0.2s',
                    }}
                  >
                    Reject
                  </button>
                  <button
                    onClick={handleValidate}
                    disabled={actionLoading || !selectedRwaId}
                    style={{
                      padding: '10px 20px', fontSize: 11, fontWeight: 600,
                      letterSpacing: '0.1em', textTransform: 'uppercase',
                      border: 'none', borderRadius: 4,
                      background: (!selectedRwaId || actionLoading) ? C.border : C.green,
                      color: '#fff',
                      cursor: (!selectedRwaId || actionLoading) ? 'default' : 'pointer',
                      fontFamily: C.font, opacity: actionLoading ? 0.5 : 1,
                      transition: 'all 0.2s',
                    }}
                  >
                    {actionLoading ? 'Processing…' : 'Validate & Mint'}
                  </button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* ════════════ ZOOM MODAL ════════════ */}
      {zoomImage && (
        <Modal isOpen onClose={() => setZoomImage(null)} title="">
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <CachedImg
              src={zoomImage}
              alt="Proof"
              style={{
                maxWidth: '100%', maxHeight: '80vh',
                objectFit: 'contain', borderRadius: 8,
              }}
            />
          </div>
        </Modal>
      )}

      {/* Spinner keyframe */}
      <style>{`@keyframes zai-spin { 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default Admin;
