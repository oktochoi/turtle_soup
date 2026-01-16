'use client';

import ImageUpload from './ImageUpload';

interface QuizFormLogicProps {
  question: string;
  content: string; // 조건/규칙 설명
  answer: string;
  explanation?: string;
  imageUrl?: string;
  onQuestionChange: (value: string) => void;
  onContentChange: (value: string) => void;
  onAnswerChange: (value: string) => void;
  onExplanationChange?: (value: string) => void;
  onImageChange?: (file: File | null) => void;
  onImageUrlChange?: (url: string) => void;
  lang?: 'ko' | 'en';
}

export default function QuizFormLogic({
  question,
  content,
  answer,
  explanation = '',
  imageUrl,
  onQuestionChange,
  onContentChange,
  onAnswerChange,
  onExplanationChange,
  onImageChange,
  onImageUrlChange,
  lang = 'ko',
}: QuizFormLogicProps) {
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

      {/* 질문 */}
      <div>
        <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
          <i className="ri-question-line mr-1"></i>
          {lang === 'ko' ? '질문' : 'Question'}
        </label>
        <textarea
          value={question}
          onChange={(e) => onQuestionChange(e.target.value)}
          placeholder={lang === 'ko' ? '논리 퍼즐 질문을 입력하세요' : 'Enter the logic puzzle question'}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent h-24 resize-none text-sm"
          maxLength={300}
        />
      </div>

      {/* 조건/규칙 설명 */}
      <div>
        <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
          <i className="ri-brain-line mr-1"></i>
          {lang === 'ko' ? '조건/규칙 설명' : 'Conditions/Rules'}
        </label>
        <textarea
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          placeholder={lang === 'ko' ? '논리 퍼즐의 조건과 규칙을 자세히 설명하세요' : 'Describe the conditions and rules of the logic puzzle in detail'}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent h-40 resize-none text-sm"
          maxLength={1000}
        />
        <div className="text-right text-xs text-slate-500 mt-1">
          {content.length} / 1000
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
            {lang === 'ko' ? '해설 (선택사항)' : 'Explanation (Optional)'}
          </label>
          <textarea
            value={explanation}
            onChange={(e) => onExplanationChange(e.target.value)}
            placeholder={lang === 'ko' ? '정답을 도출하는 과정과 설명을 입력하세요' : 'Enter the process and explanation for deriving the answer'}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent h-32 resize-none text-sm"
            maxLength={500}
          />
        </div>
      )}
    </>
  );
}

