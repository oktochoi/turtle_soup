'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import LanguageSwitcher from '@/components/LanguageSwitcher';
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
  
  // 현재 언어 추출
  const currentLang = pathname?.split('/')[1] || 'ko';

  useEffect(() => {
    const loadNickname = async () => {
      if (!user) {
        setUserNickname(null);
        return;
      }

      try {
        const supabase = createClient();
        // game_users 테이블에서 유저 정보 가져오기
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
          // game_users에 없으면 public.users에서 확인
          const { data: userProfile, error: profileError } = await supabase
            .from('users')
            .select('nickname')
            .eq('id', user.id)
            .maybeSingle();
          
          if (profileError) {
            console.error('프로필 로드 오류:', profileError);
          }
          
          if (userProfile?.nickname) {
            setUserNickname(userProfile.nickname);
          } else {
            // 닉네임이 없으면 이메일 앞부분 사용
            setUserNickname(user.email?.split('@')[0] || '사용자');
          }
        }
      } catch (error: any) {
        // AbortError는 무해한 에러이므로 무시 (컴포넌트 언마운트 시 발생 가능)
        if (error?.name !== 'AbortError' && error?.message?.includes('aborted') === false) {
          console.error('프로필 로드 오류:', error);
        }
        setUserNickname(user.email?.split('@')[0] || '사용자');
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
        const { data: userData } = await supabase
          .from('users')
          .select('is_admin')
          .eq('id', user.id)
          .single();

        setIsAdmin(userData?.is_admin || false);
      } catch (error) {
        setIsAdmin(false);
      }
    };

    checkAdmin();
  }, [user]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    // useAuth 훅이 자동으로 인증 상태를 업데이트합니다
    router.push(`/${currentLang}`);
    router.refresh();
  };

  const isActive = (path: string) => {
    // 언어 코드를 포함한 경로로 비교
    const pathWithLang = `/${currentLang}${path === '/' ? '' : path}`;
    if (path === '/') {
      return pathname === `/${currentLang}` || pathname === `/${currentLang}/`;
    }
    return pathname?.startsWith(pathWithLang);
  };

  const getLocalizedPath = (path: string) => {
    return `/${currentLang}${path === '/' ? '' : path}`;
  };

  const navLinks = [
    { href: '/rooms', label: t.nav.multiplayer, activeColor: 'bg-teal-500' },
    { href: '/problems', label: t.nav.problems, activeColor: 'bg-purple-500' },
    { href: '/create-problem', label: t.nav.playGame, activeColor: 'bg-pink-500' },
    { href: '/community', label: t.nav.community, activeColor: 'bg-blue-500' },
    { href: '/ranking', label: t.nav.ranking, activeColor: 'bg-yellow-500' },
    { href: '/tutorial', label: t.nav.tutorial, activeColor: 'bg-cyan-500' },
  ];

  return (
    <header className="bg-slate-900/80 backdrop-blur-sm border-b border-slate-700 sticky top-0 z-50">
      <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          <Link href={getLocalizedPath('/')} className="flex items-center gap-2">
            <i className="ri-question-line text-teal-400 text-xl sm:text-2xl"></i>
            <span className="text-lg sm:text-xl font-bold bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
              {currentLang === 'ko' ? '바다거북스프' : 'Pelican Soup Riddle'}
            </span>
          </Link>
          
          {/* 데스크톱 네비게이션 */}
          <nav className="hidden md:flex items-center gap-2 lg:gap-3">
            {navLinks.map((link) => (
              <Link key={link.href} href={getLocalizedPath(link.href)}>
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
            
            {/* 언어 전환 버튼 */}
            <LanguageSwitcher />
            
            {/* 알림 벨 */}
            {user && <NotificationBell lang={currentLang} />}
            
            {/* 로그인/로그아웃 버튼 */}
            {authLoading ? (
              <div className="px-3 py-1.5 lg:px-4 lg:py-2 rounded-lg text-sm font-semibold bg-slate-800 text-slate-400 ml-2">
                <i className="ri-loader-4-line animate-spin"></i>
              </div>
            ) : user ? (
              <div className="flex items-center gap-3 ml-2">
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <Link href={getLocalizedPath('/admin/reports')}>
                      <button className="px-3 py-1.5 lg:px-4 lg:py-2 rounded-lg text-sm font-semibold transition-all bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30">
                        <i className="ri-shield-user-line mr-1"></i>
                        {currentLang === 'ko' ? '신고 관리' : 'Reports'}
                      </button>
                    </Link>
                    <Link href={getLocalizedPath('/admin/bug-reports')}>
                      <button className="px-3 py-1.5 lg:px-4 lg:py-2 rounded-lg text-sm font-semibold transition-all bg-purple-500/20 text-purple-400 border border-purple-500/50 hover:bg-purple-500/30">
                        <i className="ri-bug-line mr-1"></i>
                        {currentLang === 'ko' ? '버그 리포트' : 'Bug Reports'}
                      </button>
                    </Link>
                  </div>
                )}
                {gameUserId && (
                  <Link href={getLocalizedPath(`/profile/${gameUserId}`)}>
                    <button className="px-3 py-1.5 lg:px-4 lg:py-2 rounded-lg text-sm font-semibold transition-all bg-slate-800 text-slate-300 hover:bg-slate-700">
                      {t.common.myPage}
                    </button>
                  </Link>
                )}
                <span className="text-sm text-slate-300 font-medium">
                  {userNickname || user.email?.split('@')[0] || (currentLang === 'ko' ? '사용자' : 'User')}{currentLang === 'ko' ? '님' : ''}
                </span>
                <button
                  onClick={handleSignOut}
                  className="px-3 py-1.5 lg:px-4 lg:py-2 rounded-lg text-sm font-semibold transition-all bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30"
                >
                  {t.common.logout}
                </button>
              </div>
            ) : (
              <Link href={getLocalizedPath('/auth/login')}>
                <button className="px-3 py-1.5 lg:px-4 lg:py-2 rounded-lg text-sm font-semibold transition-all bg-gradient-to-r from-teal-500 to-cyan-500 text-white hover:from-teal-600 hover:to-cyan-600 ml-2">
                  {t.common.login}
                </button>
              </Link>
            )}
          </nav>

          {/* 모바일 햄버거 버튼 */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-all"
            aria-label={currentLang === 'ko' ? '메뉴 열기' : 'Open menu'}
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
                  href={getLocalizedPath(link.href)}
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
              
              {/* 모바일 로그인/로그아웃 버튼 */}
              <div className="border-t border-slate-700 pt-2 mt-2">
                {authLoading ? (
                  <div className="px-4 py-3 text-sm text-slate-400 text-center">
                    <i className="ri-loader-4-line animate-spin"></i>
                  </div>
                ) : user ? (
                  <>
                    {isAdmin && (
                      <>
                        <Link
                          href={getLocalizedPath('/admin/reports')}
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          <button className="w-full px-4 py-3 rounded-lg text-sm font-semibold transition-all text-left bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30 mb-2">
                            <i className="ri-shield-user-line mr-2"></i>
                            {currentLang === 'ko' ? '신고 관리' : 'Reports'}
                          </button>
                        </Link>
                        <Link
                          href={getLocalizedPath('/admin/bug-reports')}
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          <button className="w-full px-4 py-3 rounded-lg text-sm font-semibold transition-all text-left bg-purple-500/20 text-purple-400 border border-purple-500/50 hover:bg-purple-500/30 mb-2">
                            <i className="ri-bug-line mr-2"></i>
                            {currentLang === 'ko' ? '버그 리포트' : 'Bug Reports'}
                          </button>
                        </Link>
                      </>
                    )}
                    {gameUserId && (
                      <Link
                        href={getLocalizedPath(`/profile/${gameUserId}`)}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <button className="w-full px-4 py-3 rounded-lg text-sm font-semibold transition-all text-left bg-slate-800 text-slate-300 hover:bg-slate-700 mb-2">
                          {t.common.myPage}
                        </button>
                      </Link>
                    )}
                    <div className="px-4 py-2 text-sm text-slate-300 font-medium">
                      {userNickname || user.email?.split('@')[0] || (currentLang === 'ko' ? '사용자' : 'User')}{currentLang === 'ko' ? '님' : ''}
                    </div>
                    <button
                      onClick={() => {
                        handleSignOut();
                        setIsMobileMenuOpen(false);
                      }}
                      className="w-full px-4 py-3 rounded-lg text-sm font-semibold transition-all text-left bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30"
                    >
                      {t.common.logout}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="px-4 py-2 mb-2">
                      <LanguageSwitcher />
                    </div>
                    <Link
                      href={getLocalizedPath('/auth/login')}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <button className="w-full px-4 py-3 rounded-lg text-sm font-semibold transition-all text-left bg-gradient-to-r from-teal-500 to-cyan-500 text-white hover:from-teal-600 hover:to-cyan-600">
                        {t.common.login}
                      </button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}

