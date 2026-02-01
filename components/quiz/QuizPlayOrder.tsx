'use client';

import { useState } from 'react';

interface QuizPlayOrderProps {
  question: string; // 제목에서 가져온 문제
  items: string[];
  correctOrder: number[]; // 올바른 순서 (인덱스 배열)
  explanation?: string;
  onAnswer: (order: number[]) => void;
  showAnswer?: boolean;
  userAnswer?: number[];
  lang?: 'ko' | 'en';
}

export default function QuizPlayOrder({
  question,
  items,
  correctOrder,
  explanation,
  onAnswer,
  showAnswer = false,
  userAnswer,
  lang = 'ko',
}: QuizPlayOrderProps) {
  const [order, setOrder] = useState<number[]>(userAnswer || []);
  const isKo = lang === 'ko';

  const handleOrderChange = (index: number, value: number) => {
    if (showAnswer) return;
    const newOrder = [...order];
    newOrder[index] = value;
    setOrder(newOrder);
  };

  const handleSubmit = () => {
    if (order.length !== items.length || order.some(o => o < 0 || o >= items.length)) {
      return;
    }
    onAnswer(order);
  };

  const isCorrect = showAnswer && userAnswer && 
    userAnswer.length === correctOrder.length &&
    userAnswer.every((val, idx) => val === correctOrder[idx]);

  return (
    <div className="space-y-6">
      {/* 문제 (제목) */}
      <div className="text-lg sm:text-xl font-semibold text-white mb-4">
        {question}
      </div>

      {/* 항목들 */}
      <div className="space-y-3">
        {items.map((item, index) => {
          const currentOrder = order[index] !== undefined ? order[index] : -1;
          const isCorrectItem = showAnswer && currentOrder === correctOrder[index];
          const isWrongItem = showAnswer && currentOrder !== correctOrder[index] && currentOrder >= 0;

          return (
            <div
              key={index}
              className={`p-4 rounded-lg border-2 ${
                showAnswer
                  ? isCorrectItem
                    ? 'bg-green-500/10 border-green-500'
                    : isWrongItem
                    ? 'bg-red-500/10 border-red-500'
                    : 'bg-slate-800 border-slate-700'
                  : 'bg-slate-800 border-slate-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm font-semibold text-white">
                  {index + 1}
                </div>
                <div className="flex-1 text-slate-200">{item}</div>
                {!showAnswer && (
                  <input
                    type="number"
                    min="1"
                    max={items.length}
                    value={currentOrder >= 0 ? currentOrder + 1 : ''}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val) && val >= 1 && val <= items.length) {
                        handleOrderChange(index, val - 1);
                      } else if (e.target.value === '') {
                        handleOrderChange(index, -1);
                      }
                    }}
                    placeholder={isKo ? '순서' : 'Order'}
                    className="w-20 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-center text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                )}
                {showAnswer && (
                  <div className="flex-shrink-0">
                    {isCorrectItem && (
                      <span className="text-green-400 font-semibold">
                        {isKo ? `순서: ${currentOrder + 1} ✓` : `Order: ${currentOrder + 1} ✓`}
                      </span>
                    )}
                    {isWrongItem && (
                      <span className="text-red-400 font-semibold">
                        {isKo ? `순서: ${currentOrder + 1} ✗` : `Order: ${currentOrder + 1} ✗`}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 제출 버튼 */}
      {!showAnswer && (
        <button
          onClick={handleSubmit}
          disabled={order.length !== items.length || order.some(o => o < 0 || o >= items.length)}
          className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isKo ? '정답 제출' : 'Submit Answer'}
        </button>
      )}

      {/* 정답 표시 */}
      {showAnswer && (
        <div className="space-y-4">
          <div className={`p-4 rounded-lg border-2 ${
            isCorrect
              ? 'bg-green-500/10 border-green-500'
              : 'bg-red-500/10 border-red-500'
          }`}>
            <div className={`text-lg font-bold ${
              isCorrect ? 'text-green-400' : 'text-red-400'
            }`}>
              {isCorrect
                ? (isKo ? '정답입니다!' : 'Correct!')
                : (isKo ? '틀렸습니다.' : 'Incorrect.')}
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

