'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import NotificationBell from '../components/NotificationBell';
import { useTranslations } from '@/hooks/useTranslations';

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const t = useTranslations();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [userNickname, setUserNickname] = useState<string | null>(null);
  const [gameUserId, setGameUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const currentLang = pathname?.split('/')[1] || 'ko';

  useEffect(() => {
    const loadNickname = async () => {
      if (!user) {
        setUserNickname(null);
        return;
      }

      try {
        const supabase = createClient();
        const { data: gameUser, error: gameUserError } = await supabase
          .from('game_users')
          .select('id, nickname')
          .eq('auth_user_id', user.id)
          .maybeSingle();

        if (gameUserError) {
          console.error('게임 유저 로드 오류:', gameUserError);
        }

        if (gameUser) {
          setGameUserId(gameUser.id);
          setUserNickname(gameUser.nickname);
        } else {
          const { data: userProfile, error: profileError } = await supabase
            .from('users')
            .select('nickname')
            .eq('id', user.id)
            .maybeSingle();

          if (profileError) {
            console.error('프로필 로드 오류:', profileError);
          }

          setUserNickname(userProfile?.nickname || '사용자');
        }
      } catch (error: any) {
        if (error?.name !== 'AbortError' && error?.message?.includes('aborted') === false) {
          console.error('프로필 로드 오류:', error);
        }
        setUserNickname('사용자');
      }
    };

    loadNickname();
  }, [user]);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        setIsAdmin(false);
        return;
      }

      try {
        const supabase = createClient();
        const { data: userData, error } = await supabase
          .from('users')
          .select('is_admin')
          .eq('id', user.id)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('관리자 권한 확인 오류:', error.message || error);
          setIsAdmin(false);
          return;
        }

        setIsAdmin(userData?.is_admin || false);
      } catch (error: any) {
        if (error?.name !== 'AbortError' && error?.message?.includes('aborted') === false) {
          console.error('관리자 권한 확인 오류:', error?.message || error);
        }
        setIsAdmin(false);
      }
    };

    checkAdmin();
  }, [user]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push(`/${currentLang}`);
    router.refresh();
  };

  const isActive = (path: string) => {
    const pathWithoutQuery = path.split('?')[0];
    const pathWithLang = `/${currentLang}${pathWithoutQuery === '/' ? '' : pathWithoutQuery}`;
    if (pathWithoutQuery === '/') {
      return pathname === `/${currentLang}` || pathname === `/${currentLang}/`;
    }
    return pathname?.startsWith(pathWithLang);
  };

  const getLocalizedPath = (path: string) => {
    return `/${currentLang}${path === '/' ? '' : path}`;
  };

  const navLinks = [
    { href: '/problems', label: '사건' },
    { href: '/ranking', label: '랭킹' },
    { href: '/create-problem', label: '사건 만들기' },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md">
      <div className="page-shell py-3 sm:py-4">
        <div className="flex items-center justify-between gap-4">
          <Link
            href={getLocalizedPath('/')}
            className="group flex items-center gap-2 min-w-0"
            aria-label="홈으로"
          >
            <i className="ri-question-line text-teal-400 text-xl sm:text-2xl" aria-hidden />
            <span className="text-lg sm:text-xl font-bold bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
              바다거북스프
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1" aria-label="메인 메뉴">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={getLocalizedPath(link.href)}
                className={isActive(link.href) ? 'nav-link-active' : 'nav-link'}
              >
                {link.label}
              </Link>
            ))}

            {user && <NotificationBell lang={currentLang} />}

            {authLoading ? (
              <div className="ml-2 flex h-10 w-10 items-center justify-center text-slate-400">
                <i className="ri-loader-4-line animate-spin" aria-hidden />
              </div>
            ) : user ? (
              <div className="ml-2 flex items-center gap-2">
                {isAdmin && (
                  <Link href={getLocalizedPath('/admin/dashboard')} className="nav-link text-teal-300">
                    관리
                  </Link>
                )}
                {gameUserId && (
                  <Link href={getLocalizedPath(`/profile/${gameUserId}`)} className="nav-link">
                    {t.common.myPage}
                  </Link>
                )}
                <span className="hidden lg:inline text-sm text-slate-400">{userNickname || '사용자'}</span>
                <button type="button" onClick={handleSignOut} className="btn-ghost !py-1.5 !px-3 text-xs">
                  {t.common.logout}
                </button>
              </div>
            ) : (
              <Link href={getLocalizedPath('/auth/login')} className="btn-primary ml-2 !py-1.5 !px-4 text-xs">
                {t.common.login}
              </Link>
            )}
          </nav>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden btn-ghost !p-2"
            aria-label={isMobileMenuOpen ? '메뉴 닫기' : '메뉴 열기'}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-nav"
          >
            <i className={`ri-${isMobileMenuOpen ? 'close' : 'menu'}-line text-xl`} aria-hidden />
          </button>
        </div>

        {isMobileMenuOpen && (
          <nav
            id="mobile-nav"
            className="md:hidden mt-4 border-t border-slate-800 pt-4"
            aria-label="모바일 메뉴"
          >
            <div className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={getLocalizedPath(link.href)}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={isActive(link.href) ? 'nav-link-active' : 'nav-link'}
                >
                  {link.label}
                </Link>
              ))}

              <div className="divider my-3" />

              {authLoading ? (
                <div className="px-3 py-3 text-slate-400 text-center">
                  <i className="ri-loader-4-line animate-spin" aria-hidden />
                </div>
              ) : user ? (
                <>
                  {isAdmin && (
                    <>
                      <Link
                        href={getLocalizedPath('/admin/dashboard')}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="nav-link"
                      >
                        대시보드
                      </Link>
                      <Link
                        href={getLocalizedPath('/admin/ai-puzzles')}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="nav-link"
                      >
                        AI 문제 검수
                      </Link>
                      <Link
                        href={getLocalizedPath('/admin/reports')}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="nav-link"
                      >
                        신고 관리
                      </Link>
                      <Link
                        href={getLocalizedPath('/admin/bug-reports')}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="nav-link"
                      >
                        버그 리포트
                      </Link>
                    </>
                  )}
                  {gameUserId && (
                    <Link
                      href={getLocalizedPath(`/profile/${gameUserId}`)}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="nav-link"
                    >
                      {t.common.myPage}
                    </Link>
                  )}
                  <p className="px-3 py-2 text-sm text-slate-400">{userNickname || '사용자'}님</p>
                  <button
                    type="button"
                    onClick={() => {
                      handleSignOut();
                      setIsMobileMenuOpen(false);
                    }}
                    className="btn-danger w-full justify-start"
                  >
                    {t.common.logout}
                  </button>
                </>
              ) : (
                <Link
                  href={getLocalizedPath('/auth/login')}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="btn-primary w-full"
                >
                  {t.common.login}
                </Link>
              )}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
