'use client';

import { useState } from 'react';

interface QuizFormPollProps {
  question: string;
  options: string[];
  onQuestionChange: (value: string) => void;
  onOptionsChange: (options: string[]) => void;
  lang?: 'ko' | 'en';
}

export default function QuizFormPoll({
  question,
  options,
  onQuestionChange,
  onOptionsChange,
  lang = 'ko',
}: QuizFormPollProps) {
  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    onOptionsChange(newOptions);
  };

  const handleAddOption = () => {
    if (options.length < 10) {
      onOptionsChange([...options, '']);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      const newOptions = options.filter((_, i) => i !== index);
      onOptionsChange(newOptions);
    }
  };

  return (
    <>
      {/* 질문 (선택사항) */}
      <div>
        <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
          <i className="ri-question-line mr-1"></i>
          {lang === 'ko' ? '질문 (선택사항)' : 'Question (Optional)'}
        </label>
        <textarea
          value={question}
          onChange={(e) => onQuestionChange(e.target.value)}
          placeholder={lang === 'ko' ? '투표 질문을 입력하세요 (선택사항)' : 'Enter the poll question (optional)'}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent h-24 resize-none text-sm"
          maxLength={300}
        />
      </div>

      {/* 선택지 (최소 2개, 최대 10개) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs sm:text-sm font-medium text-slate-300">
            <i className="ri-list-check mr-1"></i>
            {lang === 'ko' ? '선택지 (최소 2개, 최대 10개)' : 'Options (Minimum 2, Maximum 10)'}
            <span className="text-red-400 ml-1">*</span>
          </label>
          {options.length < 10 && (
            <button
              type="button"
              onClick={handleAddOption}
              className="text-xs bg-teal-500 hover:bg-teal-600 text-white px-3 py-1 rounded-lg transition-colors"
            >
              <i className="ri-add-line mr-1"></i>
              {lang === 'ko' ? '추가' : 'Add'}
            </button>
          )}
        </div>
        <div className="space-y-2">
          {options.map((option, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="text-xs text-slate-400 w-6">{index + 1}.</span>
              <input
                type="text"
                value={option}
                onChange={(e) => handleOptionChange(index, e.target.value)}
                placeholder={lang === 'ko' ? `선택지 ${index + 1}` : `Option ${index + 1}`}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                maxLength={200}
              />
              {options.length > 2 && (
                <button
                  type="button"
                  onClick={() => handleRemoveOption(index)}
                  className="text-red-400 hover:text-red-300"
                >
                  <i className="ri-delete-bin-line"></i>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

