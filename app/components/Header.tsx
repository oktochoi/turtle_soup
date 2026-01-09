'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

export default function Header() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === '/') {
      return pathname === '/';
    }
    return pathname?.startsWith(path);
  };

  const navLinks = [
    { href: '/create-room', label: '멀티 플레이', activeColor: 'bg-teal-500' },
    { href: '/problems', label: '문제 풀기', activeColor: 'bg-purple-500' },
    { href: '/create-problem', label: '게임 만들기', activeColor: 'bg-pink-500' },
    { href: '/tutorial', label: '게임 설명', activeColor: 'bg-cyan-500' },
  ];

  return (
    <header className="bg-slate-900/80 backdrop-blur-sm border-b border-slate-700 sticky top-0 z-50">
      <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <i className="ri-question-line text-teal-400 text-xl sm:text-2xl"></i>
            <span className="text-lg sm:text-xl font-bold bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
              바다거북스프
            </span>
          </Link>
          
          {/* 데스크톱 네비게이션 */}
          <nav className="hidden md:flex items-center gap-2 lg:gap-3">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <button
                  className={`px-3 py-1.5 lg:px-4 lg:py-2 rounded-lg text-sm font-semibold transition-all ${
                    isActive(link.href)
                      ? `${link.activeColor} text-white`
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {link.label}
                </button>
              </Link>
            ))}
          </nav>

          {/* 모바일 햄버거 버튼 */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-all"
            aria-label="메뉴 열기"
          >
            <i className={`ri-${isMobileMenuOpen ? 'close' : 'menu'}-line text-xl`}></i>
          </button>
        </div>

        {/* 모바일 메뉴 */}
        {isMobileMenuOpen && (
          <nav className="md:hidden mt-4 pb-2 border-t border-slate-700 pt-4">
            <div className="flex flex-col gap-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <button
                    className={`w-full px-4 py-3 rounded-lg text-sm font-semibold transition-all text-left ${
                      isActive(link.href)
                        ? `${link.activeColor} text-white`
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {link.label}
                  </button>
                </Link>
              ))}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}

