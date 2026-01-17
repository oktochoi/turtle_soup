'use client';

interface QuizFormNonsenseProps {
  question: string;
  answer: string;
  explanation: string;
  onQuestionChange: (value: string) => void;
  onAnswerChange: (value: string) => void;
  onExplanationChange: (value: string) => void;
  lang?: 'ko' | 'en';
}

export default function QuizFormNonsense({
  question,
  answer,
  explanation,
  onQuestionChange,
  onAnswerChange,
  onExplanationChange,
  lang = 'ko',
}: QuizFormNonsenseProps) {
  return (
    <>
      {/* 정답 */}
      <div>
        <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
          <i className="ri-checkbox-circle-line mr-1"></i>
          {lang === 'ko' ? '정답' : 'Answer'}
        </label>
        <input
          type="text"
          value={answer}
          onChange={(e) => onAnswerChange(e.target.value)}
          placeholder={lang === 'ko' ? '정답을 입력하세요' : 'Enter the answer'}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
          maxLength={200}
        />
      </div>

      {/* 설명 */}
      <div>
        <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
          <i className="ri-information-line mr-1"></i>
          {lang === 'ko' ? '설명' : 'Explanation'}
        </label>
        <textarea
          value={explanation}
          onChange={(e) => onExplanationChange(e.target.value)}
          placeholder={lang === 'ko' ? '정답의 이유와 설명을 입력하세요' : 'Enter the explanation for the answer'}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent h-32 resize-none text-sm"
          maxLength={500}
        />
        <div className="text-right text-xs text-slate-500 mt-1">
          {explanation.length} / 500
        </div>
      </div>
    </>
  );
}

