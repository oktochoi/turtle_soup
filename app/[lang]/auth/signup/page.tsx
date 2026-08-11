'use client';

import { use } from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useTranslations } from '@/hooks/useTranslations';

export default function SignupPage({ params }: { params: Promise<{ lang: string }> }) {
  const resolvedParams = use(params);
  const lang = resolvedParams.lang || 'ko';
  const router = useRouter();
  const t = useTranslations();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [showResendEmail, setShowResendEmail] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!email.trim() || !password.trim() || !confirmPassword.trim() || !nickname.trim()) {
      setError(lang === 'ko' ? '모든 필드를 입력해주세요.' : 'Please fill in all fields.');
      return;
    }

    if (nickname.trim().length < 2 || nickname.trim().length > 20) {
      setError(lang === 'ko' ? '닉네임은 2자 이상 20자 이하여야 합니다.' : 'Nickname must be between 2 and 20 characters.');
      return;
    }

    if (password.length < 6) {
      setError(lang === 'ko' ? '비밀번호는 최소 6자 이상이어야 합니다.' : 'Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError(lang === 'ko' ? '비밀번호가 일치하지 않습니다.' : 'Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();
      const { data, error: signupError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            nickname: nickname.trim(),
          },
        },
      });

      if (signupError) {
        console.error('회원가입 오류:', signupError);
        if (signupError.message.includes('User already registered')) {
          setError(lang === 'ko' ? '이미 등록된 이메일입니다.' : 'This email is already registered.');
        } else if (signupError.message.includes('Invalid email')) {
          setError(lang === 'ko' ? '유효하지 않은 이메일입니다.' : 'Invalid email address.');
        } else {
          setError(signupError.message || (lang === 'ko' ? '회원가입에 실패했습니다.' : 'Signup failed.'));
        }
        setIsLoading(false);
        return;
      }

      if (data.user) {
        // 추천인 코드 처리 (있을 경우)
        if (referralCode.trim()) {
          try {
            // 추천인 코드로 유저 찾기
            const { data: referrerData, error: referrerError } = await supabase
              .from('game_users')
              .select('id')
              .eq('referral_code', referralCode.trim().toUpperCase())
              .single();

            if (!referrerError && referrerData) {
              // game_users 레코드가 생성된 후 코인 지급
              // game_users는 auth callback이나 다른 곳에서 생성될 수 있으므로,
              // 여기서는 추천인 코드를 저장만 하고 나중에 처리하거나
              // 직접 game_users를 확인하고 처리
              
              // 사용자 인증 후 game_users 레코드 생성 대기 (최대 3초)
              let gameUser = null;
              for (let i = 0; i < 30; i++) {
                const { data: gameUserData } = await supabase
                  .from('game_users')
                  .select('id')
                  .eq('auth_user_id', data.user.id)
                  .single();
                
                if (gameUserData) {
                  gameUser = gameUserData;
                  break;
                }
                await new Promise(resolve => setTimeout(resolve, 100));
              }

              if (gameUser) {
                // 코인 지급 (user_progress에 coins 추가)
                try {
                  const { error: coinError } = await supabase.rpc('increment_coins', {
                    user_id: gameUser.id,
                    amount: 20
                  });

                  // RPC 함수가 실패하면 직접 업데이트
                  if (coinError) {
                    throw coinError;
                  }
                } catch (rpcError) {
                  // RPC 함수가 없으면 직접 업데이트
                  try {
                    const { data: progress } = await supabase
                      .from('user_progress')
                      .select('coins')
                      .eq('user_id', gameUser.id)
                      .single();
                    
                    if (progress) {
                      await supabase
                        .from('user_progress')
                        .update({ coins: (progress.coins || 0) + 20 })
                        .eq('user_id', gameUser.id);
                    } else {
                      // user_progress가 없으면 생성
                      await supabase
                        .from('user_progress')
                        .insert({ user_id: gameUser.id, coins: 20 });
                    }
                  } catch (updateError) {
                    // 코인 지급 실패는 무시 (회원가입은 성공)
                    console.warn('코인 지급 오류:', updateError);
                  }
                }

              }
            }
          } catch (refError) {
            // 추천인 코드 오류는 무시 (회원가입은 성공)
            console.warn('추천인 코드 처리 오류:', refError);
          }
        }

        // 회원가입 성공 시 이메일 인증 없이 바로 홈으로 이동
        router.push(`/${lang}?signedup=1`);
        router.refresh();
      }
    } catch (error: any) {
      console.error('회원가입 오류:', error);
      setError(error.message || (lang === 'ko' ? '회원가입에 실패했습니다.' : 'Signup failed.'));
      setIsLoading(false);
    }
  };

  const handleResendEmail = async () => {
    if (!email.trim()) {
      setError(lang === 'ko' ? '이메일을 입력해주세요.' : 'Please enter your email.');
      return;
    }

    setIsResending(true);
    setError(null);
    setResendSuccess(false);

    try {
      const supabase = createClient();
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/${lang}/auth/callback`,
        },
      });

      if (resendError) {
        console.error('이메일 재전송 오류:', resendError);
        setError(resendError.message || (lang === 'ko' ? '이메일 재전송에 실패했습니다.' : 'Failed to resend email.'));
        setIsResending(false);
        return;
      }

      setResendSuccess(true);
      setIsResending(false);
      
      // 3초 후 성공 메시지 숨김
      setTimeout(() => {
        setResendSuccess(false);
      }, 3000);
    } catch (error: any) {
      console.error('이메일 재전송 오류:', error);
      setError(error.message || (lang === 'ko' ? '이메일 재전송에 실패했습니다.' : 'Failed to resend email.'));
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
            {t.auth.signup}
          </h1>
          <p className="text-slate-400 text-sm">{lang === 'ko' ? '새 계정을 만들어 시작하세요' : 'Create a new account to get started'}</p>
        </div>

        <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl p-6 sm:p-8 border border-slate-700 shadow-xl">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 rounded-lg p-3 text-sm mb-6">
              {error}
            </div>
          )}

          {resendSuccess && (
            <div className="bg-green-500/10 border border-green-500/50 text-green-400 rounded-lg p-3 text-sm mb-6">
              {lang === 'ko' ? '인증 이메일이 재전송되었습니다. 이메일을 확인해주세요.' : 'Verification email has been resent. Please check your email.'}
            </div>
          )}

          {showResendEmail && (
            <div className="bg-blue-500/10 border border-blue-500/50 text-blue-400 rounded-lg p-4 text-sm mb-6">
              <p className="mb-3">
                {lang === 'ko' 
                  ? '회원가입이 완료되었습니다. 이메일을 확인하여 인증을 완료해주세요.' 
                  : 'Signup successful. Please check your email to verify your account.'}
              </p>
              <p className="text-xs text-blue-300 mb-2">
                {lang === 'ko' 
                  ? '※ 인증 메일이 조금 늦게 도착할 수도 있습니다. 스팸 폴더도 확인해주세요.' 
                  : '※ Verification email may arrive with a slight delay. Please also check your spam folder.'}
              </p>
              <p className="text-xs text-blue-300 mb-3">
                {lang === 'ko' 
                  ? '인증 이메일을 받지 못하셨나요? 아래 버튼을 클릭하여 다시 전송받을 수 있습니다.' 
                  : "Didn't receive the verification email? Click the button below to resend it."}
              </p>
              <button
                type="button"
                onClick={handleResendEmail}
                disabled={isResending}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {isResending ? (
                  <span className="flex items-center justify-center">
                    <i className="ri-loader-4-line animate-spin mr-2"></i>
                    {lang === 'ko' ? '재전송 중...' : 'Resending...'}
                  </span>
                ) : (
                  <span className="flex items-center justify-center">
                    <i className="ri-mail-send-line mr-2"></i>
                    {lang === 'ko' ? '인증 이메일 다시 보내기' : 'Resend Verification Email'}
                  </span>
                )}
              </button>
            </div>
          )}

          {/* 이메일/비밀번호 회원가입 폼 */}
          <form onSubmit={handleEmailSignup} className="mb-6 space-y-4">
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
                placeholder={lang === 'ko' ? '비밀번호를 입력하세요 (최소 6자)' : 'Enter your password (min 6 characters)'}
                required
                minLength={6}
                disabled={isLoading}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300 mb-2">
                {lang === 'ko' ? '비밀번호 확인' : 'Confirm Password'}
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={lang === 'ko' ? '비밀번호를 다시 입력하세요' : 'Confirm your password'}
                required
                minLength={6}
                disabled={isLoading}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label htmlFor="nickname" className="block text-sm font-medium text-slate-300 mb-2">
                {lang === 'ko' ? '닉네임' : 'Nickname'}
              </label>
              <input
                id="nickname"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder={lang === 'ko' ? '닉네임을 입력하세요 (2-20자)' : 'Enter your nickname (2-20 characters)'}
                required
                minLength={2}
                maxLength={20}
                disabled={isLoading}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label htmlFor="referralCode" className="block text-sm font-medium text-slate-300 mb-2">
                {lang === 'ko' ? '추천인 코드 (선택사항)' : 'Referral Code (Optional)'}
              </label>
              <input
                id="referralCode"
                type="text"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                placeholder={lang === 'ko' ? '7자리 추천인 코드를 입력하세요' : 'Enter 7-character referral code'}
                maxLength={7}
                disabled={isLoading}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {referralCode.trim() && (
                <p className="mt-1 text-xs text-slate-400">
                  {lang === 'ko' ? '💰 추천인 코드를 입력하면 20코인을 지급받습니다!' : '💰 Enter a referral code to receive 20 coins!'}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold py-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-teal-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <i className="ri-loader-4-line animate-spin mr-2"></i>
                  {lang === 'ko' ? '회원가입 중...' : 'Signing up...'}
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  <i className="ri-user-add-line mr-2"></i>
                  {lang === 'ko' ? '회원가입' : 'Sign Up'}
                </span>
              )}
            </button>
          </form>
        </div>

        <div className="mt-6 text-center space-y-2">
          <p className="text-slate-400 text-sm">
            {lang === 'ko' ? '이미 계정이 있으신가요?' : 'Already have an account?'}{' '}
            <Link href={`/${lang}/auth/login`} className="text-teal-400 hover:text-teal-300 font-semibold transition-colors">
              {lang === 'ko' ? '로그인' : 'Login'}
            </Link>
          </p>
          <Link href={`/${lang}`} className="text-slate-400 hover:text-white text-sm transition-colors block">
            <i className="ri-arrow-left-line mr-2"></i>
            {t.common.home}
          </Link>
        </div>
      </div>
    </div>
  );
}

