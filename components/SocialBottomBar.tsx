'use client';

import { usePathname } from 'next/navigation';

export default function SocialBottomBar() {
  const pathname = usePathname();
  const lang = pathname?.split('/')[1] || 'ko';

  const socialLinks = [
    {
      name: 'YouTube',
      url: 'https://youtube.com/@funzip.1.8?si=8LIPCwY5tYiEHoX9',
      icon: 'ri-youtube-fill',
      color: 'text-red-500 hover:text-red-400',
      bgColor: 'hover:bg-red-500/10',
    },
    {
      name: 'TikTok',
      url: 'https://www.tiktok.com/@funzip.1.7?_r=1&_d=f1a1mbhbm4dafh&sec_uid=MS4wLjABAAAA9z1f4X8isSHjpdbgM6BRdxs6n40Xze6fFkjhGvXd2FCWkkUTumqX2asT_UqQHhm_&share_author_id=7592308534436938770&sharer_language=ko&source=h5_t&u_code=f1a7gk3jh50g5g&timestamp=1768462146&user_id=7592308534436938770&sec_user_id=MS4wLjABAAAA9z1f4X8isSHjpdbgM6BRdxs6n40Xze6fFkjhGvXd2FCWkkUTumqX2asT_UqQHhm_&item_author_type=1&utm_source=copy&utm_campaign=client_share&utm_medium=android&share_iid=7592308369671849746&share_link_id=07bc8e',
      icon: 'ri-tiktok-fill',
      color: 'text-black dark:text-white hover:text-pink-500',
      bgColor: 'hover:bg-pink-500/10',
    },
    {
      name: 'Instagram',
      url: 'https://www.instagram.com/funzip.1.7?igsh=M3hoeHhnanh6Nmtq',
      icon: 'ri-instagram-fill',
      color: 'text-pink-500 hover:text-pink-400',
      bgColor: 'hover:bg-pink-500/10',
    },
    {
      name: 'KakaoTalk',
      url: 'https://open.kakao.com/o/gci21wai',
      icon: 'ri-chat-3-fill',
      color: 'text-yellow-400 hover:text-yellow-300',
      bgColor: 'hover:bg-yellow-400/10',
    },
  ];

  return (
    <footer className="w-full bg-slate-900 border-t border-slate-700/50 mt-auto">
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <div className="flex items-center justify-center gap-4 sm:gap-6 md:gap-8">
          {socialLinks.map((link) => (
            <a
              key={link.name}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`
                flex flex-col items-center justify-center
                px-4 sm:px-5 py-3 sm:py-4
                rounded-lg
                transition-all duration-200
                ${link.bgColor}
                ${link.color}
                group
                min-w-[70px] sm:min-w-[90px]
              `}
              title={link.name}
            >
              <i className={`${link.icon} text-2xl sm:text-3xl mb-2 transition-transform group-hover:scale-110`}></i>
              <span className="text-xs sm:text-sm font-medium opacity-80 group-hover:opacity-100">
                {link.name}
              </span>
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}

