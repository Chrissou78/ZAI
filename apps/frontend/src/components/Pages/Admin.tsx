import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../../context/AppContext';
import { apiService } from '../../services/api';
import Modal from '../Common/Modal';
import Button from '../Common/Button';
import AuthImage from '../Common/AuthImage';

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

/* ───── Styles ───── */

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

/* ───── Helpers ───── */

const formatDate = (d: string) => {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/* ───── Product Thumbnail sub-component ───── */

const ProductThumb: React.FC<{ src?: string; name?: string; size?: number }> = ({
  src,
  name,
  size = 40,
}) => {
  const [failed, setFailed] = useState(false);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name || 'Product'}
        onError={() => setFailed(true)}
        style={{
          width: size, height: size, borderRadius: 4,
          objectFit: 'cover', border: bdr, flexShrink: 0,
        }}
      />
    );
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: 4,
      background: C.surface, border: bdr,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, color: C.border, flexShrink: 0,
    }}>
      &#x2B21;
    </div>
  );
};

/* ───── Component ───── */

const Admin: React.FC = () => {
  const { user } = useAppContext();
  const [claims, setClaims] = useState<ClaimRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('pending');

  const [selectedClaim, setSelectedClaim] = useState<ClaimRequest | null>(null);
  const [claimableProducts, setClaimableProducts] = useState<ClaimableProduct[]>([]);
  const [selectedRwaId, setSelectedRwaId] = useState<string>('');
  const [adminNote, setAdminNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const isAdminUser = user?.role === 'admin' || user?.role === 'owner';

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

  const fetchClaimableProducts = async () => {
    try {
      const res = await apiService.get('/products/claimable');
      if (res.data?.success) {
        setClaimableProducts((res.data as any).data || []);
      }
    } catch {
      // silently fail
    }
  };

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  const openReview = (claim: ClaimRequest) => {
    setSelectedClaim(claim);
    setSelectedRwaId(claim.rwaId || claim.productId || '');
    setAdminNote(claim.adminNote || '');
    setActionError(null);
    fetchClaimableProducts();
  };

  const handleValidate = async () => {
    if (!selectedClaim || !selectedRwaId) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await apiService.post(`/products/claim-requests/${selectedClaim.id}/validate`, {
        rwaId: selectedRwaId,
        adminNote,
      });
      if (res.data?.success) {
        // Show mint result feedback if available
        const mintResult = (res.data as any).mintResult;
        if (mintResult && !mintResult.success) {
          setActionError(`Validated but mint issue: ${mintResult.error || 'Unknown error'}. Check admin notes.`);
          // Still refresh the list since the status changed
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

  const handleReject = async () => {
    if (!selectedClaim) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await apiService.post(`/products/claim-requests/${selectedClaim.id}/reject`, {
        adminNote,
      });
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

  // Find the selected claimable product for preview in the modal
  const selectedClaimableProduct = claimableProducts.find(p => p.rwaId === selectedRwaId);

  if (!isAdminUser) {
    return (
      <div style={{ padding: '48px', fontFamily: C.font, textAlign: 'center' }}>
        <p style={{ fontSize: 16, color: C.gray }}>Admin access required.</p>
      </div>
    );
  }

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
          {['pending', 'validated', 'rejected', 'all'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f === 'all' ? '' : f)}
              style={{
                padding: '8px 16px', fontSize: 11, fontWeight: 600,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                border: bdr, borderRadius: 4, cursor: 'pointer',
                fontFamily: C.font,
                background: (filter === f || (f === 'all' && !filter)) ? C.black : C.pureWhite,
                color: (filter === f || (f === 'all' && !filter)) ? '#fff' : C.mid,
                transition: 'all 0.2s',
              }}
            >
              {f}
              {f === 'pending' && claims.length > 0 && filter === 'pending' && (
                <span style={{
                  marginLeft: 6, fontSize: 9, fontWeight: 700,
                  background: 'rgba(255,255,255,0.2)', padding: '1px 5px', borderRadius: 3,
                }}>
                  {claims.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Loading */}
        {isLoading && (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <div style={{
              width: 32, height: 32, border: `3px solid ${C.border}`,
              borderTopColor: C.red, borderRadius: '50%',
              animation: 'zai-spin 0.8s linear infinite', margin: '0 auto 16px',
            }} />
            <span style={{ fontSize: 13, color: C.gray }}>Loading claims...</span>
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

        {/* Claims list */}
        {!isLoading && !error && claims.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {claims.map(claim => {
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
                  {/* Product thumbnail */}
                  <ProductThumb
                    src={claim.productImage}
                    name={claim.productName}
                    size={56}
                  />

                  {/* Product name + user info */}
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

                  {/* Proof thumbnail (small) */}
                  <div style={{
                    width: 48, height: 48, borderRadius: 4, overflow: 'hidden',
                    background: C.surface, flexShrink: 0,
                    border: bdr,
                  }}>
                    <AuthImage
                      src={`/api/products/claim-proof/${claim.id}`}
                      alt="Proof"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>

                  {/* Arrow */}
                  <div style={{ display: 'flex', alignItems: 'center', color: C.gray, fontSize: 18, flexShrink: 0 }}>→</div>
                </div>
              );
            })}
          </div>
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
              <ProductThumb
                src={selectedClaim.productImage}
                name={selectedClaim.productName}
                size={64}
              />
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
                <AuthImage
                  src={`/api/products/claim-proof/${selectedClaim.id}`}
                  alt="Proof of purchase"
                  style={{ width: '100%', height: 'auto', display: 'block', maxHeight: 300, objectFit: 'contain' }}
                />
              </div>
              <div style={{ fontSize: 11, color: C.gray, marginTop: 4 }}>Click to zoom</div>
            </div>

            {/* Status (for non-pending claims) */}
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

            {/* Admin actions (only for pending claims) */}
            {selectedClaim.status === 'pending' && (
              <>
                {/* Product selection with preview */}
                <div>
                  <div style={{ ...lbl, marginBottom: 8 }}>Select Product to Mint</div>
                  <select
                    value={selectedRwaId}
                    onChange={e => setSelectedRwaId(e.target.value)}
                    style={{
                      width: '100%', padding: '10px 12px', border: bdr,
                      fontSize: 13, fontFamily: C.font, borderRadius: 4,
                      background: C.pureWhite,
                    }}
                  >
                    <option value="">— Select a product —</option>
                    {claimableProducts.map(p => (
                      <option key={p.rwaId} value={p.rwaId}>
                        {p.name} {p.price ? `(${p.currency || 'CHF'} ${p.price})` : ''}
                      </option>
                    ))}
                  </select>

                  {/* Preview of selected product */}
                  {selectedClaimableProduct && (
                    <div style={{
                      display: 'flex', gap: 10, alignItems: 'center',
                      marginTop: 10, padding: '10px 12px',
                      background: C.surface, borderRadius: 6, border: bdr,
                    }}>
                      <ProductThumb
                        src={selectedClaimableProduct.image}
                        name={selectedClaimableProduct.name}
                        size={36}
                      />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>
                          {selectedClaimableProduct.name}
                        </div>
                        {selectedClaimableProduct.price && (
                          <div style={{ fontSize: 11, color: C.gray }}>
                            {selectedClaimableProduct.currency || 'CHF'} {selectedClaimableProduct.price}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Admin note */}
                <div>
                  <div style={{ ...lbl, marginBottom: 8 }}>Admin Note (optional)</div>
                  <textarea
                    value={adminNote}
                    onChange={e => setAdminNote(e.target.value)}
                    placeholder="Add a note..."
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

                {/* Action buttons */}
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
                    {actionLoading ? 'Processing...' : 'Validate & Mint'}
                  </button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* ════════════ ZOOM IMAGE ════════════ */}
      {zoomImage && (
        <Modal isOpen onClose={() => setZoomImage(null)} title="">
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <AuthImage src={zoomImage} alt="Proof" style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: 8 }} />
          </div>
        </Modal>
      )}

      {/* Animations */}
      <style>{`
        @keyframes zai-spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default Admin;
