'use client';

import ImageUpload from './ImageUpload';

interface QuizFormPatternProps {
  question: string;
  pattern: string; // 패턴 설명 또는 수열
  answer: string;
  explanation?: string;
  imageUrl?: string;
  onQuestionChange: (value: string) => void;
  onPatternChange: (value: string) => void;
  onAnswerChange: (value: string) => void;
  onExplanationChange?: (value: string) => void;
  onImageChange?: (file: File | null) => void;
  onImageUrlChange?: (url: string) => void;
  lang?: 'ko' | 'en';
}

export default function QuizFormPattern({
  question,
  pattern,
  answer,
  explanation = '',
  imageUrl,
  onQuestionChange,
  onPatternChange,
  onAnswerChange,
  onExplanationChange,
  onImageChange,
  onImageUrlChange,
  lang = 'ko',
}: QuizFormPatternProps) {
  return (
    <>
      {/* 이미지 업로드 */}
      {onImageChange && (
        <ImageUpload
          imageUrl={imageUrl}
          onImageChange={onImageChange}
          onImageUrlChange={onImageUrlChange}
          lang={lang}
        />
      )}

      {/* 패턴/수열 */}
      <div>
        <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
          <i className="ri-numbers-line mr-1"></i>
          {lang === 'ko' ? '패턴/수열' : 'Pattern/Sequence'}
        </label>
        <textarea
          value={pattern}
          onChange={(e) => onPatternChange(e.target.value)}
          placeholder={lang === 'ko' ? '예: 2, 4, 8, 16, ? 또는 패턴을 설명하세요' : 'Example: 2, 4, 8, 16, ? or describe the pattern'}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent h-32 resize-none text-sm"
          maxLength={500}
        />
        <div className="text-right text-xs text-slate-500 mt-1">
          {pattern.length} / 500
        </div>
      </div>

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
          placeholder={lang === 'ko' ? '다음 숫자나 패턴의 정답을 입력하세요' : 'Enter the next number or pattern answer'}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
          maxLength={200}
        />
      </div>

      {/* 설명 */}
      {onExplanationChange && (
        <div>
          <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
            <i className="ri-information-line mr-1"></i>
            {lang === 'ko' ? '해설 (선택사항)' : 'Explanation (Optional)'}
          </label>
          <textarea
            value={explanation}
            onChange={(e) => onExplanationChange(e.target.value)}
            placeholder={lang === 'ko' ? '패턴을 찾는 과정과 설명을 입력하세요' : 'Enter the process and explanation for finding the pattern'}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent h-24 resize-none text-sm"
            maxLength={300}
          />
        </div>
      )}
    </>
  );
}

