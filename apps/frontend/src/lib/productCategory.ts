/**
 * Which category a zai product belongs to.
 *
 * The RWA catalogue's `collection` field is the source of truth: "Ski",
 * "Apparel" or "Accessories". We classify from it first and only fall back to
 * keyword guessing when collection is empty.
 *
 * Shared by the My Collection page and the claim drawer so both group a
 * product the same way.
 */

export type Category = 'ski' | 'apparel' | 'accessory';

export const CATEGORY_ORDER: Category[] = ['ski', 'apparel', 'accessory'];

const SKI_KEYWORDS = ['ski', 'alpine', 'cross-country', 'freeride', 'slalom', 'race', 'touring'];
const ACCESSORY_KEYWORDS = ['accessor', 'pole', 'bag', 'helmet', 'goggle', 'wax', 'strap', 'cover'];

export const getCategory = (name?: string, collection?: string, type?: string): Category => {
  const col = (collection || '').trim().toLowerCase();
  if (col.includes('ski')) return 'ski';
  if (col.includes('accessor')) return 'accessory';
  if (col.includes('apparel')) return 'apparel';

  // No usable collection value — fall back to keyword guessing.
  const text = `${name || ''} ${collection || ''} ${type || ''}`.toLowerCase();
  if (SKI_KEYWORDS.some(kw => text.includes(kw))) return 'ski';
  if (ACCESSORY_KEYWORDS.some(kw => text.includes(kw))) return 'accessory';
  return 'apparel';
};
