'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';

export default function LangScript() {
  const params = useParams();
  const lang = (params?.lang as string) || 'ko';

  useEffect(() => {
    // 동적으로 html lang 속성 설정
    document.documentElement.lang = lang;
  }, [lang]);

  return null;
}

