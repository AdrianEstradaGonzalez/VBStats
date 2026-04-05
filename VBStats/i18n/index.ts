/**
 * i18n configuration for VBStats
 * Uses i18next with react-i18next for React Native internationalization
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { es, en, pt, fr } from './locales';

const LANGUAGE_STORAGE_KEY = '@VBStats:language';

export const SUPPORTED_LANGUAGES = [
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
] as const;

export type LanguageCode = typeof SUPPORTED_LANGUAGES[number]['code'];

const resources = {
  es: { translation: es },
  en: { translation: en },
  pt: { translation: pt },
  fr: { translation: fr },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'es', // Default language
    fallbackLng: 'es',
    interpolation: {
      escapeValue: false, // React already handles XSS
    },
    compatibilityJSON: 'v4',
  });

/**
 * Load the saved language preference from AsyncStorage
 */
export const loadSavedLanguage = async (): Promise<void> => {
  try {
    const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (savedLanguage && SUPPORTED_LANGUAGES.some(l => l.code === savedLanguage)) {
      await i18n.changeLanguage(savedLanguage);
    }
  } catch (error) {
    console.warn('Error loading saved language:', error);
  }
};

/**
 * Change the app language and persist the selection
 */
export const changeLanguage = async (languageCode: LanguageCode): Promise<void> => {
  try {
    await i18n.changeLanguage(languageCode);
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, languageCode);
  } catch (error) {
    console.error('Error changing language:', error);
  }
};

/**
 * Get the current language code
 */
export const getCurrentLanguage = (): LanguageCode => {
  return (i18n.language || 'es') as LanguageCode;
};

export default i18n;
