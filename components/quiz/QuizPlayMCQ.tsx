'use client';

import { useState } from 'react';
import type { MCQQuizContent } from '@/lib/types/quiz';

interface QuizPlayMCQProps {
  content: MCQQuizContent;
  onAnswer: (selectedIndex: number) => void;
  showAnswer?: boolean;
  userAnswer?: number;
  lang?: 'ko' | 'en';
}

export default function QuizPlayMCQ({
  content,
  onAnswer,
  showAnswer = false,
  userAnswer,
  lang = 'ko',
}: QuizPlayMCQProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(userAnswer ?? null);
  const isKo = lang === 'ko';

  const handleSelect = (index: number) => {
    if (showAnswer) return;
    setSelectedIndex(index);
    onAnswer(index);
  };

  return (
    <div className="space-y-4">
      <div className="text-lg font-semibold text-white mb-4">
        {content.question}
      </div>

      <div className="space-y-3">
        {content.options.map((option, index) => {
          const isSelected = selectedIndex === index;
          const isCorrect = showAnswer && index === content.correct;
          const isWrong = showAnswer && isSelected && index !== content.correct;

          let bgColor = 'bg-ink-600 hover:bg-slate-600';
          if (showAnswer) {
            if (isCorrect) bgColor = 'bg-green-600';
            else if (isWrong) bgColor = 'bg-red-600';
            else bgColor = 'bg-ink-600';
          } else if (isSelected) {
            bgColor = 'bg-teal-600 hover:bg-brass';
          }

          return (
            <button
              key={index}
              onClick={() => handleSelect(index)}
              disabled={showAnswer}
              className={`w-full p-4 rounded-lg text-left transition-all ${bgColor} text-white border-2 ${
                isSelected ? 'border-teal-400' : 'border-transparent'
              } ${showAnswer ? 'cursor-default' : 'cursor-pointer'}`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                  isCorrect ? 'bg-green-500' : isWrong ? 'bg-red-500' : 'bg-slate-500'
                }`}>
                  {String.fromCharCode(65 + index)}
                </div>
                <span>{option}</span>
                {showAnswer && isCorrect && (
                  <span className="ml-auto text-green-300">✓ 정답</span>
                )}
                {showAnswer && isWrong && (
                  <span className="ml-auto text-red-300">✗ 오답</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* 해설: details/summary로 항상 HTML에 포함 (AdSense/크롤러 인덱싱) */}
      {content.explanation && (
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
            <div className="text-sm text-fog">{content.explanation}</div>
          </div>
        </details>
      )}
    </div>
  );
}

