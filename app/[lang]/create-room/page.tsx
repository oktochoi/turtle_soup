'use client';

import { use } from 'react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/lib/hooks/useAuth';
import { useTranslations } from '@/hooks/useTranslations';
import { QuizType, MULTIPLAYER_QUIZ_TYPES } from '@/lib/types/quiz';
import QuizTypeSelectorMultiplayer from '@/components/quiz/QuizTypeSelectorMultiplayer';

export default function CreateRoom({ params }: { params: Promise<{ lang: string }> }) {
  const resolvedParams = use(params);
  const lang = resolvedParams.lang || 'ko';
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const t = useTranslations();
  const [quizType, setQuizType] = useState<QuizType | null>('liar'); // 기본값: liar
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
    if (!quizType) {
      alert(lang === 'ko' ? '게임 유형을 선택해주세요.' : 'Please select a game type.');
      return;
    }

    // 멀티플레이는 soup, 라이어, 마피아 지원
    if (!MULTIPLAYER_QUIZ_TYPES.includes(quizType)) {
      alert(lang === 'ko' ? '멀티플레이 방은 바다거북스프, 라이어 게임 또는 마피아만 지원합니다.' : 'Multiplayer rooms only support Turtle Soup, Liar Game or Mafia.');
      return;
    }

    // 라이어/마피아는 story/truth 구조 다름 - 일단 soup 형식으로 통일
    if (!story.trim() || !truth.trim() || !nickname.trim()) {
      alert(t.room.fillAllFields);
      return;
    }

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
        quiz_type: quizType, // 퀴즈 유형 추가 (rooms 테이블에 컬럼이 있어야 함)
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

  // 게임 타입에 따른 배경색 결정
  // 1. 바다거북스프: Charcoal Mono (어두운 회색 기반)
  // 2. 마피아: Navy Ink + Purple (차분한 남색 + 보라 포인트)
  // 3. 라이어게임: Warm Gray + Olive (따뜻한 회색 계열)
  const getBackgroundClass = () => {
    if (quizType === 'mafia') {
      // Navy Ink + Purple
      return 'min-h-screen text-white';
    } else if (quizType === 'liar') {
      // Warm Gray + Olive
      return 'min-h-screen text-[#F1F0ED]';
    } else {
      // Charcoal Mono (바다거북스프)
      return 'min-h-screen text-[#E5E7EB]';
    }
  };

  // 게임 타입에 따른 배경 스타일
  const getBackgroundStyle = () => {
    if (quizType === 'mafia') {
      return { backgroundColor: '#070A12' }; // Navy Ink
    } else if (quizType === 'liar') {
      return { backgroundColor: '#0E0D0B' }; // Warm Gray
    } else {
      return { backgroundColor: '#0B0F14' }; // Charcoal Mono
    }
  };

  // 게임 타입에 따른 입력 필드 색상 결정
  const getInputClass = () => {
    if (quizType === 'mafia') {
      // Navy Ink + Purple
      return 'w-full rounded-xl px-4 py-3 text-[#E6EAF2] placeholder-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-[#A78BFA] focus:border-transparent text-sm';
    } else if (quizType === 'liar') {
      // Warm Gray + Olive
      return 'w-full rounded-xl px-4 py-3 text-[#F1F0ED] placeholder-[#A8A29E] focus:outline-none focus:ring-2 focus:ring-[#A3B18A] focus:border-transparent text-sm';
    } else {
      // Charcoal Mono
      return 'w-full rounded-xl px-4 py-3 text-[#E5E7EB] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#38BDF8] focus:border-transparent text-sm';
    }
  };

  // 게임 타입에 따른 입력 필드 배경/테두리 스타일
  const getInputStyle = () => {
    if (quizType === 'mafia') {
      return { backgroundColor: '#0D1220', borderColor: '#1C2541' }; // Surface, Border
    } else if (quizType === 'liar') {
      return { backgroundColor: '#171614', borderColor: '#2A2824' }; // Surface, Border
    } else {
      return { backgroundColor: '#0F172A', borderColor: '#243041' }; // Surface2, Border
    }
  };

  // 게임 타입에 따른 라벨 색상 결정
  const getLabelClass = () => {
    if (quizType === 'mafia') {
      return 'block text-xs sm:text-sm font-medium mb-2 text-[#98A2B3]';
    } else if (quizType === 'liar') {
      return 'block text-xs sm:text-sm font-medium mb-2 text-[#A8A29E]';
    } else {
      return 'block text-xs sm:text-sm font-medium mb-2 text-[#94A3B8]';
    }
  };

  // 게임 타입에 따른 카드 배경색
  const getCardClass = () => {
    if (quizType === 'mafia') {
      return 'bg-[#0D1220] border-[#1C2541]';
    } else if (quizType === 'liar') {
      return 'bg-[#171614] border-[#2A2824]';
    } else {
      return 'bg-[#111827] border-[#243041]';
    }
  };

  return (
    <div className={getBackgroundClass()} style={getBackgroundStyle()}>
      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 max-w-2xl">
        <div className="mb-4 sm:mb-6">
          <Link href={`/${lang}`}>
            <button className={`${
              quizType === 'mafia' 
                ? 'text-[#98A2B3] hover:text-[#E6EAF2]'
                : quizType === 'liar'
                ? 'text-[#A8A29E] hover:text-[#F1F0ED]'
                : 'text-[#94A3B8] hover:text-[#E5E7EB]'
            } transition-colors whitespace-nowrap text-sm sm:text-base`}>
              <i className="ri-arrow-left-line mr-2"></i>
              {t.common.back}
            </button>
          </Link>
        </div>
        <div className="text-center mb-6 sm:mb-8">
          <h1 className={`text-2xl sm:text-3xl font-bold mb-2 ${
            quizType === 'mafia' 
              ? 'bg-gradient-to-r from-[#A78BFA] to-[#60A5FA] bg-clip-text text-transparent'
              : quizType === 'liar'
              ? 'bg-gradient-to-r from-[#A3B18A] to-[#7F8F69] bg-clip-text text-transparent'
              : 'bg-gradient-to-r from-[#38BDF8] to-[#38BDF8] bg-clip-text text-transparent'
          }`}>
            {t.room.createNewRoomTitle}
          </h1>
          <p className={
            quizType === 'mafia' 
              ? 'text-[#98A2B3] text-xs sm:text-sm'
              : quizType === 'liar'
              ? 'text-[#A8A29E] text-xs sm:text-sm'
              : 'text-[#94A3B8] text-xs sm:text-sm'
          }>
            {t.room.startGameAsHost}
          </p>
        </div>

        <div className="space-y-4 sm:space-y-5">
          {/* 멀티플레이 게임 유형 선택 */}
          <div>
            <QuizTypeSelectorMultiplayer
              selectedType={quizType}
              onSelect={setQuizType}
              lang={(lang === 'ko' || lang === 'en') ? lang : 'ko'}
              disabled={isCreating}
            />
          </div>

          {/* 호스트 닉네임 */}
          <div>
            <label className={getLabelClass()}>
              <i className="ri-user-line mr-1"></i>
              {t.room.host}
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={t.room.hostNickname}
              className={getInputClass() + ' border'}
              style={getInputStyle()}
              maxLength={20}
            />
          </div>

          {/* 게임 설정 (soup, 라이어, 마피아 공통) */}
          {quizType && MULTIPLAYER_QUIZ_TYPES.includes(quizType) && (
            <>
              <div>
                <label className={getLabelClass()}>
                  <i className="ri-file-text-line mr-1"></i>
                  {quizType === 'soup' 
                    ? (lang === 'ko' ? '이야기' : 'Story')
                    : (lang === 'ko' ? '게임 설명' : 'Game Description')
                  }
                </label>
                <textarea
                  value={story}
                  onChange={(e) => setStory(e.target.value)}
                  placeholder={
                    quizType === 'soup'
                      ? (lang === 'ko' ? '이야기를 입력하세요' : 'Enter the story')
                      : (lang === 'ko' ? '게임의 배경과 규칙을 설명해주세요' : 'Describe the game background and rules')
                  }
                  className={getInputClass() + ' h-32 resize-none border'}
                  style={getInputStyle()}
                  maxLength={5000}
                />
                <div className={`text-right text-xs mt-1 ${
                  quizType === 'mafia' 
                    ? 'text-[#98A2B3]'
                    : quizType === 'liar'
                    ? 'text-[#A8A29E]'
                    : 'text-[#94A3B8]'
                }`}>
                  {story.length} / 5000
                </div>
              </div>

              <div>
                <label className={getLabelClass()}>
                  <i className="ri-information-line mr-1"></i>
                  {quizType === 'soup'
                    ? (lang === 'ko' ? '정답' : 'Answer')
                    : (lang === 'ko' ? '추가 정보' : 'Additional Info')
                  }
                </label>
                <textarea
                  value={truth}
                  onChange={(e) => setTruth(e.target.value)}
                  placeholder={
                    quizType === 'soup'
                      ? (lang === 'ko' ? '정답을 입력하세요' : 'Enter the answer')
                      : (lang === 'ko' ? '게임에 필요한 추가 정보나 설정을 입력하세요' : 'Enter additional information or settings for the game')
                  }
                  className={getInputClass() + ' h-40 resize-none border'}
                  style={getInputStyle()}
                  maxLength={1000}
                />
                <div className={`text-right text-xs mt-1 ${
                  quizType === 'mafia' 
                    ? 'text-[#98A2B3]'
                    : quizType === 'liar'
                    ? 'text-[#A8A29E]'
                    : 'text-[#94A3B8]'
                }`}>
                  {truth.length} / 1000
                </div>
              </div>

              {/* 바다거북스프만 힌트 입력 */}
              {quizType === 'soup' && (
                <div>
                  <label className={getLabelClass()}>
                    <i className="ri-lightbulb-line mr-1"></i>
                    {lang === 'ko' ? '힌트 (선택사항, 최대 3개)' : 'Hints (Optional, up to 3)'}
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
                        placeholder={lang === 'ko' ? `힌트 ${index + 1}` : `Hint ${index + 1}`}
                        className={getInputClass() + ' border'}
                        style={getInputStyle()}
                        maxLength={200}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <div>
            <label className={getLabelClass()}>
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
                <span className={`text-xs sm:text-sm ${
                  quizType === 'mafia' 
                    ? 'text-[#98A2B3]'
                    : quizType === 'liar'
                    ? 'text-[#A8A29E]'
                    : 'text-[#94A3B8]'
                }`}>
                  {t.room.setPassword}
                </span>
              </label>
              {usePassword && (
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.room.enterRoomPasswordPlaceholder}
                  className={getInputClass() + ' border'}
                  style={getInputStyle()}
                  maxLength={20}
                />
              )}
              {usePassword && (
                <p className={`text-xs ${
                  quizType === 'mafia' 
                    ? 'text-[#98A2B3]'
                    : quizType === 'liar'
                    ? 'text-[#A8A29E]'
                    : 'text-[#94A3B8]'
                }`}>
                  {t.room.passwordDescription}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className={getLabelClass()}>
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
                  className={`flex-1 ${
                    quizType === 'mafia' 
                      ? 'accent-[#A78BFA]' 
                      : quizType === 'liar'
                      ? 'accent-[#A3B18A]'
                      : 'accent-[#38BDF8]'
                  }`}
                />
                <span className={`text-xl sm:text-2xl font-bold w-16 sm:w-20 text-center ${
                  quizType === 'mafia' 
                    ? 'text-[#A78BFA]' 
                    : quizType === 'liar'
                    ? 'text-[#A3B18A]'
                    : 'text-[#38BDF8]'
                }`}>
                  {maxQuestions === null ? t.room.unlimited : maxQuestions}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMaxQuestions(null)}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all border ${
                    maxQuestions === null
                      ? (quizType === 'mafia' 
                          ? 'bg-[#A78BFA] text-white border-[#A78BFA] hover:bg-[#8B6CFA]' 
                          : quizType === 'liar'
                          ? 'bg-[#A3B18A] text-[#0E0D0B] border-[#A3B18A] hover:bg-[#7F8F69]'
                          : 'bg-[#38BDF8] text-white border-[#38BDF8] hover:bg-[#0EA5E9]')
                      : (quizType === 'mafia'
                          ? 'bg-[#0D1220] text-[#E6EAF2] border-[#1C2541] hover:bg-[#1C2541]'
                          : quizType === 'liar'
                          ? 'bg-[#171614] text-[#F1F0ED] border-[#2A2824] hover:bg-[#2A2824]'
                          : 'bg-[#111827] text-[#E5E7EB] border-[#243041] hover:bg-[#1F2937]')
                  }`}
                >
                  {t.room.unlimited}
                </button>
                <button
                  type="button"
                  onClick={() => setMaxQuestions(30)}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all border ${
                    maxQuestions === 30
                      ? (quizType === 'mafia' 
                          ? 'bg-[#A78BFA] text-white border-[#A78BFA] hover:bg-[#8B6CFA]' 
                          : quizType === 'liar'
                          ? 'bg-[#A3B18A] text-[#0E0D0B] border-[#A3B18A] hover:bg-[#7F8F69]'
                          : 'bg-[#38BDF8] text-white border-[#38BDF8] hover:bg-[#0EA5E9]')
                      : (quizType === 'mafia'
                          ? 'bg-[#0D1220] text-[#E6EAF2] border-[#1C2541] hover:bg-[#1C2541]'
                          : quizType === 'liar'
                          ? 'bg-[#171614] text-[#F1F0ED] border-[#2A2824] hover:bg-[#2A2824]'
                          : 'bg-[#111827] text-[#E5E7EB] border-[#243041] hover:bg-[#1F2937]')
                  }`}
                >
                  30{lang === 'ko' ? t.room.questionsCount : ''}
                </button>
                <button
                  type="button"
                  onClick={() => setMaxQuestions(50)}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all border ${
                    maxQuestions === 50
                      ? (quizType === 'mafia' 
                          ? 'bg-[#A78BFA] text-white border-[#A78BFA] hover:bg-[#8B6CFA]' 
                          : quizType === 'liar'
                          ? 'bg-[#A3B18A] text-[#0E0D0B] border-[#A3B18A] hover:bg-[#7F8F69]'
                          : 'bg-[#38BDF8] text-white border-[#38BDF8] hover:bg-[#0EA5E9]')
                      : (quizType === 'mafia'
                          ? 'bg-[#0D1220] text-[#E6EAF2] border-[#1C2541] hover:bg-[#1C2541]'
                          : quizType === 'liar'
                          ? 'bg-[#171614] text-[#F1F0ED] border-[#2A2824] hover:bg-[#2A2824]'
                          : 'bg-[#111827] text-[#E5E7EB] border-[#243041] hover:bg-[#1F2937]')
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
            className={`w-full font-semibold py-3 sm:py-4 rounded-xl transition-all duration-200 shadow-lg mt-6 sm:mt-8 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base ${
              quizType === 'mafia'
                ? 'bg-gradient-to-r from-[#A78BFA] to-[#60A5FA] hover:from-[#8B6CFA] hover:to-[#4F8FFA] text-white hover:shadow-[#A78BFA]/50'
                : quizType === 'liar'
                ? 'bg-gradient-to-r from-[#A3B18A] to-[#7F8F69] hover:from-[#7F8F69] hover:to-[#6B7A5A] text-[#0E0D0B] hover:shadow-[#A3B18A]/50'
                : 'bg-gradient-to-r from-[#38BDF8] to-[#38BDF8] hover:from-[#0EA5E9] hover:to-[#0284C7] text-white hover:shadow-[#38BDF8]/50'
            }`}
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

