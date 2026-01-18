'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { use } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function AuthCallbackPage({ params }: { params: Promise<{ lang: string }> }) {
  const resolvedParams = use(params);
  const lang = resolvedParams.lang || 'ko';
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<string>('처리 중...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // URL에서 OAuth 코드 추출
        const code = searchParams.get('code');
        const error = searchParams.get('error');

        if (error) {
          console.error('OAuth 에러:', error);
          setStatus('로그인에 실패했습니다.');
          setTimeout(() => {
            router.push(`/${lang}/auth/login?error=${encodeURIComponent(error)}`);
          }, 2000);
          return;
        }

        if (code) {
          setStatus('세션을 교환하는 중...');
          const supabase = createClient();
          
          // Supabase 세션 교환
          const { data, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);

          if (sessionError) {
            console.error('세션 교환 실패:', sessionError);
            setStatus('세션 교환에 실패했습니다.');
            setTimeout(() => {
              router.push(`/${lang}/auth/login?error=${encodeURIComponent(sessionError.message)}`);
            }, 2000);
            return;
          }

          if (data?.session) {
            setStatus('로그인 성공!');
            
            // OAuth 로그인 후 users 테이블 동기화 확인
            try {
              const { data: { user }, error: userError } = await supabase.auth.getUser();

              if (user && !userError) {
                // users 테이블에 같은 이메일로 기존 사용자가 있는지 확인
                const { data: existingUser } = await supabase
                  .from('users')
                  .select('*')
                  .eq('email', user.email)
                  .maybeSingle();

                if (existingUser && existingUser.id !== user.id) {
                  // 같은 이메일이지만 다른 ID인 경우, 기존 사용자로 연결
                  // handle_new_user 트리거가 처리하지만, 명시적으로 확인
                  console.log('Same email found, user should be linked automatically by trigger');
                }

                // users 테이블에 현재 사용자가 있는지 확인 (트리거로 자동 생성되어야 함)
                const { data: currentUser } = await supabase
                  .from('users')
                  .select('*')
                  .eq('id', user.id)
                  .maybeSingle();

                // game_users 테이블에 유저가 있는지 확인 (있는 경우)
                const { data: existingGameUser } = await supabase
                  .from('game_users')
                  .select('*')
                  .eq('auth_user_id', user.id)
                  .maybeSingle();

                if (!existingGameUser || !existingGameUser.nickname || existingGameUser.nickname.trim() === '') {
                  // nickname이 없으면 설정 페이지로 리디렉션
                  setTimeout(() => {
                    router.push(`/${lang}/auth/setup-nickname`);
                  }, 1000);
                  return;
                }
              }
            } catch (error) {
              console.error('유저 동기화 오류:', error);
            }

            // 로그인 성공 시 홈으로 리디렉션
            setTimeout(() => {
              router.push(`/${lang}`);
            }, 1000);
          }
        } else {
          // 코드가 없으면 메인으로
          setStatus('인증 코드를 찾을 수 없습니다.');
          setTimeout(() => {
            router.push(`/${lang}`);
          }, 2000);
        }
      } catch (err: any) {
        console.error('콜백 처리 실패:', err);
        setStatus('처리 중 오류가 발생했습니다.');
        setTimeout(() => {
          router.push(`/${lang}`);
        }, 2000);
      }
    };

    handleCallback();
  }, [searchParams, router, lang]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
      <div className="text-center px-4">
        <div className="mb-4">
          <i className="ri-loader-4-line animate-spin text-4xl text-teal-400"></i>
        </div>
        <h2 className="text-2xl font-bold mb-2 bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
          로그인 처리 중...
        </h2>
        <p className="text-slate-400">{status}</p>
        <p className="text-slate-500 text-sm mt-4">잠시만 기다려주세요.</p>
      </div>
    </div>
  );
}

