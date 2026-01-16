'use client';

import { useState } from 'react';

interface QuizPlayBalanceProps {
  question: string;
  options: string[]; // 2개 이상
  onAnswer: (selectedIndex: number) => void;
  showAnswer?: boolean;
  userAnswer?: number;
  stats?: number[]; // 각 선택지별 투표 수 배열
  lang?: 'ko' | 'en';
}

const COLORS = [
  'bg-teal-500',
  'bg-cyan-500',
  'bg-blue-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-orange-500',
  'bg-yellow-500',
  'bg-green-500',
  'bg-indigo-500',
  'bg-red-500',
];

export default function QuizPlayBalance({
  question,
  options,
  onAnswer,
  showAnswer = false,
  userAnswer,
  stats,
  lang = 'ko',
}: QuizPlayBalanceProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(userAnswer ?? null);
  const isKo = lang === 'ko';

  const handleSelect = (index: number) => {
    if (showAnswer) return;
    setSelectedIndex(index);
    onAnswer(index);
  };

  // 통계 계산
  const totalVotes = stats ? stats.reduce((sum, count) => sum + count, 0) : 0;
  const percentages = stats && totalVotes > 0
    ? stats.map((count) => Math.round((count / totalVotes) * 100))
    : options.map(() => 0);

  // 그리드 컬럼 수 결정 (선택지 개수에 따라)
  const gridCols = options.length <= 2 ? 2 : options.length <= 4 ? 2 : 3;

  return (
    <div className="space-y-6">
      <div className="text-lg font-semibold text-white mb-6 text-center">
        {question}
      </div>

      <div className={`grid grid-cols-1 sm:grid-cols-${gridCols} gap-4`}>
        {options.map((option, index) => {
          const isSelected = selectedIndex === index;
          const percent = percentages[index];
          const voteCount = stats ? stats[index] : 0;
          const colorClass = COLORS[index % COLORS.length];

          return (
            <button
              key={index}
              onClick={() => handleSelect(index)}
              disabled={showAnswer}
              className={`p-6 rounded-lg transition-all text-center relative ${
                isSelected
                  ? 'bg-teal-600 hover:bg-teal-500 border-2 border-teal-400'
                  : 'bg-slate-700 hover:bg-slate-600 border-2 border-transparent'
              } ${showAnswer ? 'cursor-default' : 'cursor-pointer'}`}
            >
              <div className="text-white font-semibold text-lg mb-2">{option}</div>
              {showAnswer && stats && totalVotes > 0 && (
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-white">{percent}%</div>
                  <div className="text-sm text-slate-300">
                    {voteCount} {isKo ? '표' : 'votes'}
                  </div>
                </div>
              )}
              {!showAnswer && isSelected && (
                <div className="absolute top-2 right-2">
                  <i className="ri-checkbox-circle-fill text-teal-400 text-2xl"></i>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {showAnswer && stats && totalVotes > 0 && (
        <div className="space-y-3 mt-6">
          <div className="text-sm font-semibold text-slate-400 mb-3">
            {isKo ? '전체 통계' : 'Overall Statistics'}
          </div>
          {options.map((option, index) => {
            const percent = percentages[index];
            const voteCount = stats[index];
            const colorClass = COLORS[index % COLORS.length];

            return (
              <div key={index} className="space-y-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-300">
                    {String.fromCharCode(65 + index)}. {option}
                  </span>
                  <span className="text-sm font-semibold text-white">
                    {percent}% ({voteCount})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-4 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${colorClass} transition-all`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-400 w-12 text-right">{percent}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

