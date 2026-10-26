import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import 'intl-pluralrules';
import { useUserStore, type LanguagePref } from '@/store/userStore';

import en from './locales/en.json';
import it from './locales/it.json';

export const SUPPORTED_LANGUAGES = ['en', 'it'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const resources = {
  en: { translation: en },
  it: { translation: it },
} as const;

function deviceLanguage(): SupportedLanguage {
  const code = getLocales()[0]?.languageCode ?? 'en';
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(code) ? (code as SupportedLanguage) : 'en';
}

export function resolveLanguage(pref: LanguagePref): SupportedLanguage {
  return pref === 'system' ? deviceLanguage() : pref;
}

// The user store is MMKV-backed and hydrates synchronously, so the saved preference is
// available here at boot and the first frame already renders in the right language.
void i18next.use(initReactI18next).init({
  resources,
  lng: resolveLanguage(useUserStore.getState().language),
  fallbackLng: 'en',
  interpolation: { escapeValue: false }, // React escapes output
  returnNull: false,
  showSupportNotice: false, // i18next >= 25.8 logs a promotional notice on every launch
});

useUserStore.subscribe((state, prev) => {
  if (state.language !== prev.language) void i18next.changeLanguage(resolveLanguage(state.language));
});

export default i18next;
