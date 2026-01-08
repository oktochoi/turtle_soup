'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export default function CreateRoom() {
  const router = useRouter();
  const [story, setStory] = useState('');
  const [truth, setTruth] = useState('');
  const [maxQuestions, setMaxQuestions] = useState<number | null>(30);
  const [nickname, setNickname] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const handleCreate = async () => {
    if (!story.trim() || !truth.trim() || !nickname.trim()) {
      alert('모든 필드를 입력해주세요');
      return;
    }

    // Supabase 환경 변수 확인
    if (!isSupabaseConfigured()) {
      alert('Supabase가 설정되지 않았습니다.\n\n.env.local 파일을 확인하고:\n1. NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_ANON_KEY가 올바르게 설정되어 있는지 확인\n2. 개발 서버를 재시작하세요 (환경 변수 변경 후 필수)');
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
        throw new Error('방 코드 생성에 실패했습니다. 다시 시도해주세요.');
      }

      // 방 생성
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .insert({
          code: roomCode,
          story: story.trim(),
          truth: truth.trim(),
          max_questions: maxQuestions || 999999, // null이면 매우 큰 값으로 설정 (무제한)
          host_nickname: nickname.trim(),
          game_ended: false,
          status: 'active',
        })
        .select()
        .single();

      if (roomError) throw roomError;

      // 호스트를 players 테이블에 추가
      const { error: playerError } = await supabase
        .from('players')
        .insert({
          room_code: roomCode,
          nickname: nickname.trim(),
          is_host: true,
        });

      if (playerError) throw playerError;

      router.push(`/room/${roomCode}?host=true&nickname=${encodeURIComponent(nickname.trim())}`);
    } catch (error) {
      console.error('방 생성 오류:', error);
      alert('방 생성에 실패했습니다. 다시 시도해주세요.');
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 max-w-2xl">
        <div className="mb-4 sm:mb-6">
          <Link href="/">
            <button className="text-slate-400 hover:text-white transition-colors whitespace-nowrap text-sm sm:text-base">
              <i className="ri-arrow-left-line mr-2"></i>
              돌아가기
            </button>
          </Link>
        </div>

        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2 bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
            새 방 만들기
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm">관리자로 게임을 시작합니다</p>
        </div>

        <div className="space-y-4 sm:space-y-5">
          <div>
            <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
              <i className="ri-user-line mr-1"></i>
              닉네임
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="관리자 닉네임"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
              maxLength={20}
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
              <i className="ri-file-text-line mr-1"></i>
              표면 이야기 (참여자에게 보여질 내용)
            </label>
            <textarea
              value={story}
              onChange={(e) => setStory(e.target.value)}
              placeholder="예: 한 남자가 레스토랑에서 바다거북스프를 먹고 자살했다. 왜 그랬을까?"
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
              진실 (정답 스토리)
            </label>
            <textarea
              value={truth}
              onChange={(e) => setTruth(e.target.value)}
              placeholder="실제 진실을 입력하세요. 이 내용은 정답이 맞춰질 때까지 숨겨집니다."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent h-40 resize-none text-sm"
              maxLength={500}
            />
            <div className="text-right text-xs text-slate-500 mt-1">
              {truth.length} / 500
            </div>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
              <i className="ri-question-answer-line mr-1"></i>
              최대 질문 개수
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
                  {maxQuestions === null ? '무제한' : maxQuestions}
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
                  무제한
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
                  30개
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
                  50개
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={isCreating}
            className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold py-3 sm:py-4 rounded-xl transition-all duration-200 shadow-lg hover:shadow-teal-500/50 mt-6 sm:mt-8 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
          >
            <i className="ri-door-open-line mr-2"></i>
            {isCreating ? '방 생성 중...' : '방 만들기'}
          </button>
        </div>
      </div>
    </div>
  );
}
