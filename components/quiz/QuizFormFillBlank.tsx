'use client';

interface QuizFormFillBlankProps {
  question: string; // 빈칸이 포함된 질문 (예: "나는 ___을 좋아한다")
  answer: string; // 정답
  explanation?: string;
  imageUrl?: string;
  onQuestionChange: (value: string) => void;
  onAnswerChange: (value: string) => void;
  onExplanationChange?: (value: string) => void;
  onImageChange?: (file: File | null) => void;
  lang?: 'ko' | 'en';
}

export default function QuizFormFillBlank({
  question,
  answer,
  explanation = '',
  imageUrl,
  onQuestionChange,
  onAnswerChange,
  onExplanationChange,
  onImageChange,
  lang = 'ko',
}: QuizFormFillBlankProps) {
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImageChange) {
      onImageChange(file);
    }
  };

  return (
    <>
      {/* 이미지 업로드 */}
      {onImageChange && (
        <div>
          <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
            <i className="ri-image-line mr-1"></i>
            {lang === 'ko' ? '이미지 (선택사항)' : 'Image (Optional)'}
          </label>
          <div className="space-y-2">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-teal-500 file:text-white hover:file:bg-teal-600"
            />
            {imageUrl && (
              <div className="relative w-full h-48 bg-slate-900 rounded-xl overflow-hidden">
                <img src={imageUrl} alt="Preview" className="w-full h-full object-contain" />
              </div>
            )}
          </div>
        </div>
      )}

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
          placeholder={lang === 'ko' ? '빈칸에 들어갈 정답을 입력하세요' : 'Enter the answer for the blank'}
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

