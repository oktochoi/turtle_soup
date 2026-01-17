'use client';

import { use } from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useTranslations } from '@/hooks/useTranslations';

export default function LoginPage({ params }: { params: Promise<{ lang: string }> }) {
  const resolvedParams = use(params);
  const lang = resolvedParams.lang || 'ko';
  const router = useRouter();
  const t = useTranslations();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!email.trim() || !password.trim()) {
      setError(lang === 'ko' ? '이메일과 비밀번호를 입력해주세요.' : 'Please enter your email and password.');
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (loginError) {
        console.error('이메일 로그인 오류:', loginError);
        if (loginError.message.includes('Invalid login credentials')) {
          setError(lang === 'ko' ? '이메일 또는 비밀번호가 올바르지 않습니다.' : 'Invalid email or password.');
        } else if (loginError.message.includes('Email not confirmed')) {
          setError(lang === 'ko' ? '이메일 인증이 완료되지 않았습니다. 이메일을 확인해주세요.' : 'Please verify your email address.');
        } else {
          setError(loginError.message || (lang === 'ko' ? '로그인에 실패했습니다.' : 'Login failed.'));
        }
        setIsLoading(false);
        return;
      }

      if (data.user) {
        // 로그인 성공 시 홈으로 리디렉션
        router.push(`/${lang}`);
        router.refresh();
      }
    } catch (error: any) {
      console.error('이메일 로그인 오류:', error);
      setError(error.message || (lang === 'ko' ? '로그인에 실패했습니다.' : 'Login failed.'));
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const supabase = createClient();
      
      // 앱 환경 감지 (User Agent 확인)
      const isAppEnvironment = typeof window !== 'undefined' && 
                               navigator.userAgent.includes('TurtleSoupApp');
      
      let redirectUrl: string;
      
      if (isAppEnvironment) {
        // 앱 환경: 딥링크 사용
        redirectUrl = 'turtlesoup://login-callback';
      } else {
        // 웹 환경: 웹 콜백 URL 사용
        const isProduction = window.location.hostname.includes('turtle-soup-rust.vercel.app') || 
                            window.location.hostname.includes('vercel.app');
        const baseUrl = isProduction 
          ? 'https://turtle-soup-rust.vercel.app'
          : window.location.origin;
        redirectUrl = `${baseUrl}/${lang}/auth/callback`;
      }
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) {
        console.error('Google 로그인 오류:', error);
        setError(t.auth.googleLoginFail);
        setIsLoading(false);
      }
      // 성공 시 리디렉션되므로 여기서는 아무것도 하지 않음
    } catch (error: any) {
      console.error('Google 로그인 오류:', error);
      setError(error.message || t.auth.googleLoginFail);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
            {t.auth.login}
          </h1>
          <p className="text-slate-400 text-sm">{t.auth.welcomeMessage}</p>
        </div>

        <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl p-6 sm:p-8 border border-slate-700 shadow-xl">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 rounded-lg p-3 text-sm mb-6">
              {error}
            </div>
          )}

          {/* 이메일/비밀번호 로그인 폼 */}
          <form onSubmit={handleEmailLogin} className="mb-6 space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                {lang === 'ko' ? '이메일' : 'Email'}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={lang === 'ko' ? '이메일을 입력하세요' : 'Enter your email'}
                required
                disabled={isLoading}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                {lang === 'ko' ? '비밀번호' : 'Password'}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={lang === 'ko' ? '비밀번호를 입력하세요' : 'Enter your password'}
                required
                disabled={isLoading}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold py-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-teal-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <i className="ri-loader-4-line animate-spin mr-2"></i>
                  {lang === 'ko' ? '로그인 중...' : 'Logging in...'}
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  <i className="ri-login-box-line mr-2"></i>
                  {lang === 'ko' ? '로그인' : 'Login'}
                </span>
              )}
            </button>
          </form>

          {/* 구분선 */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-slate-800 text-slate-400">
                {lang === 'ko' ? '또는' : 'OR'}
              </span>
            </div>
          </div>

          {/* Google 로그인 버튼 */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-900 font-semibold py-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-gray-500/50 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-300"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span>{t.auth.loginWithGoogle}</span>
          </button>
        </div>

        <div className="mt-6 text-center">
          <Link href={`/${lang}`} className="text-slate-400 hover:text-white text-sm transition-colors">
            <i className="ri-arrow-left-line mr-2"></i>
            {t.common.home}
          </Link>
        </div>
      </div>
    </div>
  );
}

