import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import de from './locales/de.json';
import zh from './locales/zh.json';
import fr from './locales/fr.json';

export type SupportedLanguage = 'en' | 'de' | 'zh' | 'fr';

// Order drives both language switchers (public hero + Settings), which map
// over this array — adding a code here is all it takes to offer it.
export const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['en', 'de', 'fr', 'zh'];

/**
 * Map any incoming language hint (DB value, browser locale, etc.)
 * to one of our supported languages, defaulting to English.
 */
export function mapToSupportedLanguage(input?: string | null): SupportedLanguage {
  if (!input) return 'en';
  const lower = input.toLowerCase();
  if (lower.startsWith('de')) return 'de';
  if (lower.startsWith('fr')) return 'fr';
  if (lower.startsWith('zh')) return 'zh';
  return 'en';
}

function getInitialLanguage(): SupportedLanguage {
  // 1) Logged-in user's saved preference (persisted user object from AppContext)
  try {
    const storedUserRaw = localStorage.getItem('zai_user');
    if (storedUserRaw) {
      const storedUser = JSON.parse(storedUserRaw);
      if (storedUser?.language) return mapToSupportedLanguage(storedUser.language);
    }
  } catch {
    /* ignore malformed storage */
  }

  // 2) Explicit choice made by a NOT-logged-in visitor via the language
  //    switcher in the public Home hero. A logged-in user's DB-backed
  //    preference above deliberately wins over this.
  try {
    const anon = localStorage.getItem('zai_lang');
    if (anon) return mapToSupportedLanguage(anon);
  } catch {
    /* ignore blocked/malformed storage */
  }

  // 3) Browser language
  if (typeof navigator !== 'undefined' && navigator.language) {
    return mapToSupportedLanguage(navigator.language);
  }

  // 4) Fallback
  return 'en';
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    de: { translation: de },
    zh: { translation: zh },
    fr: { translation: fr },
  },
  lng: getInitialLanguage(),
  fallbackLng: 'en',
  supportedLngs: SUPPORTED_LANGUAGES,
  interpolation: {
    escapeValue: false,
  },
  returnObjects: true,
});

export default i18n;
