/**
 * Which Experience Card artwork to show for a member's tier.
 *
 * zai supplied one card design per tier, and the card appears in two places —
 * the dashboard welcome panel and the profile page — so the mapping lives here
 * rather than being spelled out twice and drifting apart, which is how the
 * tier tables in those same two files already ended up duplicated.
 *
 * Below White (under 500 points) a member has NO tier, so they keep the
 * untiered card. Showing them the White design would claim a standing they
 * have not reached, and the dashboard says "No tier yet" right beside it.
 */

const CARDS: Record<string, string> = {
  white: '/images/card-white.webp',
  blue: '/images/card-blue.webp',
  red: '/images/card-red.webp',
  black: '/images/card-black.webp',
  diamond: '/images/card-diamond.webp',
};

/** The original untiered artwork, for members below the first tier. */
export const UNTIERED_CARD = '/images/experience-card.png';

/**
 * @param tierName Tier name in any casing ("White", "diamond"), or null/undefined
 *                 for a member who has not reached the first tier.
 */
export function cardImageForTier(tierName?: string | null): string {
  if (!tierName) return UNTIERED_CARD;
  return CARDS[tierName.trim().toLowerCase()] || UNTIERED_CARD;
}

export default cardImageForTier;
