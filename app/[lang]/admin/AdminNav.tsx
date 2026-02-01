'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminNav() {
  const pathname = usePathname();
  const lang = pathname?.split('/')[1] || 'ko';
  const base = `/${lang}/admin`;

  const navItems = [
    { href: `${base}/dashboard`, icon: 'ri-dashboard-line', labelKo: '대시보드', labelEn: 'Dashboard' },
    { href: `${base}/bug-reports`, icon: 'ri-bug-line', labelKo: '버그 리포트', labelEn: 'Bug Reports' },
    { href: `${base}/reports`, icon: 'ri-flag-line', labelKo: '사용자 신고', labelEn: 'User Reports' },
  ];

  return (
    <aside className="w-full lg:w-56 shrink-0">
      <div className="sticky top-4 space-y-2">
        <Link
          href={`/${lang}`}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors text-sm"
        >
          <i className="ri-arrow-left-line"></i>
          {lang === 'ko' ? '홈으로' : 'Home'}
        </Link>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-teal-500/20 text-teal-400 border border-teal-500/50'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <i className={`${item.icon} text-lg`}></i>
                {lang === 'ko' ? item.labelKo : item.labelEn}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
