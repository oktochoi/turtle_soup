'use client';

import { useEffect, useRef } from 'react';
import { ADSENSE_CLIENT_ID, getAdSlotId, type AdSlotVariant } from '@/lib/ads/config';

interface AdSlotProps {
  /** Placement key — maps to NEXT_PUBLIC_ADSENSE_SLOT_* env vars */
  variant?: AdSlotVariant;
  /** Override slot id (optional) */
  slot?: string;
  format?: 'auto' | 'fluid' | 'rectangle' | 'vertical' | 'horizontal';
  responsive?: boolean;
  className?: string;
  label?: string;
}

export default function AdSlot({
  variant = 'infeed',
  slot,
  format = 'auto',
  responsive = true,
  className = '',
  label = 'Advertisement',
}: AdSlotProps) {
  const slotId = slot?.trim() || getAdSlotId(variant);
  const adRef = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  useEffect(() => {
    if (!ADSENSE_CLIENT_ID || !slotId || pushed.current) return;
    try {
      ((window as unknown as { adsbygoogle?: unknown[] }).adsbygoogle =
        (window as unknown as { adsbygoogle?: unknown[] }).adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // AdSense script not loaded yet
    }
  }, [slotId]);

  if (!ADSENSE_CLIENT_ID || !slotId) return null;

  return (
    <aside
      className={`overflow-hidden rounded-xl border border-slate-800/80 bg-slate-950/40 ${className}`}
      aria-label={label}
    >
      <p className="px-3 pt-2 text-[10px] uppercase tracking-[0.16em] text-slate-600">Ad</p>
      <ins
        ref={adRef}
        className="adsbygoogle block min-h-[90px] px-2 pb-2"
        style={{ display: 'block' }}
        data-ad-client={ADSENSE_CLIENT_ID}
        data-ad-slot={slotId}
        data-ad-format={format}
        data-full-width-responsive={responsive ? 'true' : 'false'}
      />
    </aside>
  );
}
