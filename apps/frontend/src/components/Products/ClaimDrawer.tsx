import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { apiService } from '../../services/api';
import { type Category, CATEGORY_ORDER, getCategory } from '../../lib/productCategory';
import s from './ClaimDrawer.module.css';

/**
 * "Claim a product", as a drawer (bottom sheet on a phone), after the
 * zai Experience V2 design: pick the product from a searchable grid, add the
 * proof of purchase, then a confirmation that says what happens next.
 *
 * Behaviour carried over from the modal it replaces:
 *  - the product list is /products/claimable, so the admin's order and any
 *    products they switched off apply here too;
 *  - "I cannot find my product" sends a free-text name for the team to match;
 *  - on a desktop, "Take a photo with your phone" shows a QR code; the phone
 *    uploads (encrypted) and this drawer picks it up by polling the token.
 */

interface ClaimItem {
  rwaId: string;
  name: string;
  image: string;
  price: string;
  currency: string;
  category: Category;
}

export interface SubmittedClaim {
  id: string;
  productName: string;
}

interface ClaimDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitted: (claim: SubmittedClaim) => void;
}

/** The API takes the image inline in a 10 MB JSON body; base64 adds a third. */
const MAX_BYTES = 7 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif';

type Step = 1 | 2 | 3;

const isPhoneWidth = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches;
const isTouchDevice = () => typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const ClaimDrawer: React.FC<ClaimDrawerProps> = ({ isOpen, onClose, onSubmitted }) => {
  const { t, i18n } = useTranslation();

  // Mounted for the slide-out too; `shown` drives the CSS transition.
  const [mounted, setMounted] = useState(isOpen);
  const [shown, setShown] = useState(false);

  const [products, setProducts] = useState<ClaimItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const [step, setStep] = useState<Step>(1);
  const [cat, setCat] = useState<'all' | Category>('all');
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualName, setManualName] = useState('');

  // Proof: either an image chosen here, or one the phone uploaded (cid + key).
  const [image, setImage] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [previewFailed, setPreviewFailed] = useState(false);
  const [phoneCid, setPhoneCid] = useState<string | null>(null);
  const [phoneKey, setPhoneKey] = useState<string | null>(null);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedName, setSubmittedName] = useState('');
  const [submittedAt, setSubmittedAt] = useState<Date | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const advanceTimer = useRef<number | null>(null);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await apiService.get('/products/claimable');
      const payload = res.data as any;
      if (!payload?.success) throw new Error('load failed');
      setProducts((payload.data || []).map((p: any) => ({
        rwaId: p.rwaId,
        name: p.name,
        image: p.image || '',
        price: p.price || '',
        currency: p.currency || 'CHF',
        category: getCategory(p.name, p.collection),
      })));
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Open: reset and load. Close: slide out, then unmount.
  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      setStep(1); setCat('all'); setQ('');
      setSelectedId(null); setManualOpen(false); setManualName('');
      setImage(null); setFileName(''); setPreviewFailed(false);
      setPhoneCid(null); setPhoneKey(null); setQrToken(null);
      setSubmitting(false); setError(null); setSubmittedName(''); setSubmittedAt(null);
      loadProducts();
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(id);
    }
    setShown(false);
    setQrToken(null);
    const timer = window.setTimeout(() => setMounted(false), 420);
    return () => window.clearTimeout(timer);
  }, [isOpen, loadProducts]);

  useEffect(() => () => { if (advanceTimer.current) window.clearTimeout(advanceTimer.current); }, []);

  // Keep the page behind still while the drawer is up.
  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [mounted]);

  const requestClose = useCallback(() => {
    if (submitting) return;
    onClose();
  }, [submitting, onClose]);

  useEffect(() => {
    if (!shown) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') requestClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shown, requestClose]);

  // Each step starts at the top.
  useEffect(() => { bodyRef.current?.scrollTo({ top: 0 }); }, [step]);

  // Desktop → phone hand-off: wait for the phone's upload.
  useEffect(() => {
    if (!qrToken) return;
    const timer = window.setInterval(async () => {
      try {
        const res = await apiService.get(`/products/claim-upload/${qrToken}/status`);
        const data = res.data as any;
        if (data?.status === 'completed' && data?.proofImageCid) {
          setPhoneCid(data.proofImageCid);
          setPhoneKey(data.encryptionKey || null);
          setImage(null);
          setQrToken(null);
        }
      } catch (err: any) {
        if (err?.response?.status === 410) {
          setQrToken(null);
          setError(t('products.errors.uploadLinkExpired'));
        }
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [qrToken, t]);

  /* ── step 1: product ── */

  const categories = useMemo(
    () => CATEGORY_ORDER.filter(c => products.some(p => p.category === c)),
    [products],
  );

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return products.filter(p => {
      if (cat !== 'all' && p.category !== cat) return false;
      if (!needle) return true;
      return p.name.toLowerCase().includes(needle)
        || t(`products.categories.${p.category}`).toLowerCase().includes(needle);
    });
  }, [products, cat, q, t]);

  const selected = products.find(p => p.rwaId === selectedId) || null;
  const productName = selected ? selected.name : manualName.trim();
  const hasProduct = !!selected || (manualOpen && !!manualName.trim());
  const hasProof = !!image || !!phoneCid;

  const pick = (id: string) => {
    setSelectedId(id);
    setManualOpen(false);
    setManualName('');
    // As in the design: a short beat to show the tick, then move on.
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    advanceTimer.current = window.setTimeout(() => setStep(2), 260);
  };

  const openManual = () => {
    setManualOpen(true);
    setSelectedId(null);
  };

  /* ── step 2: proof ── */

  const takeFile = (file: File | undefined | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError(t('products.claimDrawer.errors.notImage')); return; }
    if (file.size > MAX_BYTES) { setError(t('products.claimDrawer.errors.tooLarge')); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setImage(reader.result as string);
      setFileName(file.name);
      setPreviewFailed(false);
      setPhoneCid(null);
      setPhoneKey(null);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    takeFile(e.target.files?.[0]);
    e.target.value = '';
  };

  const usePhone = async () => {
    setError(null);
    // On the phone itself, just open the camera.
    if (isPhoneWidth() || isTouchDevice()) { camRef.current?.click(); return; }
    try {
      const res = await apiService.post('/products/claim-upload/create-token');
      const payload = res.data as any;
      if (payload?.success && payload.token) setQrToken(payload.token);
      else setError(t('products.errors.failedGenerateUploadLink'));
    } catch {
      setError(t('products.errors.failedGenerateUploadLink'));
    }
  };

  const removeProof = () => {
    setImage(null); setFileName(''); setPhoneCid(null); setPhoneKey(null); setPreviewFailed(false);
  };

  /* ── submit ── */

  const submit = async () => {
    if (!hasProduct || !hasProof || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { productName };
      if (selected) body.productId = selected.rwaId;
      if (phoneCid) { body.preUploadedCid = phoneCid; body.preUploadedKey = phoneKey; }
      else body.proofImage = image;
      const res = await apiService.post('/products/claim-request', body);
      const payload = res.data as any;
      if (!payload?.success) throw new Error(payload?.error || '');
      setSubmittedName(productName);
      setSubmittedAt(new Date());
      setStep(3);
      onSubmitted({ id: payload.claimId || `optimistic-${Date.now()}`, productName });
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || t('products.errors.submissionFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const next = () => {
    if (step === 3) { requestClose(); return; }
    if (step === 1) { if (hasProduct) setStep(2); return; }
    submit();
  };

  if (!mounted) return null;

  const stepLabels = [t('products.claimDrawer.steps.product'), t('products.claimDrawer.steps.proof')];
  const nextDisabled = step === 1 ? !hasProduct : step === 2 ? (!hasProof || submitting) : false;
  const nextLabel = step === 3
    ? t('products.claimDrawer.foot.done')
    : step === 2
      ? (submitting ? t('products.claimDrawer.foot.submitting') : t('products.claimDrawer.foot.submit'))
      : t('products.claimDrawer.foot.continue');

  return (
    <>
      <div className={`${s.scrim} ${shown ? s.open : ''}`} onClick={requestClose} />
      <aside
        className={`${s.drawer} ${shown ? s.open : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={t('products.claimDrawer.title')}
      >
        <div className={s.head}>
          <div className={s.headTop}>
            <div>
              <div className={s.eyebrow}>{t('products.claimDrawer.eyebrow')}</div>
              <h2 className={s.title}>{t('products.claimDrawer.title')}</h2>
            </div>
            <button className={s.close} onClick={requestClose} disabled={submitting} aria-label={t('products.claimDrawer.close')}>
              &times;
            </button>
          </div>

          {step < 3 && (
            <>
              <div className={s.steps}>
                {[1, 2].map(n => (
                  <div key={n} className={`${s.step} ${n <= step ? s.lit : ''}`}><span /></div>
                ))}
              </div>
              <div className={s.stepLabels}>
                {stepLabels.map((l, i) => (i === step - 1 ? <b key={l}>{l}</b> : <span key={l}>{l}</span>))}
              </div>
            </>
          )}
        </div>

        <div className={s.body} ref={bodyRef}>

          {/* ── 1 / pick a product ── */}
          {step === 1 && (
            <div className={s.pane} key="pick">
              <p className={s.lead}>{t('products.claimDrawer.pick.lead')}</p>

              <div className={s.search}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                  <circle cx="7" cy="7" r="5" /><path d="M11 11l4 4" />
                </svg>
                <input
                  type="text"
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder={t('products.claimDrawer.pick.searchPlaceholder')}
                  aria-label={t('products.claimDrawer.pick.searchPlaceholder')}
                  autoComplete="off"
                />
                {q && (
                  <button className={s.clear} onClick={() => setQ('')} aria-label={t('products.claimDrawer.pick.clearSearch')}>&times;</button>
                )}
              </div>

              {categories.length > 1 && (
                <div className={s.cats}>
                  {(['all', ...categories] as const).map(c => (
                    <button key={c} className={`${s.cat} ${cat === c ? s.active : ''}`} onClick={() => setCat(c)}>
                      {c === 'all' ? t('products.claimDrawer.pick.all') : t(`products.categories.${c}`)}
                    </button>
                  ))}
                </div>
              )}

              <div className={s.grid}>
                {loading && <div className={s.none}>{t('products.claimDrawer.pick.loading')}</div>}
                {!loading && loadError && (
                  <div className={s.none}>
                    {t('products.claimDrawer.pick.loadFailed')}
                    <button className={s.retry} onClick={loadProducts}>{t('products.claimDrawer.pick.retry')}</button>
                  </div>
                )}
                {!loading && !loadError && visible.length === 0 && products.length > 0 && (
                  <div className={s.none}>{t('products.claimDrawer.pick.noMatch')}</div>
                )}
                {!loading && !loadError && visible.map(p => (
                  <button
                    key={p.rwaId}
                    type="button"
                    className={`${s.tile} ${selectedId === p.rwaId ? s.sel : ''}`}
                    onClick={() => pick(p.rwaId)}
                    aria-pressed={selectedId === p.rwaId}
                  >
                    <div className={s.tick}>&#10003;</div>
                    <div className={s.tileImg}>
                      {p.image
                        ? <img src={p.image} alt={p.name} loading="lazy" decoding="async" />
                        : <span className={s.tileNoImg}>&#x2B21;</span>}
                    </div>
                    <div className={s.tileInfo}>
                      <div className={s.tileCat}>{t(`products.categories.${p.category}`)}</div>
                      <div className={s.tileName}>{p.name}</div>
                      {p.price && <div className={s.tilePrice}>{p.currency} {p.price}</div>}
                    </div>
                  </button>
                ))}
              </div>

              {!manualOpen ? (
                <button className={s.ghost} onClick={openManual}>{t('products.claimDrawer.pick.cantFind')}</button>
              ) : (
                <div style={{ marginTop: 14 }}>
                  <label className={s.lbl} htmlFor="claim-manual-name">{t('products.claimDrawer.pick.manualLabel')}</label>
                  <input
                    id="claim-manual-name"
                    className={s.input}
                    value={manualName}
                    onChange={e => setManualName(e.target.value)}
                    placeholder={t('products.claimDrawer.pick.manualPlaceholder')}
                    autoFocus
                  />
                  <div className={s.hint} style={{ marginTop: 10 }}>{t('products.claimDrawer.pick.manualHint')}</div>
                </div>
              )}
            </div>
          )}

          {/* ── 2 / proof of purchase ── */}
          {step === 2 && (
            <div className={s.pane} key="proof">
              <div className={s.selbar}>
                {selected?.image
                  ? <img src={selected.image} alt="" />
                  : <div className={s.selbarNoImg} />}
                <div style={{ minWidth: 0 }}>
                  <div className={s.selbarName}>{productName}</div>
                  <div className={s.selbarMeta}>
                    {selected
                      ? <>{t(`products.categories.${selected.category}`)}{selected.price ? <> &middot; {selected.currency} {selected.price}</> : null}</>
                      : t('products.claimDrawer.pick.notInCatalogue')}
                  </div>
                </div>
                <button className={s.change} onClick={() => { setQrToken(null); setStep(1); }}>{t('products.claimDrawer.proof.change')}</button>
              </div>

              <p className={s.lead}>{t('products.claimDrawer.proof.lead')}</p>

              {qrToken ? (
                <div className={s.qr}>
                  <div className={s.qrTitle}>{t('products.receiptModal.qr.scanTitle')}</div>
                  <div className={s.qrDesc}>{t('products.receiptModal.qr.scanDesc')}</div>
                  <div className={s.qrBox}>
                    <QRCodeSVG value={`${window.location.origin}/api/products/claim-upload/${qrToken}/page`} size={180} />
                  </div>
                  <div className={s.qrWait}><span className={s.spinner} />{t('products.receiptModal.qr.waitingForPhoto')}</div>
                  <button className={s.linkBtn} onClick={() => setQrToken(null)}>{t('products.receiptModal.qr.backToUploadOptions')}</button>
                </div>
              ) : hasProof ? (
                <div className={s.file}>
                  {image && !previewFailed
                    ? <img src={image} alt="" onError={() => setPreviewFailed(true)} />
                    : (
                      <div className={s.fileIcon}>
                        <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="#2e2e2e" strokeWidth="1.3" aria-hidden="true">
                          <rect x="4" y="1" width="8" height="14" rx="1.5" /><path d="M7 13h2" />
                        </svg>
                      </div>
                    )}
                  <div style={{ minWidth: 0 }}>
                    <div className={s.fileName}>{phoneCid ? t('products.claimDrawer.proof.phoneReceived') : fileName}</div>
                    <div className={s.fileState}>{t('products.claimDrawer.proof.ready')}</div>
                  </div>
                  <button className={s.fileRemove} onClick={removeProof} aria-label={t('products.claimDrawer.proof.remove')}>&times;</button>
                </div>
              ) : (
                <div className={s.dropWrap}>
                  <button
                    type="button"
                    className={`${s.drop} ${dragOver ? s.over : ''}`}
                    onClick={() => fileRef.current?.click()}
                    onDragEnter={e => { e.preventDefault(); setDragOver(true); }}
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={e => { e.preventDefault(); setDragOver(false); }}
                    onDrop={e => { e.preventDefault(); setDragOver(false); takeFile(e.dataTransfer?.files?.[0]); }}
                  >
                    <div className={s.dropIcon}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#0a0a0a" strokeWidth="1.4" aria-hidden="true">
                        <path d="M8 11V2M4.5 5.5L8 2l3.5 3.5" /><path d="M2 11v3h12v-3" />
                      </svg>
                    </div>
                    <div className={s.dropTitle}>{t('products.claimDrawer.proof.dropTitle')}</div>
                    <div className={s.dropSub}>{t('products.claimDrawer.proof.dropSub')}</div>
                  </button>
                  <div className={s.or}>{t('products.claimDrawer.proof.or')}</div>
                  <button type="button" className={s.phone} onClick={usePhone}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
                      <rect x="4" y="1" width="8" height="14" rx="1.5" /><path d="M7 13h2" />
                    </svg>
                    <span>{isPhoneWidth() || isTouchDevice() ? t('products.claimDrawer.proof.phoneMobile') : t('products.claimDrawer.proof.phoneDesktop')}</span>
                  </button>
                </div>
              )}

              <div className={s.hint}>
                <Trans i18nKey="products.claimDrawer.proof.hint" components={{ b: <b /> }} />
              </div>
            </div>
          )}

          {/* ── done ── */}
          {step === 3 && (
            <div className={s.pane} key="done">
              <div className={s.done}>
                <div className={s.doneRing}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7A222E" strokeWidth="1.4" aria-hidden="true">
                    <path d="M4 12.5l5.5 5.5L20 7" />
                  </svg>
                </div>
                <div className={s.doneTitle}>{t('products.claimDrawer.done.title')}</div>
                <div className={s.doneDesc}>
                  <Trans i18nKey="products.claimDrawer.done.desc" values={{ item: submittedName }} components={{ b: <b /> }} />
                </div>
                <div className={s.timeline}>
                  <div className={`${s.tlItem} ${s.on}`}>
                    <div className={s.tlDot} />
                    <div>
                      <div className={s.tlTitle}>{t('products.claimDrawer.done.submitted')}</div>
                      <div className={s.tlSub}>
                        {submittedAt?.toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                  </div>
                  <div className={s.tlItem}>
                    <div className={s.tlDot} />
                    <div>
                      <div className={s.tlTitle}>{t('products.claimDrawer.done.review')}</div>
                      <div className={s.tlSub}>{t('products.claimDrawer.done.reviewSub')}</div>
                    </div>
                  </div>
                  <div className={s.tlItem}>
                    <div className={s.tlDot} />
                    <div>
                      <div className={s.tlTitle}>{t('products.claimDrawer.done.joins')}</div>
                      <div className={s.tlSub}>{t('products.claimDrawer.done.joinsSub')}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && step < 3 && <div className={s.error} role="alert">{error}</div>}
        </div>

        <div className={s.foot}>
          {step === 2 && (
            <button className={s.back} onClick={() => { setQrToken(null); setStep(1); }} disabled={submitting}>
              {t('products.claimDrawer.foot.back')}
            </button>
          )}
          <button className={s.next} onClick={next} disabled={nextDisabled}>{nextLabel}</button>
        </div>

        <input ref={fileRef} type="file" accept={ACCEPT} style={{ display: 'none' }} onChange={onFileInput} />
        <input ref={camRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={onFileInput} />
      </aside>
    </>
  );
};

export default ClaimDrawer;
