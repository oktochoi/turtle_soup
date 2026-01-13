'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    if (password.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }

    if (!nickname.trim()) {
      setError('닉네임을 입력해주세요.');
      return;
    }

    if (nickname.trim().length < 2) {
      setError('닉네임은 최소 2자 이상이어야 합니다.');
      return;
    }

    if (nickname.trim().length > 20) {
      setError('닉네임은 최대 20자까지 입력 가능합니다.');
      return;
    }

    // 닉네임 중복 체크
    setIsLoading(true);
    try {
      const { data: existingUser } = await supabase
        .from('game_users')
        .select('id')
        .eq('nickname', nickname.trim())
        .maybeSingle();

      if (existingUser) {
        setError('이미 사용 중인 닉네임입니다.');
        setIsLoading(false);
        return;
      }
    } catch (checkError) {
      console.error('닉네임 중복 체크 오류:', checkError);
      // 체크 실패해도 계속 진행
    }

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/login`,
          data: {
            nickname: nickname.trim(),
          },
        },
      });

      if (error) {
        // 이메일 중복 에러 처리
        if (error.message?.includes('already registered') || error.message?.includes('이미 등록')) {
          setError('이메일이 이미 등록된 메일입니다.');
          return;
        }
        // 이메일 회원가입 비활성화 에러 처리
        if (error.message?.includes('Email signups are disabled') || error.message?.includes('signups are disabled')) {
          setError('이메일 회원가입이 비활성화되어 있습니다.\nSupabase 대시보드에서 이메일 회원가입을 활성화해주세요.');
          return;
        }
        throw error;
      }

      if (data.user) {
        // game_users 테이블에 유저 생성
        const { error: gameUserError } = await supabase
          .from('game_users')
          .insert({
            auth_user_id: data.user.id,
            nickname: nickname.trim(),
          })
          .select()
          .single();

        if (gameUserError) {
          console.error('game_users 생성 오류:', gameUserError);
        } else {
          // 초기 progress 생성
          const { data: newGameUser } = await supabase
            .from('game_users')
            .select('id')
            .eq('auth_user_id', data.user.id)
            .single();

          if (newGameUser) {
            await supabase
              .from('user_progress')
              .insert({
                user_id: newGameUser.id,
                level: 1,
                xp: 0,
                points: 0,
              });
          }
        }

        // public.users 테이블에 직접 저장 (트리거가 작동하지 않을 경우를 대비)
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            id: data.user.id,
            email: data.user.email || email.trim(),
            nickname: nickname.trim(),
          })
          .select()
          .single();

        // 에러가 나도 무시 (트리거가 이미 생성했을 수 있음)
        if (profileError && !profileError.message?.includes('duplicate')) {
          console.warn('프로필 생성 경고:', profileError);
        }

        // 이메일 확인이 필요한 경우
        if (data.user.email_confirmed_at === null) {
          alert('회원가입이 완료되었습니다!\n이메일 확인 링크가 발송되었습니다. 이메일을 확인해주세요.');
        } else {
          alert('회원가입이 완료되었습니다! 로그인해주세요.');
        }
        router.push('/auth/login');
      }
    } catch (error: any) {
      console.error('회원가입 오류:', error);
      if (error.message?.includes('already registered') || error.message?.includes('이미 등록')) {
        setError('이메일이 이미 등록된 메일입니다.');
      } else {
        setError(error.message || '회원가입에 실패했습니다.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        console.error('Google 회원가입 오류:', error);
        setError('Google 회원가입에 실패했습니다.');
        setIsLoading(false);
      }
      // 성공 시 리디렉션되므로 여기서는 아무것도 하지 않음
    } catch (error: any) {
      console.error('Google 회원가입 오류:', error);
      setError(error.message || 'Google 회원가입에 실패했습니다.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
            회원가입
          </h1>
          <p className="text-slate-400 text-sm">새 계정을 만들어 시작하세요</p>
        </div>

        <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl p-6 sm:p-8 border border-slate-700 shadow-xl">
          <form onSubmit={handleSignup} className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-400 rounded-lg p-3 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2 text-slate-300">
                이메일
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="이메일을 입력하세요"
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-slate-300">
                닉네임
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="닉네임을 입력하세요 (최소 2자)"
                required
                minLength={2}
                maxLength={20}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-slate-300">
                비밀번호
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요 (최소 6자)"
                required
                minLength={6}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-slate-300">
                비밀번호 확인
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="비밀번호를 다시 입력하세요"
                required
                minLength={6}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold py-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-teal-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '회원가입 중...' : '회원가입'}
            </button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-600"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-slate-800 text-slate-400">또는</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignup}
              disabled={isLoading}
              className="mt-6 w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-900 font-semibold py-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-gray-500/50 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-300"
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
              <span>Google로 회원가입</span>
            </button>
          </div>

          <div className="mt-6 text-center">
            <p className="text-slate-400 text-sm">
              이미 계정이 있으신가요?{' '}
              <Link href="/auth/login" className="text-teal-400 hover:text-teal-300 font-semibold">
                로그인
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link href="/" className="text-slate-400 hover:text-white text-sm transition-colors">
            <i className="ri-arrow-left-line mr-2"></i>
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}

