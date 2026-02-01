'use client';

import { QuizType, QUIZ_TYPE_METADATA, MULTIPLAYER_QUIZ_TYPES } from '@/lib/types/quiz';

interface QuizTypeSelectorMultiplayerProps {
  selectedType: QuizType | null;
  onSelect: (type: QuizType) => void;
  lang?: 'ko' | 'en';
  disabled?: boolean;
}

export default function QuizTypeSelectorMultiplayer({
  selectedType,
  onSelect,
  lang = 'ko',
  disabled = false,
}: QuizTypeSelectorMultiplayerProps) {
  return (
    <div className="space-y-4">
      <label className="block text-xs sm:text-sm font-medium mb-3 text-slate-300">
        <i className="ri-group-line mr-1"></i>
        {lang === 'ko' ? '멀티플레이 게임 유형' : 'Multiplayer Game Type'}
      </label>
      <div className={`grid ${MULTIPLAYER_QUIZ_TYPES.length === 2 ? 'grid-cols-2' : 'grid-cols-3'} gap-3`}>
        {MULTIPLAYER_QUIZ_TYPES.map((type) => {
          const metadata = QUIZ_TYPE_METADATA[type];
          const isSelected = selectedType === type;
          
          return (
            <button
              key={type}
              type="button"
              onClick={() => !disabled && onSelect(type)}
              disabled={disabled}
              className={`
                relative p-4 rounded-xl border-2 transition-all
                ${isSelected
                  ? 'border-teal-500 bg-teal-500/10 shadow-lg shadow-teal-500/20'
                  : 'border-slate-700 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <div className="text-center">
                <div className={`text-2xl sm:text-3xl mb-2 ${isSelected ? 'text-teal-400' : 'text-slate-400'}`}>
                  {type === 'soup' && <i className="ri-bowl-line"></i>}
                  {type === 'liar' && <i className="ri-user-unfollow-line"></i>}
                  {type === 'mafia' && <i className="ri-sword-line"></i>}
                  {type === 'chat' && <i className="ri-chat-3-line"></i>}
                </div>
                <div className={`text-xs sm:text-sm font-semibold ${isSelected ? 'text-teal-300' : 'text-slate-300'}`}>
                  {lang === 'ko' ? metadata.name : metadata.nameEn}
                </div>
                {type === 'mafia' && (
                  <div className="mt-1">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                      <i className="ri-time-line text-xs"></i>
                      {lang === 'ko' ? '준비중' : 'Preparing'}
                    </span>
                  </div>
                )}
                {isSelected && (
                  <div className="absolute top-1 right-1">
                    <i className="ri-checkbox-circle-fill text-teal-500"></i>
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

