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

          let bgColor = 'bg-slate-700 hover:bg-slate-600';
          if (showAnswer) {
            if (isCorrect) bgColor = 'bg-green-600';
            else if (isWrong) bgColor = 'bg-red-600';
            else bgColor = 'bg-slate-700';
          } else if (isSelected) {
            bgColor = 'bg-teal-600 hover:bg-teal-500';
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

      {showAnswer && content.explanation && (
        <div className="mt-4 p-4 bg-slate-800 rounded-lg border border-slate-600">
          <div className="text-sm font-semibold text-teal-400 mb-2">
            {isKo ? '해설' : 'Explanation'}
          </div>
          <div className="text-sm text-slate-300">{content.explanation}</div>
        </div>
      )}
    </div>
  );
}

