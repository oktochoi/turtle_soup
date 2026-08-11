// 간단한 i18n 유틸리티 — 한국어 단일 언어
import koMessages from '@/messages/ko.json';

export type Locale = 'ko';

export const locales: Locale[] = ['ko'];
export const defaultLocale: Locale = 'ko';

export const messages = {
  ko: koMessages,
} as const;

export function getMessages(_locale: Locale) {
  return messages.ko;
}

export function isValidLocale(locale: string): locale is Locale {
  return locale === 'ko';
}
