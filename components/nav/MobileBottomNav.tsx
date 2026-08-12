'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Mobile bottom nav — max 4 items.
 * Hidden on desktop; play screen keeps sticky input clear via pb on layout.
 */
export default function MobileBottomNav() {
  const pathname = usePathname() || '';
  const lang = pathname.split('/')[1] || 'ko';
  const { user } = useAuth();
  const [profileId, setProfileId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) {
        setProfileId(null);
        return;
      }
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('game_users')
          .select('id')
          .eq('auth_user_id', user.id)
          .maybeSingle();
        if (!cancelled) setProfileId(data?.id || null);
      } catch {
        if (!cancelled) setProfileId(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Hide on auth / admin / room play to reduce clutter
  if (
    pathname.includes('/auth/') ||
    pathname.includes('/admin/') ||
    pathname.includes('/room/') ||
    pathname.includes('/turtle_room/') ||
    /\/problem\//.test(pathname)
  ) {
    return null;
  }

  const base = `/${lang}`;
  const myHref = profileId ? `${base}/profile/${profileId}` : `${base}/auth/login`;

  const items = [
    { href: base, label: '홈', icon: 'ri-home-5-line', match: (p: string) => p === base || p === `${base}/` },
    {
      href: `${base}/problems`,
      label: '사건',
      icon: 'ri-folder-open-line',
      match: (p: string) => p.includes('/problems'),
    },
    {
      href: `${base}/create-problem`,
      label: '만들기',
      icon: 'ri-add-circle-line',
      match: (p: string) => p.includes('/create-problem'),
    },
    {
      href: myHref,
      label: 'MY',
      icon: 'ri-user-3-line',
      match: (p: string) => p.includes('/profile/'),
    },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-slate-800 bg-slate-950/95 backdrop-blur-md"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="하단 메뉴"
    >
      <ul className="grid grid-cols-4 h-14">
        {items.map((item) => {
          const active = item.match(pathname);
          return (
            <li key={item.label}>
              <Link
                href={item.href}
                className={`flex h-full flex-col items-center justify-center gap-0.5 text-[11px] ${
                  active ? 'text-teal-300' : 'text-slate-400'
                }`}
              >
                <i className={`${item.icon} text-lg`} aria-hidden />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
