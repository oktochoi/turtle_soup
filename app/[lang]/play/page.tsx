'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

/** 게임 선택 허브 → 문제 목록으로 통합 */
export default function PlaySelectPage() {
  const params = useParams();
  const lang = (params?.lang as string) || 'ko';
  const router = useRouter();

  useEffect(() => {
    router.replace(`/${lang}/problems`);
  }, [lang, router]);

  return (
    <div className="min-h-screen bg-ink-800 text-white flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-400" />
    </div>
  );
}
