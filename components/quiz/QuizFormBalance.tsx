'use client';

interface QuizFormBalanceProps {
  question: string; // 설명 (선택사항)
  options: string[]; // 2개 이상
  showStats?: boolean;
  imageUrl?: string;
  onQuestionChange: (value: string) => void;
  onOptionsChange: (options: string[]) => void;
  onImageChange?: (file: File | null) => void;
  onImageUrlChange?: (url: string) => void;
  lang?: 'ko' | 'en';
}

export default function QuizFormBalance({
  question,
  options,
  showStats = true,
  imageUrl,
  onQuestionChange,
  onOptionsChange,
  onImageChange,
  onImageUrlChange,
  lang = 'ko',
}: QuizFormBalanceProps) {
  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    onOptionsChange(newOptions);
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
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && onImageChange) {
                  onImageChange(file);
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    const result = reader.result as string;
                    if (onImageUrlChange) {
                      onImageUrlChange(result);
                    }
                  };
                  reader.readAsDataURL(file);
                }
              }}
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

      {/* 설명 (선택사항) */}
      <div>
        <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
          <i className="ri-file-text-line mr-1"></i>
          {lang === 'ko' ? '설명 (선택사항)' : 'Description (Optional)'}
        </label>
        <textarea
          value={question}
          onChange={(e) => onQuestionChange(e.target.value)}
          placeholder={lang === 'ko' ? '추가 설명을 입력하세요 (선택사항)' : 'Enter additional description (optional)'}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent h-24 resize-none text-sm"
          maxLength={500}
        />
      </div>

      {/* 선택지 (2개 이상) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs sm:text-sm font-medium text-slate-300">
            <i className="ri-scales-line mr-1"></i>
            {lang === 'ko' ? '선택지 (최소 2개)' : 'Options (minimum 2)'}
          </label>
          <button
            type="button"
            onClick={() => {
              if (options.length < 10) {
                onOptionsChange([...options, '']);
              }
            }}
            className="text-xs px-3 py-1 bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-all flex items-center gap-1"
          >
            <i className="ri-add-line"></i>
            {lang === 'ko' ? '추가' : 'Add'}
          </button>
        </div>
        <div className="space-y-2">
          {options.map((option, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="text"
                value={option}
                onChange={(e) => handleOptionChange(index, e.target.value)}
                placeholder={lang === 'ko' ? `선택지 ${String.fromCharCode(65 + index)}` : `Option ${String.fromCharCode(65 + index)}`}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                maxLength={200}
              />
              {options.length > 2 && (
                <button
                  type="button"
                  onClick={() => {
                    const newOptions = options.filter((_, i) => i !== index);
                    onOptionsChange(newOptions);
                  }}
                  className="px-3 py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-all"
                  title={lang === 'ko' ? '삭제' : 'Delete'}
                >
                  <i className="ri-delete-bin-line"></i>
                </button>
              )}
            </div>
          ))}
        </div>
        {options.length < 2 && (
          <p className="text-xs text-red-400 mt-1">
            {lang === 'ko' ? '최소 2개의 선택지가 필요합니다.' : 'At least 2 options are required.'}
          </p>
        )}
      </div>
    </>
  );
}

