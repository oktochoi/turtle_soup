'use client';

interface QuizFormReasoningProps {
  story: string;
  truth: string;
  hints: string[];
  onStoryChange: (value: string) => void;
  onTruthChange: (value: string) => void;
  onHintsChange: (hints: string[]) => void;
  lang?: 'ko' | 'en';
}

export default function QuizFormReasoning({
  story,
  truth,
  hints,
  onStoryChange,
  onTruthChange,
  onHintsChange,
  lang = 'ko',
}: QuizFormReasoningProps) {
  const handleHintChange = (index: number, value: string) => {
    const newHints = [...hints];
    newHints[index] = value;
    onHintsChange(newHints);
  };

  return (
    <>
      {/* 상황/이야기 */}
      <div>
        <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
          <i className="ri-book-open-line mr-1"></i>
          {lang === 'ko' ? '상황/이야기' : 'Situation/Story'}
          <span className="text-red-400 ml-1">*</span>
        </label>
        <textarea
          value={story}
          onChange={(e) => onStoryChange(e.target.value)}
          placeholder={lang === 'ko' ? '상황이나 이야기를 입력하세요' : 'Enter the situation or story'}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent h-40 resize-none text-sm"
          maxLength={2000}
        />
        <div className="text-right text-xs text-slate-500 mt-1">
          {story.length} / 2000
        </div>
      </div>

      {/* 진실/정답 */}
      <div>
        <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
          <i className="ri-checkbox-circle-line mr-1"></i>
          {lang === 'ko' ? '진실/정답' : 'Truth/Answer'}
          <span className="text-red-400 ml-1">*</span>
        </label>
        <textarea
          value={truth}
          onChange={(e) => onTruthChange(e.target.value)}
          placeholder={lang === 'ko' ? '진실이나 정답을 입력하세요' : 'Enter the truth or answer'}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent h-40 resize-none text-sm"
          maxLength={2000}
        />
        <div className="text-right text-xs text-slate-500 mt-1">
          {truth.length} / 2000
        </div>
      </div>

      {/* 힌트 (선택사항, 최대 3개) */}
      <div>
        <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
          <i className="ri-lightbulb-line mr-1"></i>
          {lang === 'ko' ? '힌트 (선택사항, 최대 3개)' : 'Hints (Optional, up to 3)'}
        </label>
        <div className="space-y-2">
          {hints.map((hint, index) => (
            <input
              key={index}
              type="text"
              value={hint}
              onChange={(e) => handleHintChange(index, e.target.value)}
              placeholder={lang === 'ko' ? `힌트 ${index + 1}` : `Hint ${index + 1}`}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
              maxLength={200}
            />
          ))}
        </div>
      </div>
    </>
  );
}

