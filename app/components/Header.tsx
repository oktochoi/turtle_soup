'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [userNickname, setUserNickname] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    
    // 현재 사용자 가져오기 및 닉네임 로드
    const loadUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
        
        if (user) {
          // public.users 테이블에서 닉네임 가져오기
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
          console.error('사용자 로드 오류:', error);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();

    // 인증 상태 변화 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      
      if (session?.user) {
        try {
          // public.users 테이블에서 닉네임 가져오기
          const { data: userProfile, error: profileError } = await supabase
            .from('users')
            .select('nickname')
            .eq('id', session.user.id)
            .maybeSingle();
          
          if (profileError) {
            console.error('프로필 로드 오류:', profileError);
          }
          
          if (userProfile?.nickname) {
            setUserNickname(userProfile.nickname);
          } else {
            setUserNickname(session.user.email?.split('@')[0] || '사용자');
          }
        } catch (error: any) {
          // AbortError는 무해한 에러이므로 무시 (컴포넌트 언마운트 시 발생 가능)
          if (error?.name !== 'AbortError' && error?.message?.includes('aborted') === false) {
            console.error('프로필 로드 오류:', error);
          }
          setUserNickname(session.user.email?.split('@')[0] || '사용자');
        }
      } else {
        setUserNickname(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    router.push('/');
    router.refresh();
  };

  const isActive = (path: string) => {
    if (path === '/') {
      return pathname === '/';
    }
    return pathname?.startsWith(path);
  };

  const navLinks = [
    { href: '/rooms', label: '멀티 플레이', activeColor: 'bg-teal-500' },
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
            
            {/* 로그인/로그아웃 버튼 */}
            {!isLoading && (
              user ? (
                <div className="flex items-center gap-3 ml-2">
                  <span className="text-sm text-slate-300 font-medium">
                    {userNickname || user.email?.split('@')[0] || '사용자'}님
                  </span>
                  <button
                    onClick={handleSignOut}
                    className="px-3 py-1.5 lg:px-4 lg:py-2 rounded-lg text-sm font-semibold transition-all bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30"
                  >
                    로그아웃
                  </button>
                </div>
              ) : (
                <Link href="/auth/login">
                  <button className="px-3 py-1.5 lg:px-4 lg:py-2 rounded-lg text-sm font-semibold transition-all bg-gradient-to-r from-teal-500 to-cyan-500 text-white hover:from-teal-600 hover:to-cyan-600 ml-2">
                    로그인
                  </button>
                </Link>
              )
            )}
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
              
              {/* 모바일 로그인/로그아웃 버튼 */}
              {!isLoading && (
                <div className="border-t border-slate-700 pt-2 mt-2">
                  {user ? (
                    <>
                      <div className="px-4 py-2 text-sm text-slate-300 font-medium">
                        {userNickname || user.email?.split('@')[0] || '사용자'}님
                      </div>
                      <button
                        onClick={() => {
                          handleSignOut();
                          setIsMobileMenuOpen(false);
                        }}
                        className="w-full px-4 py-3 rounded-lg text-sm font-semibold transition-all text-left bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30"
                      >
                        로그아웃
                      </button>
                    </>
                  ) : (
                    <Link
                      href="/auth/login"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <button className="w-full px-4 py-3 rounded-lg text-sm font-semibold transition-all text-left bg-gradient-to-r from-teal-500 to-cyan-500 text-white hover:from-teal-600 hover:to-cyan-600">
                        로그인
                      </button>
                    </Link>
                  )}
                </div>
              )}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}

