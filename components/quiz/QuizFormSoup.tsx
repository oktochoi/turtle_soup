'use client';

import ImageUpload from './ImageUpload';

interface QuizFormSoupProps {
  story: string;
  truth: string;
  hints: string[];
  imageUrl?: string;
  onStoryChange: (value: string) => void;
  onTruthChange: (value: string) => void;
  onHintsChange: (hints: string[]) => void;
  onImageChange?: (file: File | null) => void;
  onImageUrlChange?: (url: string) => void;
  lang?: 'ko' | 'en';
}

export default function QuizFormSoup({
  story,
  truth,
  hints,
  imageUrl,
  onStoryChange,
  onTruthChange,
  onHintsChange,
  onImageChange,
  onImageUrlChange,
  lang = 'ko',
}: QuizFormSoupProps) {
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

      {/* 표면 이야기 */}
      <div>
        <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
          <i className="ri-file-text-line mr-1"></i>
          {lang === 'ko' ? '표면 이야기' : 'Surface Story'}
        </label>
        <textarea
          value={story}
          onChange={(e) => onStoryChange(e.target.value)}
          placeholder={lang === 'ko' ? '문제의 배경과 상황을 설명해주세요' : 'Describe the background and situation of the problem'}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent h-32 resize-none text-sm"
          maxLength={500}
        />
        <div className="text-right text-xs text-slate-500 mt-1">
          {story.length} / 500
        </div>
      </div>

      {/* 진실 */}
      <div>
        <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
          <i className="ri-key-line mr-1"></i>
          {lang === 'ko' ? '진실' : 'Truth'}
        </label>
        <textarea
          value={truth}
          onChange={(e) => onTruthChange(e.target.value)}
          placeholder={lang === 'ko' ? '문제의 정답(진실)을 입력하세요' : 'Enter the answer (truth) to the problem'}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent h-40 resize-none text-sm"
          maxLength={500}
        />
        <div className="text-right text-xs text-slate-500 mt-1">
          {truth.length} / 500
        </div>
      </div>

      {/* 힌트 */}
      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
        <label className="block text-xs sm:text-sm font-medium mb-3 text-slate-300">
          <i className="ri-lightbulb-line mr-1 text-yellow-400"></i>
          {lang === 'ko' ? '힌트 (선택사항, 최대 3개)' : 'Hints (Optional, max 3)'}
        </label>
        <div className="space-y-2">
          {hints.map((hint, index) => (
            <input
              key={index}
              type="text"
              value={hint}
              onChange={(e) => {
                const newHints = [...hints];
                newHints[index] = e.target.value;
                onHintsChange(newHints);
              }}
              placeholder={lang === 'ko' ? `힌트 ${index + 1} (선택사항)` : `Hint ${index + 1} (optional)`}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 text-sm"
              maxLength={200}
            />
          ))}
        </div>
      </div>
    </>
  );
}

