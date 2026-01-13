'use client';

import { useParams, usePathname, useRouter } from 'next/navigation';
import { type Locale, locales } from '@/lib/i18n';

export default function LanguageSwitcher() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const currentLang = (params?.lang as Locale) || 'ko';

  const switchLanguage = (newLang: Locale) => {
    if (newLang === currentLang) return;

    // 현재 경로에서 언어 코드만 교체
    const pathWithoutLang = pathname.replace(/^\/[^/]+/, '');
    const newPath = `/${newLang}${pathWithoutLang || ''}`;
    
    router.push(newPath);
  };

  return (
    <div className="flex items-center gap-2">
      {locales.map((lang) => (
        <button
          key={lang}
          onClick={() => switchLanguage(lang)}
          className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
            currentLang === lang
              ? 'bg-teal-500 text-white'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          {lang.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

