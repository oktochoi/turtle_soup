'use client';

import { useState } from 'react';

interface QuizPlayLogicProps {
  question: string; // 제목에서 가져온 문제
  content: string; // 조건/규칙 설명
  answer: string;
  explanation?: string;
  onAnswer: (userAnswer: string) => void;
  showAnswer?: boolean;
  userAnswer?: string;
  lang?: 'ko' | 'en';
}

export default function QuizPlayLogic({
  question,
  content,
  answer,
  explanation,
  onAnswer,
  showAnswer = false,
  userAnswer,
  lang = 'ko',
}: QuizPlayLogicProps) {
  const [inputAnswer, setInputAnswer] = useState<string>(userAnswer || '');
  const isKo = lang === 'ko';

  const handleSubmit = () => {
    if (!inputAnswer.trim()) return;
    onAnswer(inputAnswer.trim());
  };

  const isCorrect = showAnswer && userAnswer && userAnswer.toLowerCase().trim() === answer.toLowerCase().trim();

  return (
    <div className="space-y-6">
      {/* 문제 (제목) */}
      <div className="text-lg sm:text-xl font-semibold text-white mb-4">
        {question}
      </div>

      {/* 조건/규칙 설명 */}
      <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
        <div className="text-sm font-semibold text-teal-400 mb-2">
          {isKo ? '조건/규칙' : 'Conditions/Rules'}
        </div>
        <div className="text-sm text-slate-300 whitespace-pre-wrap">{content}</div>
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
            placeholder={isKo ? '정답을 입력하세요' : 'Enter your answer'}
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
        </div>
      )}

      {/* 해설: details/summary로 항상 HTML에 포함 (AdSense/크롤러 인덱싱) */}
      {explanation && (
        <details className="mt-4 group">
          <summary className="list-none cursor-pointer [&::-webkit-details-marker]:hidden">
            <div className="bg-slate-800 rounded-lg border border-slate-600 hover:border-teal-500/30 transition-colors px-4 py-2.5 flex items-center justify-between">
              <span className="text-sm font-semibold text-teal-400">
                {isKo ? '해설 보기' : 'View Explanation'}
              </span>
              <i className="ri-arrow-down-s-line text-slate-400 group-open:rotate-180 transition-transform"></i>
            </div>
          </summary>
          <div className="mt-2 p-4 bg-slate-800 rounded-lg border border-slate-600 border-t-0 rounded-t-none">
            <div className="text-sm text-slate-300 whitespace-pre-wrap">{explanation}</div>
          </div>
        </details>
      )}
    </div>
  );
}

