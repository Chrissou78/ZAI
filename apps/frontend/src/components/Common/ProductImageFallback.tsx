import React from 'react';
import { ZaiMark } from '../Icons/LogoIcons';

/**
 * Placeholder shown wherever a product/deal/collectible has no image.
 *
 * Deliberately an inline SVG rather than the hero photograph: hero-bg.jpg is
 * ~6 MB, and a catalogue page can render a dozen of these at once. An SVG
 * costs no request, stays sharp at any size, and scales with the card
 * instead of being cropped.
 *
 * `size` only tunes how prominent the wordmark is — the graphic itself always
 * fills its container.
 */
const ProductImageFallback: React.FC<{
  size?: 'sm' | 'md' | 'lg';
  minHeight?: number | string;
}> = ({ size = 'md', minHeight }) => {
  const markSize = size === 'sm' ? 18 : size === 'lg' ? 40 : 28;

  return (
    <div
      aria-hidden="true"
      style={{
        width: '100%',
        height: '100%',
        minHeight,
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(160deg, #23262b 0%, #15171a 55%, #0d0e10 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Stylised alpine skyline. preserveAspectRatio lets the ridge line crop
          from the bottom on short/wide cards rather than squashing. */}
      <svg
        viewBox="0 0 200 120"
        preserveAspectRatio="xMidYMax slice"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      >
        {/* far range */}
        <path d="M0 78 L34 46 L58 70 L86 38 L118 74 L146 52 L172 72 L200 54 L200 120 L0 120 Z"
              fill="#2f343a" opacity="0.75" />
        {/* mid range */}
        <path d="M0 92 L28 66 L52 86 L84 58 L110 88 L140 70 L168 90 L200 74 L200 120 L0 120 Z"
              fill="#22262b" />
        {/* near range */}
        <path d="M0 108 L30 88 L62 106 L92 84 L124 108 L156 92 L184 108 L200 98 L200 120 L0 120 Z"
              fill="#171a1d" />
      </svg>

      <div style={{ position: 'relative', opacity: 0.5, lineHeight: 0 }}>
        <ZaiMark size={markSize} color="#f5f4f0" />
      </div>
    </div>
  );
};

export default ProductImageFallback;
