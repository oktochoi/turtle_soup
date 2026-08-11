'use client';

import { useState } from 'react';

interface QuizPlayOXProps {
  question: string;
  correct: 'O' | 'X';
  onAnswer: (answer: 'O' | 'X') => void;
  showAnswer?: boolean;
  userAnswer?: 'O' | 'X';
  explanation?: string;
  lang?: 'ko' | 'en';
}

export default function QuizPlayOX({
  question,
  correct,
  onAnswer,
  showAnswer = false,
  userAnswer,
  explanation,
  lang = 'ko',
}: QuizPlayOXProps) {
  const [selected, setSelected] = useState<'O' | 'X' | null>(userAnswer ?? null);
  const isKo = lang === 'ko';

  const handleSelect = (answer: 'O' | 'X') => {
    if (showAnswer) return;
    setSelected(answer);
    onAnswer(answer);
  };

  return (
    <div className="space-y-6">
      <div className="text-lg font-semibold text-white mb-6">
        {question}
      </div>

      <div className="flex gap-4 justify-center">
        <button
          onClick={() => handleSelect('O')}
          disabled={showAnswer}
          className={`w-32 h-32 rounded-full text-6xl font-bold transition-all ${
            showAnswer
              ? correct === 'O'
                ? 'bg-green-600 text-white'
                : selected === 'O'
                ? 'bg-red-600 text-white'
                : 'bg-ink-600 text-fog'
              : selected === 'O'
              ? 'bg-teal-600 text-white hover:bg-brass'
              : 'bg-ink-600 text-white hover:bg-slate-600'
          } ${showAnswer ? 'cursor-default' : 'cursor-pointer'}`}
        >
          O
        </button>

        <button
          onClick={() => handleSelect('X')}
          disabled={showAnswer}
          className={`w-32 h-32 rounded-full text-6xl font-bold transition-all ${
            showAnswer
              ? correct === 'X'
                ? 'bg-green-600 text-white'
                : selected === 'X'
                ? 'bg-red-600 text-white'
                : 'bg-ink-600 text-fog'
              : selected === 'X'
              ? 'bg-teal-600 text-white hover:bg-brass'
              : 'bg-ink-600 text-white hover:bg-slate-600'
          } ${showAnswer ? 'cursor-default' : 'cursor-pointer'}`}
        >
          X
        </button>
      </div>

      {showAnswer && (
        <div className="text-center">
          <div className={`text-2xl font-bold ${
            selected === correct ? 'text-green-400' : 'text-red-400'
          }`}>
            {selected === correct 
              ? (isKo ? '정답입니다!' : 'Correct!')
              : (isKo ? '틀렸습니다.' : 'Incorrect.')
            }
          </div>
          <div className="text-lg text-fog mt-2">
            {isKo ? '정답: ' : 'Answer: '}{correct}
          </div>
        </div>
      )}

      {/* 해설: details/summary로 항상 HTML에 포함 (AdSense/크롤러 인덱싱) */}
      {explanation && (
        <details className="mt-4 group">
          <summary className="list-none cursor-pointer [&::-webkit-details-marker]:hidden">
            <div className="bg-ink-700 rounded-lg border border-brass/25 hover:border-brass/30 transition-colors px-4 py-2.5 flex items-center justify-between">
              <span className="text-sm font-semibold text-brass">
                {isKo ? '해설 보기' : 'View Explanation'}
              </span>
              <i className="ri-arrow-down-s-line text-fog group-open:rotate-180 transition-transform"></i>
            </div>
          </summary>
          <div className="mt-2 p-4 bg-ink-700 rounded-lg border border-brass/25 border-t-0 rounded-t-none">
            <div className="text-sm text-fog">{explanation}</div>
          </div>
        </details>
      )}
    </div>
  );
}

