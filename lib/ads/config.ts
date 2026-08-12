/** AdSense publisher + slot IDs (set in .env.local) */

export const ADSENSE_CLIENT_ID =
  process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID || 'ca-pub-4462339094246168';

export type AdSlotVariant = 'home' | 'infeed' | 'closed';

const SLOT_ENV: Record<AdSlotVariant, string | undefined> = {
  home: process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME,
  infeed: process.env.NEXT_PUBLIC_ADSENSE_SLOT_INFEED,
  closed: process.env.NEXT_PUBLIC_ADSENSE_SLOT_CLOSED,
};

/** Resolve slot id for a placement; empty string = hide slot (safe default). */
export function getAdSlotId(variant: AdSlotVariant): string {
  return SLOT_ENV[variant]?.trim() || '';
}

export function isAdSenseEnabled(): boolean {
  return Boolean(ADSENSE_CLIENT_ID);
}
