'use client';

import { use } from 'react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import { useTranslations } from '@/hooks/useTranslations';

export default function CreateRoom({ params }: { params: Promise<{ lang: string }> }) {
  const resolvedParams = use(params);
  const lang = resolvedParams.lang || 'ko';
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const t = useTranslations();

  const [story, setStory] = useState('');
  const [truth, setTruth] = useState('');
  const [maxQuestions, setMaxQuestions] = useState(30);
  const [password, setPassword] = useState('');
  const [usePassword, setUsePassword] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!authLoading && !user) {
      alert('로그인이 필요합니다.');
      router.push(`/${lang}/auth/login`);
    }
  }, [user, authLoading, router, lang]);

  const generateRoomCode = (): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!story.trim()) {
      newErrors.story = '이야기를 입력해주세요';
    }
    if (!truth.trim()) {
      newErrors.truth = '진실을 입력해주세요';
    }
    if (usePassword && password.trim().length < 4) {
      newErrors.password = '비밀번호는 4자 이상이어야 합니다';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreate = async () => {
    if (!user || !validateForm()) return;
    setIsCreating(true);

    try {
      const supabaseClient = createClient();
      const { data: userData } = await supabaseClient
        .from('users')
        .select('nickname')
        .eq('id', user.id)
        .maybeSingle();
      const finalHostNickname =
        userData?.nickname || user.id.substring(0, 8) || ('사용자');

      let roomCode = generateRoomCode();
      let codeExists = true;
      let attempts = 0;

      while (codeExists && attempts < 10) {
        const { data: existingRoom } = await supabase
          .from('rooms')
          .select('code')
          .eq('code', roomCode)
          .single();

        if (!existingRoom) {
          codeExists = false;
        } else {
          roomCode = generateRoomCode();
          attempts++;
        }
      }

      if (codeExists) {
        throw new Error('방 코드 생성에 실패했습니다');
      }

      const currentLang = 'ko';
      const insertData: Record<string, unknown> = {
        code: roomCode,
        host_nickname: finalHostNickname,
        story: story.trim(),
        truth: truth.trim(),
        max_questions: maxQuestions,
        password: usePassword ? password.trim() : null,
        game_ended: false,
        status: 'active',
        quiz_type: 'soup',
        lang: currentLang,
      };

      const { error: roomError } = await supabase.from('rooms').insert(insertData).select('*').single();

      if (roomError) {
        if (roomError.code === '42703' || roomError.message?.includes('column')) {
          const { error: retryError } = await supabase
            .from('rooms')
            .insert({
              code: roomCode,
              host_nickname: finalHostNickname,
              story: story.trim(),
              truth: truth.trim(),
              max_questions: maxQuestions,
              game_ended: false,
              status: 'active',
              quiz_type: 'soup',
            })
            .select('*')
            .single();
          if (retryError) throw retryError;
        } else {
          throw roomError;
        }
      }

      const { error: playerError } = await supabase.from('players').insert({
        room_code: roomCode,
        nickname: finalHostNickname,
        is_host: true,
      });
      if (playerError) throw playerError;

      router.push(`/${lang}/turtle_room/${roomCode}?host=true`);
    } catch (error) {
      console.error('방 생성 오류:', error);
      alert('방 생성에 실패했습니다.');
      setIsCreating(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-ink-800 text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F14] text-bone-muted">
      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 max-w-2xl">
        <div className="mb-4 sm:mb-6">
          <Link href={`/${lang}`}>
            <button className="text-fog hover:text-white transition-colors text-sm sm:text-base">
              <i className="ri-arrow-left-line mr-2"></i>
              {t.common.back}
            </button>
          </Link>
        </div>

        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2 text-sky-400">
            {'바다거북스프 방 만들기'}
          </h1>
          <p className="text-xs sm:text-sm text-fog">
            이야기와 진실을 설정하고 게임을 시작하세요.
          </p>
        </div>

        <div className="space-y-5 bg-ink-700/60 border border-brass/20 rounded-xl p-5 sm:p-6">
          <div>
            <label className="block text-sm font-medium mb-2">
              {'이야기'} <span className="text-red-400">*</span>
            </label>
            <textarea
              value={story}
              onChange={(e) => setStory(e.target.value)}
              rows={5}
              className="w-full bg-ink-800 border border-brass/20 rounded-lg px-4 py-3 text-sm"
              placeholder={'상황 이야기를 입력하세요'}
              disabled={isCreating}
            />
            {errors.story && <p className="text-xs mt-1 text-red-400">{errors.story}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              {'진실'} <span className="text-red-400">*</span>
            </label>
            <textarea
              value={truth}
              onChange={(e) => setTruth(e.target.value)}
              rows={4}
              className="w-full bg-ink-800 border border-brass/20 rounded-lg px-4 py-3 text-sm"
              placeholder={'정답(진실)을 입력하세요'}
              disabled={isCreating}
            />
            {errors.truth && <p className="text-xs mt-1 text-red-400">{errors.truth}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              {'최대 질문 수'}
            </label>
            <input
              type="number"
              min={5}
              max={100}
              value={maxQuestions}
              onChange={(e) => setMaxQuestions(Number(e.target.value) || 30)}
              className="w-full bg-ink-800 border border-brass/20 rounded-lg px-4 py-2 text-sm"
              disabled={isCreating}
            />
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={usePassword}
                onChange={(e) => setUsePassword(e.target.checked)}
                className="w-4 h-4"
                disabled={isCreating}
              />
              <span className="text-sm">{'비밀번호 설정'}</span>
            </label>
          </div>

          {usePassword && (
            <div>
              <label className="block text-sm font-medium mb-2">
                {'비밀번호'}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-ink-800 border border-brass/20 rounded-lg px-4 py-2 text-sm"
                disabled={isCreating}
              />
              {errors.password && <p className="text-xs mt-1 text-red-400">{errors.password}</p>}
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={isCreating}
            className="w-full bg-gradient-to-r from-brass to-brass-600 hover:from-brass-600 hover:to-brass-700 disabled:opacity-50 text-white font-semibold px-4 py-3 rounded-xl transition-all"
          >
            {isCreating ? '생성 중...' : '방 만들기'}
          </button>
        </div>
      </div>
    </div>
  );
}
