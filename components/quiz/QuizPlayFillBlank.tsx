'use client';

import { useState } from 'react';

interface QuizPlayFillBlankProps {
  question: string; // 제목에서 가져온 문제 (빈칸 포함)
  answer: string;
  explanation?: string;
  onAnswer: (userAnswer: string) => void;
  showAnswer?: boolean;
  userAnswer?: string;
  lang?: 'ko' | 'en';
}

export default function QuizPlayFillBlank({
  question,
  answer,
  explanation,
  onAnswer,
  showAnswer = false,
  userAnswer,
  lang = 'ko',
}: QuizPlayFillBlankProps) {
  const [inputAnswer, setInputAnswer] = useState<string>(userAnswer || '');
  const isKo = lang === 'ko';

  const handleSubmit = () => {
    if (!inputAnswer.trim()) return;
    onAnswer(inputAnswer.trim());
  };

  const isCorrect = showAnswer && userAnswer && userAnswer.toLowerCase().trim() === answer.toLowerCase().trim();

  // 빈칸 표시 (___ 또는 [빈칸]을 입력 필드로 대체)
  const displayQuestion = question.replace(/___|\[빈칸\]/g, (match) => {
    if (showAnswer && userAnswer) {
      return `<span class="px-2 py-1 bg-slate-700 rounded text-teal-400 font-semibold">${userAnswer}</span>`;
    }
    return match;
  });

  return (
    <div className="space-y-6">
      {/* 문제 (제목) */}
      <div className="text-lg sm:text-xl font-semibold text-white mb-4">
        <div dangerouslySetInnerHTML={{ __html: displayQuestion }} />
      </div>

      {/* 답변 입력 */}
      {!showAnswer && (
        <div className="space-y-3">
          <input
            type="text"
            value={inputAnswer}
            onChange={(e) => setInputAnswer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSubmit();
              }
            }}
            placeholder={isKo ? '빈칸에 들어갈 답을 입력하세요' : 'Enter the answer for the blank'}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm sm:text-base"
            maxLength={200}
          />
          <button
            onClick={handleSubmit}
            disabled={!inputAnswer.trim()}
            className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isKo ? '정답 제출' : 'Submit Answer'}
          </button>
        </div>
      )}

      {/* 정답 표시 */}
      {showAnswer && (
        <div className="space-y-4">
          <div className={`p-4 rounded-lg border-2 ${
            isCorrect
              ? 'bg-green-500/10 border-green-500'
              : 'bg-red-500/10 border-red-500'
          }`}>
            <div className={`text-lg font-bold mb-2 ${
              isCorrect ? 'text-green-400' : 'text-red-400'
            }`}>
              {isCorrect
                ? (isKo ? '정답입니다!' : 'Correct!')
                : (isKo ? '틀렸습니다.' : 'Incorrect.')}
            </div>
            {userAnswer && (
              <div className="text-sm text-slate-300 mb-2">
                {isKo ? '내 답변: ' : 'Your answer: '}
                <span className="font-semibold">{userAnswer}</span>
              </div>
            )}
            <div className="text-sm text-slate-300">
              {isKo ? '정답: ' : 'Correct answer: '}
              <span className="font-semibold text-teal-400">{answer}</span>
            </div>
          </div>

          {explanation && (
            <div className="p-4 bg-slate-800 rounded-lg border border-slate-600">
              <div className="text-sm font-semibold text-teal-400 mb-2">
                {isKo ? '해설' : 'Explanation'}
              </div>
              <div className="text-sm text-slate-300 whitespace-pre-wrap">{explanation}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

