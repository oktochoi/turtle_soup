'use client';

import { useState } from 'react';
import { useTranslations } from '@/hooks/useTranslations';

type QuestionInputProps = {
  onSubmit: (text: string) => void;
  disabled?: boolean;
};

export default function QuestionInput({ onSubmit, disabled = false }: QuestionInputProps) {
  const t = useTranslations();
  const [text, setText] = useState('');

  const handleSubmit = () => {
    if (text.trim() && !disabled) {
      onSubmit(text);
      setText('');
    }
  };

  return (
    <div className="bg-slate-800 rounded-xl p-3 sm:p-4 border border-slate-700">
      <div className="flex items-center gap-2 mb-2 sm:mb-3">
        <div className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center flex-shrink-0">
          <i className="ri-question-line text-cyan-400 text-sm sm:text-base"></i>
        </div>
        <h3 className="font-semibold text-xs sm:text-sm">{t.problem.question}</h3>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder={disabled ? t.room.questionLimitReached : t.room.enterQuestion}
          className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 sm:px-4 py-2 sm:py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          maxLength={200}
          disabled={disabled}
        />
        <button
          onClick={handleSubmit}
          disabled={!text.trim() || disabled}
          className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0"
        >
          <i className="ri-send-plane-fill text-sm sm:text-base"></i>
        </button>
      </div>
    </div>
  );
}
