'use client';

interface QuizFormMCQProps {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
  onQuestionChange: (value: string) => void;
  onOptionsChange: (options: string[]) => void;
  onCorrectChange: (index: number) => void;
  onExplanationChange: (value: string) => void;
  lang?: 'ko' | 'en';
}

export default function QuizFormMCQ({
  question,
  options,
  correct,
  explanation,
  onQuestionChange,
  onOptionsChange,
  onCorrectChange,
  onExplanationChange,
  lang = 'ko',
}: QuizFormMCQProps) {
  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    onOptionsChange(newOptions);
  };

  return (
    <>
      {/* 질문 */}
      <div>
        <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
          <i className="ri-question-line mr-1"></i>
          {lang === 'ko' ? '질문' : 'Question'}
        </label>
        <textarea
          value={question}
          onChange={(e) => onQuestionChange(e.target.value)}
          placeholder={lang === 'ko' ? '객관식 질문을 입력하세요' : 'Enter the multiple choice question'}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent h-24 resize-none text-sm"
          maxLength={300}
        />
      </div>

      {/* 선택지 (4개) */}
      <div>
        <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
          <i className="ri-list-check mr-1"></i>
          {lang === 'ko' ? '선택지 (4개)' : 'Options (4)'}
        </label>
        <div className="space-y-2">
          {options.map((option, index) => (
            <div key={index} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onCorrectChange(index)}
                className={`
                  flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center
                  ${correct === index
                    ? 'border-teal-500 bg-teal-500'
                    : 'border-slate-600 bg-slate-800'
                  }
                `}
              >
                {correct === index && <i className="ri-check-line text-white text-xs"></i>}
              </button>
              <input
                type="text"
                value={option}
                onChange={(e) => handleOptionChange(index, e.target.value)}
                placeholder={lang === 'ko' ? `선택지 ${index + 1}` : `Option ${index + 1}`}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                maxLength={200}
              />
            </div>
          ))}
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

