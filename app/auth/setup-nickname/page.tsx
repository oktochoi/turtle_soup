'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';

export default function SetupNicknamePage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [nickname, setNickname] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    } else if (user) {
      // 이미 nickname이 설정되어 있는지 확인
      checkExistingNickname();
    }
  }, [user, authLoading]);

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
        router.push('/');
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
        setError('이미 사용 중인 닉네임입니다.');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

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

    // 최종 중복 체크
    const isAvailable = await checkNicknameAvailability(nickname.trim());
    if (!isAvailable) {
      setError('이미 사용 중인 닉네임입니다.');
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

      router.push('/');
      router.refresh();
    } catch (error: any) {
      console.error('닉네임 설정 오류:', error);
      setError(error.message || '닉네임 설정에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400 mx-auto mb-4"></div>
          <p className="text-slate-400">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
            닉네임 설정
          </h1>
          <p className="text-slate-400 text-sm">사용할 닉네임을 입력해주세요</p>
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
                닉네임
              </label>
              <input
                type="text"
                value={nickname}
                onChange={handleNicknameChange}
                placeholder="닉네임을 입력하세요 (최소 2자, 최대 20자)"
                required
                minLength={2}
                maxLength={20}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
              {isChecking && (
                <p className="text-xs text-slate-400 mt-1">중복 확인 중...</p>
              )}
              {nickname.trim().length >= 2 && !isChecking && !error && (
                <p className="text-xs text-green-400 mt-1">✓ 사용 가능한 닉네임입니다</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || isChecking || !!error || nickname.trim().length < 2}
              className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold py-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-teal-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '설정 중...' : '닉네임 설정하기'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

