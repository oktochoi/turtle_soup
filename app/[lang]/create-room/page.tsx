'use client';

import { use } from 'react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
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
  const [maxQuestions, setMaxQuestions] = useState<number | null>(30);
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [usePassword, setUsePassword] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [hints, setHints] = useState<string[]>(['', '', '']); // 최대 3개

  useEffect(() => {
    if (!authLoading && !user) {
      // 로그인 필수
      alert(lang === 'ko' ? '로그인이 필요합니다.' : 'Login required.');
      router.push(`/${lang}/auth/login`);
    }
  }, [user, authLoading, router, lang]);

  const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const handleCreate = async () => {
    if (!story.trim() || !truth.trim() || !nickname.trim()) {
      alert(t.room.fillAllFields);
      return;
    }

    // Supabase 환경 변수 확인
    if (!isSupabaseConfigured()) {
      alert(lang === 'ko' 
        ? 'Supabase가 설정되지 않았습니다.\n\n.env.local 파일을 확인하고:\n1. NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_ANON_KEY가 올바르게 설정되어 있는지 확인\n2. 개발 서버를 재시작하세요 (환경 변수 변경 후 필수)'
        : 'Supabase is not configured.\n\nPlease check your .env.local file:\n1. Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are correctly set\n2. Restart the development server (required after changing environment variables)');
      return;
    }

    setIsCreating(true);

    try {
      let roomCode = generateRoomCode();
      let codeExists = true;
      let attempts = 0;

      // 고유한 방 코드 생성
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
        throw new Error(t.room.roomCodeGenerationFail);
      }

      // 방 생성
      const currentLang = (lang === 'ko' || lang === 'en') ? lang : 'ko';
      
      // 힌트 필터링 (빈 문자열 제거, 최대 3개)
      const validHints = hints.filter(h => h && h.trim()).slice(0, 3);
      const hintsData = validHints.length > 0 ? validHints : null;
      
      const insertData: any = {
        code: roomCode,
        story: story.trim(),
        truth: truth.trim(),
        max_questions: maxQuestions || 999999, // null이면 매우 큰 값으로 설정 (무제한)
        host_nickname: nickname.trim(),
        password: usePassword && password.trim() ? password.trim() : null,
        game_ended: false,
        status: 'active',
        hints: hintsData, // JSON 배열로 저장
      };
      
      // lang 컬럼이 있으면 추가
      insertData.lang = currentLang;
      
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .insert(insertData)
        .select()
        .single();

      if (roomError) {
        // lang 컬럼이 없어서 에러가 발생한 경우
        if (roomError.code === '42703' || roomError.message?.includes('column') || roomError.message?.includes('lang')) {
          console.warn('lang 컬럼이 없습니다. lang 없이 방을 생성합니다. 마이그레이션을 실행해주세요.');
          delete insertData.lang;
          const retryResult = await supabase
            .from('rooms')
            .insert(insertData)
            .select()
            .single();
          
          if (retryResult.error) throw retryResult.error;
          
          // 호스트를 players 테이블에 추가
          const { error: playerError } = await supabase
            .from('players')
            .insert({
              room_code: roomCode,
              nickname: nickname.trim(),
              is_host: true,
            });

          if (playerError) throw playerError;

          router.push(`/${lang}/room/${roomCode}?host=true&nickname=${encodeURIComponent(nickname.trim())}`);
          return;
        }
        throw roomError;
      }

      // 호스트를 players 테이블에 추가
      const { error: playerError } = await supabase
        .from('players')
        .insert({
          room_code: roomCode,
          nickname: nickname.trim(),
          is_host: true,
        });

      if (playerError) throw playerError;

      router.push(`/${lang}/room/${roomCode}?host=true&nickname=${encodeURIComponent(nickname.trim())}`);
    } catch (error) {
      console.error('방 생성 오류:', error);
      alert(t.room.createRoomFail);
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 max-w-2xl">
        <div className="mb-4 sm:mb-6">
          <Link href={`/${lang}`}>
            <button className="text-slate-400 hover:text-white transition-colors whitespace-nowrap text-sm sm:text-base">
              <i className="ri-arrow-left-line mr-2"></i>
              {t.common.back}
            </button>
          </Link>
        </div>
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2 bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
            {t.room.createNewRoomTitle}
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm">{t.room.startGameAsHost}</p>
        </div>

        <div className="space-y-4 sm:space-y-5">
          <div>
            <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
              <i className="ri-user-line mr-1"></i>
              {t.room.host}
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={t.room.hostNickname}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
              maxLength={20}
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
              <i className="ri-file-text-line mr-1"></i>
              {t.room.surfaceStory}
            </label>
            <textarea
              value={story}
              onChange={(e) => setStory(e.target.value)}
              placeholder={t.room.surfaceStoryPlaceholder}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent h-32 resize-none text-sm"
              maxLength={500}
            />
            <div className="text-right text-xs text-slate-500 mt-1">
              {story.length} / 500
            </div>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
              <i className="ri-key-line mr-1"></i>
              {t.room.truth}
            </label>
            <textarea
              value={truth}
              onChange={(e) => setTruth(e.target.value)}
              placeholder={t.room.truthPlaceholder}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent h-40 resize-none text-sm"
              maxLength={500}
            />
            <div className="text-right text-xs text-slate-500 mt-1">
              {truth.length} / 500
            </div>
          </div>

          {/* 힌트 섹션 */}
          <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
            <label className="block text-xs sm:text-sm font-medium mb-3 text-slate-300">
              <i className="ri-lightbulb-line mr-1 text-yellow-400"></i>
              {lang === 'ko' ? '힌트 (선택사항, 최대 3개)' : 'Hints (Optional, max 3)'}
            </label>
            <div className="space-y-2">
              {hints.map((hint, index) => (
                <input
                  key={index}
                  type="text"
                  value={hint}
                  onChange={(e) => {
                    const newHints = [...hints];
                    newHints[index] = e.target.value;
                    setHints(newHints);
                  }}
                  placeholder={lang === 'ko' ? `힌트 ${index + 1} (선택사항)` : `Hint ${index + 1} (optional)`}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 text-sm"
                  maxLength={200}
                />
              ))}
            </div>
            <div className="text-xs text-slate-400 mt-2">
              {lang === 'ko' 
                ? '💡 힌트는 AI가 질문에 답변할 때 참고하는 추가 정보입니다. 비워두면 사용되지 않습니다.'
                : '💡 Hints are additional information that AI uses when answering questions. Leave blank if not needed.'}
            </div>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
              <i className="ri-lock-line mr-1"></i>
              {t.room.roomPasswordOptional}
            </label>
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={usePassword}
                  onChange={(e) => {
                    setUsePassword(e.target.checked);
                    if (!e.target.checked) {
                      setPassword('');
                    }
                  }}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-teal-500 focus:ring-teal-500"
                />
                <span className="text-xs sm:text-sm text-slate-400">{t.room.setPassword}</span>
              </label>
              {usePassword && (
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.room.enterRoomPasswordPlaceholder}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  maxLength={20}
                />
              )}
              {usePassword && (
                <p className="text-xs text-slate-500">
                  {t.room.passwordDescription}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
              <i className="ri-question-answer-line mr-1"></i>
              {t.room.maxQuestions}
            </label>
            <div className="space-y-3">
              <div className="flex items-center gap-3 sm:gap-4">
                <input
                  type="range"
                  min="10"
                  max="50"
                  step="5"
                  value={maxQuestions || 50}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setMaxQuestions(value === 50 ? null : value);
                  }}
                  className="flex-1 accent-teal-500"
                />
                <span className="text-xl sm:text-2xl font-bold text-teal-400 w-16 sm:w-20 text-center">
                  {maxQuestions === null ? t.room.unlimited : maxQuestions}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMaxQuestions(null)}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                    maxQuestions === null
                      ? 'bg-teal-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {t.room.unlimited}
                </button>
                <button
                  type="button"
                  onClick={() => setMaxQuestions(30)}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                    maxQuestions === 30
                      ? 'bg-teal-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  30{lang === 'ko' ? t.room.questionsCount : ''}
                </button>
                <button
                  type="button"
                  onClick={() => setMaxQuestions(50)}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                    maxQuestions === 50
                      ? 'bg-teal-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  50{lang === 'ko' ? t.room.questionsCount : ''}
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={isCreating || !user}
            className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold py-3 sm:py-4 rounded-xl transition-all duration-200 shadow-lg hover:shadow-teal-500/50 mt-6 sm:mt-8 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
          >
            <i className="ri-door-open-line mr-2"></i>
            {isCreating 
              ? t.room.creatingRoom
              : t.room.createRoom
            }
          </button>
        </div>
      </div>
    </div>
  );
}

