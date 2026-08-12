/** Central site configuration — prefer env over hardcoded fallbacks. */

export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://turtle-soup-rust.vercel.app';
}

export function getContactEmail(): string {
  return process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'okto0914@gmail.com';
}

export const SITE_LAST_UPDATED = '2026-08-12';
