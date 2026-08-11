'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

export default function SocialBottomBar() {
  const pathname = usePathname();
  const lang = pathname?.split('/')[1] || 'ko';

  const socialLinks = [
    {
      name: 'YouTube',
      url: 'https://youtube.com/@funzip.1.8?si=8LIPCwY5tYiEHoX9',
      icon: 'ri-youtube-fill',
    },
    {
      name: 'TikTok',
      url: 'https://www.tiktok.com/@funzip.1.7?_r=1&_d=f1a1mbhbm4dafh&sec_uid=MS4wLjABAAAA9z1f4X8isSHjpdbgM6BRdxs6n40Xze6fFkjhGvXd2FCWkkUTumqX2asT_UqQHhm_&share_author_id=7592308534436938770&sharer_language=ko&source=h5_t&u_code=f1a7gk3jh50g5g&timestamp=1768462146&user_id=7592308534436938770&sec_user_id=MS4wLjABAAAA9z1f4X8isSHjpdbgM6BRdxs6n40Xze6fFkjhGvXd2FCWkkUTumqX2asT_UqQHhm_&item_author_type=1&utm_source=copy&utm_campaign=client_share&utm_medium=android&share_iid=7592308369671849746&share_link_id=07bc8e',
      icon: 'ri-tiktok-fill',
    },
    {
      name: 'Instagram',
      url: 'https://www.instagram.com/funzip.1.7?igsh=M3hoeHhnanh6Nmtq',
      icon: 'ri-instagram-fill',
    },
    {
      name: 'KakaoTalk',
      url: 'https://open.kakao.com/o/gci21wai',
      icon: 'ri-chat-3-fill',
    },
  ];

  const legalLinks = [
    { href: `/${lang}/guide`, label: '소개' },
    { href: `/${lang}/guide`, label: '가이드' },
    { href: `/${lang}/faq`, label: 'FAQ' },
    { href: `/${lang}/privacy`, label: '개인정보' },
    { href: `/${lang}/terms`, label: '이용약관' },
    { href: `/${lang}/contact`, label: '문의' },
  ];

  return (
    <footer className="mt-auto border-t border-slate-800 bg-slate-950">
      <div className="page-shell py-8 sm:py-10">
        <div className="flex flex-col items-center gap-6">
          <div className="text-center">
            <p className="text-lg font-semibold text-white">바다거북스프</p>
            <p className="mt-1 text-sm text-slate-400">질문으로 진실을 밝혀내는 추리 놀이터</p>
          </div>

          <div className="flex items-center justify-center gap-3 sm:gap-5">
            {socialLinks.map((link) => (
              <a
                key={link.name}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-700 text-slate-400 transition hover:border-teal-500/40 hover:text-teal-300"
                title={link.name}
                aria-label={link.name}
              >
                <i className={`${link.icon} text-xl`} aria-hidden />
              </a>
            ))}
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-slate-400">
            {legalLinks.map((link) => (
              <Link key={link.label} href={link.href} className="hover:text-white transition-colors">
                {link.label}
              </Link>
            ))}
          </nav>

          <p className="text-xs text-slate-500">© {new Date().getFullYear()} 바다거북스프</p>
        </div>
      </div>
    </footer>
  );
}
