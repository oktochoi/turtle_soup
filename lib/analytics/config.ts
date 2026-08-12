/** Google Analytics 4 — set NEXT_PUBLIC_GA_MEASUREMENT_ID in .env.local */

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || '';

export function isAnalyticsEnabled(): boolean {
  return GA_MEASUREMENT_ID.length > 0 && GA_MEASUREMENT_ID !== 'GA_MEASUREMENT_ID';
}
