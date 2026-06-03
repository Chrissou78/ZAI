import { useEffect, useRef, useState } from 'react';

/**
 * Renders an image from an endpoint that requires a Bearer token.
 * A plain <img src> cannot send the Authorization header, so we fetch
 * the bytes ourselves, build an object URL, and feed that to <img>.
 */
export default function AuthImage({
  src,
  alt = '',
  style,
  onClick,
}: {
  src: string;
  alt?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setObjectUrl(null);

    const token = localStorage.getItem('zai_token') || localStorage.getItem('token');

    fetch(src, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then(blob => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        setObjectUrl(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, [src]);

  if (failed) {
    return (
      <div
        style={{
          ...style,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          color: '#999',
          background: 'rgba(0,0,0,0.04)',
        }}
      >
        No image
      </div>
    );
  }

  if (!objectUrl) {
    return <div style={{ ...style, background: 'rgba(0,0,0,0.06)' }} />;
  }

  return <img src={objectUrl} alt={alt} style={style} onClick={onClick} />;
}