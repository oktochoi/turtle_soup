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

    setIsLoading(true);

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

