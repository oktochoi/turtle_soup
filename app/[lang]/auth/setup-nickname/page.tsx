'use client';

import { use } from 'react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import { useTranslations } from '@/hooks/useTranslations';

export default function SetupNicknamePage({ params }: { params: Promise<{ lang: string }> }) {
  const resolvedParams = use(params);
  const lang = resolvedParams.lang || 'ko';
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const t = useTranslations();
  const [nickname, setNickname] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/${lang}/auth/login`);
    } else if (user) {
      // 이미 nickname이 설정되어 있는지 확인
      checkExistingNickname();
    }
  }, [user, authLoading, lang, router]);

  const checkExistingNickname = async () => {
    if (!user) return;

    try {
      const supabase = createClient();
      const { data: gameUser } = await supabase
        .from('game_users')
        .select('id, nickname')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (gameUser && gameUser.nickname) {
        // 이미 nickname이 있으면 홈으로 리디렉션
        router.push(`/${lang}`);
      }
    } catch (error) {
      console.error('닉네임 확인 오류:', error);
    }
  };

  const checkNicknameAvailability = async (nick: string): Promise<boolean> => {
    if (!nick.trim() || nick.trim().length < 2) {
      return false;
    }

    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('game_users')
        .select('id')
        .eq('nickname', nick.trim())
        .maybeSingle();

      return !data; // data가 없으면 사용 가능
    } catch (error) {
      console.error('닉네임 중복 체크 오류:', error);
      return false;
    }
  };

  const handleNicknameChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNickname(value);
    setError(null);

    if (value.trim().length >= 2) {
      setIsChecking(true);
      const isAvailable = await checkNicknameAvailability(value);
      setIsChecking(false);

      if (!isAvailable) {
        setError(t.auth.nicknameInUse);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!nickname.trim()) {
      setError(t.auth.nicknameRequired);
      return;
    }

    if (nickname.trim().length < 2) {
      setError(t.auth.nicknameMinLength);
      return;
    }

    if (nickname.trim().length > 20) {
      setError(t.auth.nicknameMaxLength);
      return;
    }

    // 최종 중복 체크
    const isAvailable = await checkNicknameAvailability(nickname.trim());
    if (!isAvailable) {
      setError(t.auth.nicknameInUse);
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();
      
      // game_users 테이블에 유저 생성 또는 업데이트
      const { data: existingGameUser } = await supabase
        .from('game_users')
        .select('id')
        .eq('auth_user_id', user!.id)
        .maybeSingle();

      if (existingGameUser) {
        // 업데이트
        const { error: updateError } = await supabase
          .from('game_users')
          .update({ nickname: nickname.trim() })
          .eq('id', existingGameUser.id);

        if (updateError) throw updateError;
      } else {
        // 생성
        const { data: newGameUser, error: insertError } = await supabase
          .from('game_users')
          .insert({
            auth_user_id: user!.id,
            nickname: nickname.trim(),
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // 초기 progress 생성
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

      // users 테이블에도 nickname 저장 (기존 시스템과 호환)
      const { error: userUpdateError } = await supabase
        .from('users')
        .upsert({
          id: user!.id,
          email: user!.email || '',
          nickname: nickname.trim(),
        }, {
          onConflict: 'id',
        });

      if (userUpdateError) {
        console.warn('users 테이블 업데이트 경고:', userUpdateError);
      }

      router.push(`/${lang}`);
      router.refresh();
    } catch (error: any) {
      console.error('닉네임 설정 오류:', error);
      setError(error.message || t.auth.nicknameSetupFail);
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400 mx-auto mb-4"></div>
          <p className="text-slate-400">{t.common.loading}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
            {t.auth.setupNickname}
          </h1>
          <p className="text-slate-400 text-sm">{t.auth.setupNicknameDesc}</p>
        </div>

        <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl p-6 sm:p-8 border border-slate-700 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-400 rounded-lg p-3 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2 text-slate-300">
                {t.auth.nickname}
              </label>
              <input
                type="text"
                value={nickname}
                onChange={handleNicknameChange}
                placeholder={t.auth.nicknamePlaceholder}
                required
                minLength={2}
                maxLength={20}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
              {isChecking && (
                <p className="text-xs text-slate-400 mt-1">{t.auth.checkingNickname}</p>
              )}
              {nickname.trim().length >= 2 && !isChecking && !error && (
                <p className="text-xs text-green-400 mt-1">{t.auth.nicknameAvailable}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || isChecking || !!error || nickname.trim().length < 2}
              className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold py-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-teal-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (lang === 'ko' ? '설정 중...' : 'Setting up...') : t.auth.setupNicknameButton}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

