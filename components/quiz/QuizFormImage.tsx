'use client';

import ImageUpload from './ImageUpload';

interface QuizFormImageProps {
  question: string;
  answer: string;
  explanation?: string;
  imageUrl?: string;
  onQuestionChange: (value: string) => void;
  onAnswerChange: (value: string) => void;
  onExplanationChange?: (value: string) => void;
  onImageChange?: (file: File | null) => void;
  onImageUrlChange?: (url: string) => void;
  lang?: 'ko' | 'en';
}

export default function QuizFormImage({
  question,
  answer,
  explanation = '',
  imageUrl,
  onQuestionChange,
  onAnswerChange,
  onExplanationChange,
  onImageChange,
  onImageUrlChange,
  lang = 'ko',
}: QuizFormImageProps) {
  return (
    <>
      {/* 이미지 업로드 (필수) */}
      {onImageChange && (
        <ImageUpload
          imageUrl={imageUrl}
          onImageChange={onImageChange}
          onImageUrlChange={onImageUrlChange}
          lang={lang}
        />
      )}

      {/* 질문 */}
      <div>
        <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
          <i className="ri-question-line mr-1"></i>
          {lang === 'ko' ? '질문 (선택사항)' : 'Question (Optional)'}
        </label>
        <textarea
          value={question}
          onChange={(e) => onQuestionChange(e.target.value)}
          placeholder={lang === 'ko' ? '예: 이 장소는 어디일까요?' : 'Example: Where is this place?'}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent h-24 resize-none text-sm"
          maxLength={300}
        />
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
          placeholder={lang === 'ko' ? '정답을 입력하세요' : 'Enter the answer'}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
          maxLength={200}
        />
      </div>

      {/* 설명 */}
      {onExplanationChange && (
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
      )}
    </>
  );
}

