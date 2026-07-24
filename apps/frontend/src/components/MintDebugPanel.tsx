import React, { useCallback, useEffect, useState } from 'react';
import { apiService } from '../services/api';

interface MintAttempt {
  id: string;
  source: string;
  user_id: string | null;
  rwa_id: string | null;
  product_name: string;
  requested_wallet: string | null;
  http_status: number | null;
  ok: boolean;
  error_detail: string | null;
  nft_snapshot: any;
  created_at: string;
}

const C = {
  black: '#0a0a0a', white: '#f5f4f0', red: '#7A222E', gray: '#6a6a6a',
  border: '#e0ddd6', surface: '#f0ede6', green: '#4caf7d', pureWhite: '#ffffff',
  font: "'Inter', sans-serif", mono: "'SFMono-Regular', Consolas, monospace",
};

export function MintDebugPanel() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<MintAttempt[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    apiService.get<MintAttempt[]>('/products/mint-debug/recent?limit=20')
      .then(res => {
        const payload = res.data as any;
        setAttempts(payload?.data || []);
      })
      .catch(err => {
        setError(err?.response?.status === 401
          ? 'Log in to view mint debug logs.'
          : (err?.response?.data?.error || err?.message || 'Failed to load mint attempts'));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        setOpen(prev => {
          const next = !prev;
          return next;
        });
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'rgba(10,10,10,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: C.font,
      }}
      onClick={() => setOpen(false)}
    >
      <div
        style={{
          width: 'min(900px, 92vw)', maxHeight: '85vh', overflow: 'auto',
          background: C.pureWhite, borderRadius: 8, border: `1px solid ${C.border}`,
          padding: '20px 24px',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 13, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.red, fontWeight: 600 }}>
            Mint / Claim Debug — last 20 attempts
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={load} style={btnStyle}>Refresh</button>
            <button onClick={() => setOpen(false)} style={btnStyle}>Close (Esc)</button>
          </div>
        </div>

        {loading && <div style={{ color: C.gray, fontSize: 13 }}>Loading…</div>}
        {error && <div style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>{error}</div>}

        {!loading && !error && attempts.length === 0 && (
          <div style={{ color: C.gray, fontSize: 13 }}>No mint attempts recorded yet.</div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {attempts.map(a => {
            const isExpanded = expandedId === a.id;
            return (
              <div key={a.id} style={{ border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                    cursor: 'pointer', background: a.ok ? 'transparent' : '#fdecec',
                  }}
                  onClick={() => setExpandedId(isExpanded ? null : a.id)}
                >
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                    color: '#fff', background: a.ok ? C.green : C.red,
                  }}>
                    {a.ok ? 'OK' : 'FAIL'}
                  </span>
                  <span style={{ fontSize: 11, color: C.gray, minWidth: 90 }}>{a.source}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{a.product_name || a.rwa_id || '—'}</span>
                  <span style={{ fontSize: 11, color: C.gray }}>{new Date(a.created_at).toLocaleString()}</span>
                </div>
                {isExpanded && (
                  <div style={{ padding: '12px', borderTop: `1px solid ${C.border}`, background: C.surface, fontSize: 12 }}>
                    <div><strong>user_id:</strong> {a.user_id || '—'}</div>
                    <div><strong>rwa_id:</strong> {a.rwa_id || '—'}</div>
                    <div><strong>requested_wallet:</strong> {a.requested_wallet || '—'}</div>
                    <div><strong>http_status:</strong> {a.http_status ?? '—'}</div>
                    {a.error_detail && <div style={{ color: C.red }}><strong>error:</strong> {a.error_detail}</div>}
                    {a.nft_snapshot && (
                      <pre style={{
                        marginTop: 8, padding: 10, background: C.black, color: '#c9f5d9',
                        borderRadius: 4, overflow: 'auto', fontSize: 11, fontFamily: C.mono,
                      }}>
                        {JSON.stringify(a.nft_snapshot, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
  padding: '6px 12px', borderRadius: 4, border: `1px solid ${C.border}`,
  background: C.pureWhite, cursor: 'pointer', color: C.black,
};

export default MintDebugPanel;
