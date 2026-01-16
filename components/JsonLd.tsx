'use client';

import { useEffect } from 'react';

interface JsonLdProps {
  data: Record<string, any>;
}

export default function JsonLd({ data }: JsonLdProps) {
  useEffect(() => {
    // 기존 JSON-LD 스크립트 제거 (중복 방지)
    const existingScript = document.querySelector('script[type="application/ld+json"]');
    if (existingScript && existingScript.textContent === JSON.stringify(data)) {
      return;
    }

    // 새 JSON-LD 스크립트 추가
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);

    return () => {
      // 컴포넌트 언마운트 시 스크립트 제거
      const scriptToRemove = document.querySelector(
        `script[type="application/ld+json"][data-component="jsonld"]`
      );
      if (scriptToRemove) {
        scriptToRemove.remove();
      }
    };
  }, [data]);

  return null;
}

