import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import 'intl-pluralrules';

import en from './locales/en.json';
import it from './locales/it.json';

const resources = {
  en: { translation: en },
  it: { translation: it },
};

const deviceLanguage = getLocales()[0]?.languageCode ?? 'en';

i18next
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v3', // Required for Android
    resources,
    lng: deviceLanguage, // Set initial language from device
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // react handles XSS
    },
  });

export default i18next;
