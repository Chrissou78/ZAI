/**
 * Shared geometry for the product cards on the Deals & Collectibles page —
 * used by both "Exclusive offers" and "Redeem with points" so the two sections
 * cannot drift apart again.
 *
 * The image ratio is not a design preference, it is measured. Of the 17 active
 * deal photos, 16 are portrait and 14 are exactly 2234x2553 (0.875:1), with the
 * rest at 0.71 and one landscape outlier at 1.50. `object-fit: cover` crops
 * whatever does not match the box, so a box at the photos' own ratio crops
 * nothing at all for the overwhelming majority.
 *
 * For reference, what the previous boxes were doing to an 0.875:1 photo:
 *   - points cards at 4:3 landscape ...... ~66% of the photo visible
 *   - deal cards at 140px x card height .. ~80% of the photo visible
 *   - this 7:8 box ....................... 100%
 */
export const PRODUCT_IMAGE_RATIO = '7 / 8';

/**
 * Cap the card's WIDTH, not the image's height.
 *
 * Capping the height was the obvious move and it was wrong: a portrait box is
 * taller than it is wide, so a 360px ceiling started binding at ordinary
 * layouts — a 351px-wide card wants a 401px image — and every time it bound,
 * the box went wider than 7:8 and the cropping came straight back. Measured, a
 * 360px cap dropped the dominant photo from 100% visible to 90% at a 1100px
 * container and to 75% on a single-column phone, which defeats the point.
 *
 * Bounding the width instead keeps every card on the exact ratio at every
 * breakpoint, and incidentally stops `auto-fill` stretching one lone card
 * across a whole row. The height ceiling stays only as a backstop for a
 * container narrower than the grid minimum.
 */
export const PRODUCT_CARD_MAX_WIDTH = 380;
export const PRODUCT_IMAGE_MAX_HEIGHT = 460;

/**
 * One grid definition for both sections. Portrait cards are tall, so a
 * narrower column keeps more of them on a row and keeps each card's total
 * height sane.
 */
export const PRODUCT_GRID_COLUMNS = 'repeat(auto-fill, minmax(258px, 1fr))';
