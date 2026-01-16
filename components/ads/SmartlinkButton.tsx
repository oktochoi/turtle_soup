'use client';

import { useState } from 'react';
import { adConfig, isAdsEnabled } from './adConfig';

interface SmartlinkButtonProps {
  /**
   * 버튼 텍스트
   * @default "후원하기"
   */
  label?: string;
  
  /**
   * 버튼 스타일 (primary, secondary, outline)
   * @default "outline"
   */
  variant?: 'primary' | 'secondary' | 'outline';
  
  /**
   * 추가 클래스명
   */
  className?: string;
  
  /**
   * 클릭 시 새 창에서 열기
   * @default true
   */
  openInNewTab?: boolean;
}

/**
 * 스마트링크 버튼 컴포넌트
 * 사용자가 직접 클릭할 때만 링크가 열리는 선택형 UI
 */
export default function SmartlinkButton({
  label = '후원하기',
  variant = 'outline',
  className = '',
  openInNewTab = true,
}: SmartlinkButtonProps) {
  const [isClicked, setIsClicked] = useState(false);

  if (!isAdsEnabled() || !adConfig.smartlink.enabled) {
    return null;
  }

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setIsClicked(true);
    
    if (openInNewTab) {
      window.open(adConfig.smartlink.url, '_blank', 'noopener,noreferrer');
    } else {
      window.location.href = adConfig.smartlink.url;
    }
  };

  const variantStyles = {
    primary: 'bg-teal-500 hover:bg-teal-600 text-white border-teal-500',
    secondary: 'bg-slate-700 hover:bg-slate-600 text-white border-slate-700',
    outline: 'bg-transparent hover:bg-slate-800 text-slate-300 border-slate-600 hover:border-slate-500',
  };

  return (
    <a
      href={adConfig.smartlink.url}
      onClick={handleClick}
      target={openInNewTab ? '_blank' : undefined}
      rel={openInNewTab ? 'noopener noreferrer' : undefined}
      className={`
        inline-flex items-center justify-center
        px-4 py-2 rounded-lg
        border transition-all duration-200
        text-sm font-medium
        ${variantStyles[variant]}
        ${className}
        ${isClicked ? 'opacity-75' : ''}
      `}
      aria-label={label}
    >
      <span className="mr-2">{label}</span>
      <i className="ri-external-link-line text-xs"></i>
    </a>
  );
}

