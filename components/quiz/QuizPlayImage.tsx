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
  const isKo = lang === 'ko';

  const handleSubmit = () => {
    if (inputAnswer.trim() && !showAnswer) {
      onAnswer(inputAnswer.trim());
    }
  };

  const isCorrect = showAnswer && userAnswer?.toLowerCase().trim() === answer.toLowerCase().trim();

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
          <div className={`p-4 rounded-lg ${
            isCorrect ? 'bg-green-900/50 border border-green-500' : 'bg-red-900/50 border border-red-500'
          }`}>
            <div className={`text-lg font-semibold mb-2 ${
              isCorrect ? 'text-green-400' : 'text-red-400'
            }`}>
              {isCorrect 
                ? (isKo ? '정답입니다!' : 'Correct!')
                : (isKo ? '틀렸습니다.' : 'Incorrect.')
              }
            </div>
            {userAnswer && (
              <div className="text-slate-300">
                {isKo ? '입력한 답: ' : 'Your answer: '}
                <span className="font-semibold">{userAnswer}</span>
              </div>
            )}
            <div className="text-slate-300 mt-1">
              {isKo ? '정답: ' : 'Correct answer: '}
              <span className="font-semibold text-teal-400">{answer}</span>
            </div>
          </div>

          {explanation && (
            <div className="p-4 bg-slate-800 rounded-lg border border-slate-600">
              <div className="text-sm font-semibold text-teal-400 mb-2">
                {isKo ? '해설' : 'Explanation'}
              </div>
              <div className="text-sm text-slate-300">{explanation}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

