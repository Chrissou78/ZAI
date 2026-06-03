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
  productName: string;
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
  pending: { bg: '#fef9e7', color: '#b8860b' },
  minting: { bg: '#e8f0fe', color: '#1967d2' },
  validated: { bg: '#e8f5e9', color: '#2e7d32' },
  rejected: { bg: '#fce8e6', color: '#c62828' },
  error: { bg: '#fce8e6', color: '#c62828' },
};

/* ───── Helpers ───── */

const formatDate = (d: string) => {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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
    setSelectedRwaId(claim.rwaId || '');
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
        note: adminNote,
      });
      if (res.data?.success) {
        setSelectedClaim(null);
        fetchClaims();
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
        note: adminNote,
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
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
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
                  }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
                >
                  {/* Proof thumbnail */}
                  <div style={{
                    width: 80, height: 80, borderRadius: 6, overflow: 'hidden',
                    background: C.surface, flexShrink: 0,
                  }}>
                    <AuthImage
                      src={`/api/products/claim-proof/${claim.id}`}
                      alt="Proof"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{claim.userName}</span>
                      <span style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                        padding: '2px 8px', borderRadius: 3,
                        background: sc.bg, color: sc.color,
                      }}>
                        {claim.status}
                      </span>
                    </div>
                    {claim.productName && (
                      <div style={{ fontSize: 12, color: C.gray, marginBottom: 2 }}>{claim.productName}</div>
                    )}
                    <div style={{ fontSize: 11, color: C.gray }}>
                      Submitted {formatDate(claim.createdAt)}
                    </div>
                    {claim.userEmail && (
                      <div style={{ fontSize: 11, color: C.gray }}>{claim.userEmail}</div>
                    )}
                  </div>

                  {/* Arrow */}
                  <div style={{ display: 'flex', alignItems: 'center', color: C.gray, fontSize: 18 }}>→</div>
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
            {/* User info */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{selectedClaim.userName}</div>
                <div style={{ fontSize: 12, color: C.gray }}>{selectedClaim.userEmail}</div>
                <div style={{ fontSize: 11, color: C.gray }}>ID: {selectedClaim.userId}</div>
              </div>
            </div>

            {/* Proof image */}
            <div>
              <div style={{ ...lbl, marginBottom: 8 }}>Proof of Purchase</div>
              <div
                style={{
                  borderRadius: 8, overflow: 'hidden', cursor: 'zoom-in',
                  background: C.surface, maxHeight: 300,
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

            {/* Status */}
            {selectedClaim.status !== 'pending' && (
              <div style={{
                padding: '12px 16px', borderRadius: 8,
                background: statusColors[selectedClaim.status]?.bg || C.surface,
                color: statusColors[selectedClaim.status]?.color || C.mid,
                fontSize: 13, fontWeight: 600,
              }}>
                Status: {selectedClaim.status.toUpperCase()}
                {selectedClaim.adminNote && (
                  <div style={{ fontWeight: 400, marginTop: 4, fontSize: 12 }}>Note: {selectedClaim.adminNote}</div>
                )}
              </div>
            )}

            {/* Admin actions (only for pending claims) */}
            {selectedClaim.status === 'pending' && (
              <>
                {/* User's product name (if provided) */}
                {selectedClaim.productName && (
                  <div style={{
                    padding: '12px 16px', borderRadius: 8,
                    background: C.surface, border: bdr,
                  }}>
                    <div style={{ ...lbl, marginBottom: 4 }}>Product Name (from user)</div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: C.black }}>
                      {selectedClaim.productName}
                    </div>
                  </div>
                )}

                {/* Product selection */}
                <div>
                  <div style={{ ...lbl, marginBottom: 8 }}>Select Product to Mint</div>
                  <select
                    value={selectedRwaId}
                    onChange={e => setSelectedRwaId(e.target.value)}
                    style={{
                      width: '100%', padding: '10px 12px', border: bdr,
                      fontSize: 13, fontFamily: C.font, borderRadius: 4,
                    }}
                  >
                    <option value="">— Select a product —</option>
                    {claimableProducts.map(p => (
                      <option key={p.rwaId} value={p.rwaId}>
                        {p.name} {p.price ? `(${p.currency || 'CHF'} ${p.price})` : ''}
                      </option>
                    ))}
                  </select>
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
                  <div style={{ color: C.red, fontSize: 13 }}>{actionError}</div>
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