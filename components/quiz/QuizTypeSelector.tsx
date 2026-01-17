'use client';

import { QuizType, QUIZ_TYPE_METADATA, SINGLE_PLAYER_PROBLEM_TYPES } from '@/lib/types/quiz';

interface QuizTypeSelectorProps {
  selectedType: QuizType | null;
  onSelect: (type: QuizType) => void;
  lang?: 'ko' | 'en';
  disabled?: boolean;
}

export default function QuizTypeSelector({
  selectedType,
  onSelect,
  lang = 'ko',
  disabled = false,
}: QuizTypeSelectorProps) {
  return (
    <div className="space-y-4">
      <label className="block text-xs sm:text-sm font-medium mb-3 text-slate-300">
        <i className="ri-file-question-line mr-1"></i>
        {lang === 'ko' ? '문제 유형' : 'Problem Type'}
      </label>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {SINGLE_PLAYER_PROBLEM_TYPES.map((type) => {
          const metadata = QUIZ_TYPE_METADATA[type];
          const isSelected = selectedType === type;
          
          return (
            <button
              key={type}
              type="button"
              onClick={() => !disabled && onSelect(type)}
              disabled={disabled}
              className={`
                relative p-3 sm:p-4 rounded-xl border-2 transition-all
                ${isSelected
                  ? 'border-teal-500 bg-teal-500/10 shadow-lg shadow-teal-500/20'
                  : 'border-slate-700 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <div className="text-center">
                <div className={`text-xl sm:text-2xl mb-1 sm:mb-2 ${isSelected ? 'text-teal-400' : 'text-slate-400'}`}>
                  {type === 'soup' && <i className="ri-bowl-line"></i>}
                  {type === 'reasoning' && <i className="ri-search-line"></i>}
                  {type === 'nonsense' && <i className="ri-lightbulb-flash-line"></i>}
                  {type === 'mcq' && <i className="ri-list-check"></i>}
                  {type === 'ox' && <i className="ri-checkbox-circle-line"></i>}
                  {type === 'image' && <i className="ri-image-line"></i>}
                  {type === 'poll' && <i className="ri-bar-chart-line"></i>}
                  {type === 'balance' && <i className="ri-scales-line"></i>}
                  {type === 'logic' && <i className="ri-brain-line"></i>}
                  {type === 'pattern' && <i className="ri-numbers-line"></i>}
                  {type === 'fill_blank' && <i className="ri-edit-line"></i>}
                  {type === 'order' && <i className="ri-list-ordered"></i>}
                </div>
                <div className={`text-xs font-semibold ${isSelected ? 'text-teal-300' : 'text-slate-300'}`}>
                  {lang === 'ko' ? metadata.name : metadata.nameEn}
                </div>
                {isSelected && (
                  <div className="absolute top-1 right-1">
                    <i className="ri-checkbox-circle-fill text-teal-500 text-xs"></i>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
      {selectedType && (
        <p className="text-xs text-slate-400 mt-2">
          {lang === 'ko' ? QUIZ_TYPE_METADATA[selectedType].description : QUIZ_TYPE_METADATA[selectedType].description}
        </p>
      )}
    </div>
  );
}

