'use client';

import { useState } from 'react';
import { useTranslations } from '@/hooks/useTranslations';

type GuessInputProps = {
  onSubmit: (text: string) => void;
  hasSubmitted: boolean;
  userGuess?: {
    judged: boolean;
    correct: boolean;
  } | null;
};

export default function GuessInput({ onSubmit, hasSubmitted, userGuess }: GuessInputProps) {
  const t = useTranslations();
  const [text, setText] = useState('');

  const handleSubmit = () => {
    if (text.trim()) {
      onSubmit(text);
      setText('');
    }
  };

  // 정답인 경우에만 완전히 막기
  if (hasSubmitted && userGuess?.judged && userGuess.correct) {
    return (
      <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-xl p-4 sm:p-6 border border-green-500/30 text-center">
        <div className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-green-500/20 rounded-full mx-auto mb-2 sm:mb-3">
          <i className="ri-checkbox-circle-line text-green-400 text-xl sm:text-2xl"></i>
        </div>
        <h3 className="font-semibold text-green-400 mb-1 text-xs sm:text-sm">{t.room.correctAnswer}</h3>
        <p className="text-xs sm:text-sm text-slate-400">{t.room.congrats}</p>
      </div>
    );
  }

  // 오답이거나 판정 대기 중일 때는 계속 답변 입력 가능
  const showStatusMessage = hasSubmitted && userGuess?.judged && !userGuess.correct;

  return (
    <div className="bg-slate-800 rounded-xl p-3 sm:p-4 border border-slate-700">
      {showStatusMessage && (
        <div className="bg-gradient-to-br from-red-500/10 to-rose-500/10 rounded-lg p-3 mb-3 sm:mb-4 border border-red-500/30">
          <div className="flex items-center gap-2">
            <i className="ri-close-circle-line text-red-400 text-sm sm:text-base"></i>
            <div>
              <h4 className="font-semibold text-red-400 text-xs sm:text-sm">{t.room.wrongAnswer}</h4>
              <p className="text-xs text-slate-400">{t.room.thinkAgain}</p>
            </div>
          </div>
        </div>
      )}
      {hasSubmitted && !userGuess?.judged && (
        <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-lg p-3 mb-3 sm:mb-4 border border-purple-500/30">
          <div className="flex items-center gap-2">
            <i className="ri-check-double-line text-purple-400 text-sm sm:text-base"></i>
            <div>
              <h4 className="font-semibold text-purple-400 text-xs sm:text-sm">{t.room.answerSubmitted}</h4>
              <p className="text-xs text-slate-400">{t.room.waitForJudgment}</p>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center gap-2 mb-2 sm:mb-3">
        <div className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center flex-shrink-0">
          <i className="ri-lightbulb-flash-line text-purple-400 text-sm sm:text-base"></i>
        </div>
        <h3 className="font-semibold text-xs sm:text-sm">{t.room.guessAnswer}</h3>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t.room.guessPlaceholder}
        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 sm:px-4 py-2 sm:py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none h-24 sm:h-32 text-xs sm:text-sm mb-2 sm:mb-3"
        maxLength={500}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-slate-500">{text.length} / 500</span>
        <button
          onClick={handleSubmit}
          disabled={!text.trim()}
          className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-4 sm:px-6 py-2 rounded-lg font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm whitespace-nowrap"
        >
          <i className="ri-send-plane-fill mr-1"></i>
          {t.room.submit}
        </button>
      </div>
    </div>
  );
}
