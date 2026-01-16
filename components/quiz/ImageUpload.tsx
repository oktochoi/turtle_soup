'use client';

import { useState } from 'react';

interface ImageUploadProps {
  imageUrl?: string;
  onImageChange: (file: File | null) => void;
  onImageUrlChange?: (url: string) => void;
  lang?: 'ko' | 'en';
  maxSizeMB?: number;
}

export default function ImageUpload({
  imageUrl,
  onImageChange,
  onImageUrlChange,
  lang = 'ko',
  maxSizeMB = 5,
}: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(imageUrl || null);
  const [error, setError] = useState<string>('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      onImageChange(null);
      setPreview(null);
      return;
    }

    // 파일 크기 체크
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(lang === 'ko' ? `이미지 크기는 ${maxSizeMB}MB 이하여야 합니다.` : `Image size must be less than ${maxSizeMB}MB.`);
      return;
    }

    // 이미지 타입 체크
    if (!file.type.startsWith('image/')) {
      setError(lang === 'ko' ? '이미지 파일만 업로드 가능합니다.' : 'Only image files are allowed.');
      return;
    }

    setError('');
    onImageChange(file);

    // 미리보기 생성
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setPreview(result);
      if (onImageUrlChange) {
        onImageUrlChange(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemove = () => {
    onImageChange(null);
    setPreview(null);
    setError('');
    if (onImageUrlChange) {
      onImageUrlChange('');
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
        <i className="ri-image-line mr-1"></i>
        {lang === 'ko' ? '이미지 (선택사항)' : 'Image (Optional)'}
      </label>
      <div className="space-y-2">
        <input
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-teal-500 file:text-white hover:file:bg-teal-600"
        />
        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}
        {preview && (
          <div className="relative w-full h-48 bg-slate-900 rounded-xl overflow-hidden border border-slate-700">
            <img src={preview} alt="Preview" className="w-full h-full object-contain" />
            <button
              type="button"
              onClick={handleRemove}
              className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-2 transition-colors"
            >
              <i className="ri-close-line"></i>
            </button>
          </div>
        )}
        <p className="text-xs text-slate-400">
          {lang === 'ko' 
            ? `이미지 크기는 최대 ${maxSizeMB}MB입니다.`
            : `Maximum image size is ${maxSizeMB}MB.`}
        </p>
      </div>
    </div>
  );
}

