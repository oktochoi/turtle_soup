'use client';
import { useState } from 'react';

interface QuizFormOrderProps {
  question: string;
  items: string[]; // 순서를 맞춰야 할 항목들
  correctOrder: number[]; // 올바른 순서 (인덱스 배열)
  explanation?: string;
  imageUrl?: string;
  onQuestionChange: (value: string) => void;
  onItemsChange: (items: string[]) => void;
  onCorrectOrderChange: (order: number[]) => void;
  onExplanationChange?: (value: string) => void;
  onImageChange?: (file: File | null) => void;
  lang?: 'ko' | 'en';
}

export default function QuizFormOrder({
  question,
  items,
  correctOrder,
  explanation = '',
  imageUrl,
  onQuestionChange,
  onItemsChange,
  onCorrectOrderChange,
  onExplanationChange,
  onImageChange,
  lang = 'ko',
}: QuizFormOrderProps) {
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImageChange) {
      onImageChange(file);
    }
  };

  const handleAddItem = () => {
    onItemsChange([...items, '']);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    onItemsChange(newItems);
    // correctOrder도 업데이트
    const newOrder = correctOrder
      .map((orderIdx) => orderIdx > index ? orderIdx - 1 : orderIdx)
      .filter((orderIdx) => orderIdx !== index);
    onCorrectOrderChange(newOrder);
  };

  const handleItemChange = (index: number, value: string) => {
    const newItems = [...items];
    newItems[index] = value;
    onItemsChange(newItems);
  };

  const handleOrderChange = (index: number, value: number) => {
    const newOrder = [...correctOrder];
    newOrder[index] = value;
    onCorrectOrderChange(newOrder);
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

      {/* 질문 */}
      <div>
        <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
          <i className="ri-question-line mr-1"></i>
          {lang === 'ko' ? '질문' : 'Question'}
        </label>
        <textarea
          value={question}
          onChange={(e) => onQuestionChange(e.target.value)}
          placeholder={lang === 'ko' ? '순서를 맞춰야 할 질문을 입력하세요' : 'Enter the question for ordering'}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent h-24 resize-none text-sm"
          maxLength={300}
        />
      </div>

      {/* 항목들 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs sm:text-sm font-medium text-slate-300">
            <i className="ri-list-ordered mr-1"></i>
            {lang === 'ko' ? '항목들 (최소 2개)' : 'Items (Minimum 2)'}
          </label>
          <button
            type="button"
            onClick={handleAddItem}
            className="text-xs bg-teal-500 hover:bg-teal-600 text-white px-3 py-1 rounded-lg transition-colors"
          >
            <i className="ri-add-line mr-1"></i>
            {lang === 'ko' ? '추가' : 'Add'}
          </button>
        </div>
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="text-xs text-slate-400 w-8">{index + 1}.</span>
              <input
                type="text"
                value={item}
                onChange={(e) => handleItemChange(index, e.target.value)}
                placeholder={lang === 'ko' ? `항목 ${index + 1}` : `Item ${index + 1}`}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                maxLength={200}
              />
              <input
                type="number"
                min="1"
                max={items.length}
                value={correctOrder[index] !== undefined ? correctOrder[index] + 1 : ''}
                onChange={(e) => {
                  const order = parseInt(e.target.value) - 1;
                  if (!isNaN(order) && order >= 0 && order < items.length) {
                    handleOrderChange(index, order);
                  }
                }}
                placeholder="순서"
                className="w-16 bg-slate-800 border border-slate-700 rounded-lg px-2 py-2.5 text-white text-center text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              {items.length > 2 && (
                <button
                  type="button"
                  onClick={() => handleRemoveItem(index)}
                  className="text-red-400 hover:text-red-300"
                >
                  <i className="ri-delete-bin-line"></i>
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-2">
          {lang === 'ko' 
            ? '각 항목의 올바른 순서를 숫자로 입력하세요 (1부터 시작)'
            : 'Enter the correct order for each item as a number (starting from 1)'}
        </p>
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
            placeholder={lang === 'ko' ? '순서의 이유와 설명을 입력하세요' : 'Enter the explanation for the order'}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent h-24 resize-none text-sm"
            maxLength={300}
          />
        </div>
      )}
    </>
  );
}

