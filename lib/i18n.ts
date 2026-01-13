// 간단한 i18n 유틸리티
import koMessages from '@/messages/ko.json';
import enMessages from '@/messages/en.json';

export type Locale = 'ko' | 'en';

export const locales: Locale[] = ['ko', 'en'];
export const defaultLocale: Locale = 'ko';

export const messages = {
  ko: koMessages,
  en: enMessages,
} as const;

export function getMessages(locale: Locale) {
  return messages[locale] || messages[defaultLocale];
}

export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}

