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
      alert(lang === 'ko' ? '로그인이 필요합니다.' : 'Login required.');
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
      newErrors.story = lang === 'ko' ? '이야기를 입력해주세요' : 'Please enter a story';
    }
    if (!truth.trim()) {
      newErrors.truth = lang === 'ko' ? '진실을 입력해주세요' : 'Please enter the truth';
    }
    if (usePassword && password.trim().length < 4) {
      newErrors.password = lang === 'ko' ? '비밀번호는 4자 이상이어야 합니다' : 'Password must be at least 4 characters';
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
        userData?.nickname || user.id.substring(0, 8) || (lang === 'ko' ? '사용자' : 'User');

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
        throw new Error(lang === 'ko' ? '방 코드 생성에 실패했습니다' : 'Failed to generate room code');
      }

      const currentLang = lang === 'en' ? 'en' : 'ko';
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
      alert(lang === 'ko' ? '방 생성에 실패했습니다.' : 'Failed to create room.');
      setIsCreating(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F14] text-slate-200">
      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 max-w-2xl">
        <div className="mb-4 sm:mb-6">
          <Link href={`/${lang}`}>
            <button className="text-slate-400 hover:text-white transition-colors text-sm sm:text-base">
              <i className="ri-arrow-left-line mr-2"></i>
              {t.common.back}
            </button>
          </Link>
        </div>

        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2 text-sky-400">
            {lang === 'ko' ? '바다거북스프 방 만들기' : 'Create Turtle Soup Room'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            {lang === 'ko'
              ? '이야기와 진실을 설정하고 게임을 시작하세요.'
              : 'Set the story and truth to start the game.'}
          </p>
        </div>

        <div className="space-y-5 bg-slate-800/60 border border-slate-700 rounded-xl p-5 sm:p-6">
          <div>
            <label className="block text-sm font-medium mb-2">
              {lang === 'ko' ? '이야기' : 'Story'} <span className="text-red-400">*</span>
            </label>
            <textarea
              value={story}
              onChange={(e) => setStory(e.target.value)}
              rows={5}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-sm"
              placeholder={lang === 'ko' ? '상황 이야기를 입력하세요' : 'Enter the story'}
              disabled={isCreating}
            />
            {errors.story && <p className="text-xs mt-1 text-red-400">{errors.story}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              {lang === 'ko' ? '진실' : 'Truth'} <span className="text-red-400">*</span>
            </label>
            <textarea
              value={truth}
              onChange={(e) => setTruth(e.target.value)}
              rows={4}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-sm"
              placeholder={lang === 'ko' ? '정답(진실)을 입력하세요' : 'Enter the truth'}
              disabled={isCreating}
            />
            {errors.truth && <p className="text-xs mt-1 text-red-400">{errors.truth}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              {lang === 'ko' ? '최대 질문 수' : 'Max Questions'}
            </label>
            <input
              type="number"
              min={5}
              max={100}
              value={maxQuestions}
              onChange={(e) => setMaxQuestions(Number(e.target.value) || 30)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm"
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
              <span className="text-sm">{lang === 'ko' ? '비밀번호 설정' : 'Set Password'}</span>
            </label>
          </div>

          {usePassword && (
            <div>
              <label className="block text-sm font-medium mb-2">
                {lang === 'ko' ? '비밀번호' : 'Password'}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm"
                disabled={isCreating}
              />
              {errors.password && <p className="text-xs mt-1 text-red-400">{errors.password}</p>}
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={isCreating}
            className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 disabled:opacity-50 text-white font-semibold px-4 py-3 rounded-xl transition-all"
          >
            {isCreating
              ? lang === 'ko'
                ? '생성 중...'
                : 'Creating...'
              : lang === 'ko'
                ? '방 만들기'
                : 'Create Room'}
          </button>
        </div>
      </div>
    </div>
  );
}
