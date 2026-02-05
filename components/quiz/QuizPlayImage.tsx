'use client';

import { useState } from 'react';
import Image from 'next/image';

interface QuizPlayImageProps {
  imageUrl: string;
  question?: string;
  answer: string;
  onAnswer: (userAnswer: string) => void;
  showAnswer?: boolean;
  userAnswer?: string;
  explanation?: string;
  lang?: 'ko' | 'en';
}

export default function QuizPlayImage({
  imageUrl,
  question,
  answer,
  onAnswer,
  showAnswer = false,
  userAnswer,
  explanation,
  lang = 'ko',
}: QuizPlayImageProps) {
  const [inputAnswer, setInputAnswer] = useState(userAnswer || '');
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);
  const isKo = lang === 'ko';

  const handleSubmit = () => {
    if (inputAnswer.trim() && !showAnswer) {
      onAnswer(inputAnswer.trim());
    }
  };

  // 정답 확인: userAnswer가 "-"이거나 정확히 일치하지 않으면 오답
  const isCorrect = showAnswer && userAnswer?.toLowerCase().trim() === answer.toLowerCase().trim() && userAnswer?.trim() !== '-';
  const isWrongAnswer = showAnswer && (!userAnswer || userAnswer.trim() === '' || userAnswer.trim() === '-' || userAnswer?.toLowerCase().trim() !== answer.toLowerCase().trim());

  return (
    <div className="space-y-4">
      {question && (
        <div className="text-lg font-semibold text-white mb-4">
          {question}
        </div>
      )}

      <div className="relative w-full max-w-2xl mx-auto aspect-video rounded-lg overflow-hidden border border-slate-700">
        <Image
          src={imageUrl}
          alt={isKo ? '퀴즈 이미지' : 'Quiz Image'}
          fill
          sizes="(max-width: 768px) 100vw, 672px"
          className="object-contain"
          unoptimized
        />
      </div>

      {!showAnswer && (
        <div className="space-y-3">
          <input
            type="text"
            value={inputAnswer}
            onChange={(e) => setInputAnswer(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder={isKo ? '정답을 입력하세요' : 'Enter your answer'}
            className="w-full p-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-teal-500"
          />
          <button
            onClick={handleSubmit}
            disabled={!inputAnswer.trim()}
            className="w-full p-3 bg-teal-600 hover:bg-teal-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all"
          >
            {isKo ? '정답 제출' : 'Submit Answer'}
          </button>
        </div>
      )}

      {showAnswer && (
        <div className="space-y-3">
          {isCorrect ? (
            <div className="p-4 rounded-lg bg-green-900/50 border border-green-500">
              <div className="text-lg font-semibold mb-2 text-green-400">
                {isKo ? '정답입니다!' : 'Correct!'}
              </div>
              {userAnswer && (
                <div className="text-slate-300">
                  {isKo ? '입력한 답: ' : 'Your answer: '}
                  <span className="font-semibold">{userAnswer}</span>
                </div>
              )}
            </div>
          ) : isWrongAnswer ? (
            <div className="space-y-3">
              <div className="p-4 rounded-lg bg-red-900/50 border border-red-500">
                <div className="text-lg font-semibold mb-2 text-red-400">
                  {isKo ? '오답입니다.' : 'Incorrect.'}
                </div>
                {userAnswer && userAnswer.trim() !== '-' && (
                  <div className="text-slate-300">
                    {isKo ? '입력한 답: ' : 'Your answer: '}
                    <span className="font-semibold">{userAnswer}</span>
                  </div>
                )}
              </div>
              
              {!showCorrectAnswer ? (
                <button
                  onClick={() => setShowCorrectAnswer(true)}
                  className="w-full p-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-all"
                >
                  {isKo ? '정답을 확인하시겠습니까?' : 'Would you like to see the correct answer?'}
                </button>
              ) : (
                <div className="p-4 rounded-lg bg-slate-800 border border-slate-600">
                  <div className="text-slate-300">
                    {isKo ? '정답: ' : 'Correct answer: '}
                    <span className="font-semibold text-teal-400">{answer}</span>
                  </div>
                </div>
              )}
            </div>
          ) : null}
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
            <div className="text-sm text-slate-300">{explanation}</div>
          </div>
        </details>
      )}
    </div>
  );
}

