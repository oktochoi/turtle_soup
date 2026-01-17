'use client';

interface QuizFormOXProps {
  question: string;
  correct: 'O' | 'X';
  explanation: string;
  onQuestionChange: (value: string) => void;
  onCorrectChange: (value: 'O' | 'X') => void;
  onExplanationChange: (value: string) => void;
  lang?: 'ko' | 'en';
}

export default function QuizFormOX({
  question,
  correct,
  explanation,
  onQuestionChange,
  onCorrectChange,
  onExplanationChange,
  lang = 'ko',
}: QuizFormOXProps) {
  return (
    <>
      {/* 정답 선택 */}
      <div>
        <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
          <i className="ri-checkbox-circle-line mr-1"></i>
          {lang === 'ko' ? '정답' : 'Answer'}
        </label>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => onCorrectChange('O')}
            className={`
              flex-1 py-4 rounded-xl border-2 font-bold text-xl transition-all
              ${correct === 'O'
                ? 'border-green-500 bg-green-500/10 text-green-400 shadow-lg shadow-green-500/20'
                : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
              }
            `}
          >
            <i className="ri-checkbox-circle-fill mr-2"></i>
            O
          </button>
          <button
            type="button"
            onClick={() => onCorrectChange('X')}
            className={`
              flex-1 py-4 rounded-xl border-2 font-bold text-xl transition-all
              ${correct === 'X'
                ? 'border-red-500 bg-red-500/10 text-red-400 shadow-lg shadow-red-500/20'
                : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
              }
            `}
          >
            <i className="ri-close-circle-fill mr-2"></i>
            X
          </button>
        </div>
      </div>

      {/* 설명 */}
      <div>
        <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
          <i className="ri-information-line mr-1"></i>
          {lang === 'ko' ? '설명 (선택사항)' : 'Explanation (Optional)'}
        </label>
        <textarea
          value={explanation}
          onChange={(e) => onExplanationChange(e.target.value)}
          placeholder={lang === 'ko' ? '정답의 이유와 설명을 입력하세요' : 'Enter the explanation for the answer'}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent h-24 resize-none text-sm"
          maxLength={300}
        />
      </div>
    </>
  );
}

