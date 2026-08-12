'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import CaseCreateWizard from '@/components/case/CaseCreateWizard';

export default function CreateProblem({ params }: { params: Promise<{ lang: string }> }) {
  const resolvedParams = use(params);
  const lang = resolvedParams.lang || 'ko';
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [authorName, setAuthorName] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      alert('로그인이 필요합니다.');
      router.push(`/${lang}/auth/login`);
      return;
    }
    if (!authLoading && user) {
      (async () => {
        try {
          const supabase = createClient();
          const { data } = await supabase
            .from('users')
            .select('nickname')
            .eq('id', user.id)
            .maybeSingle();
          setAuthorName(data?.nickname || user.id.slice(0, 8));
        } catch {
          setAuthorName(user.id.slice(0, 8));
        } finally {
          setIsLoading(false);
        }
      })();
    }
  }, [user, authLoading, router, lang]);

  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-teal-400 border-t-transparent" />
          <p className="text-slate-400 text-sm">불러오는 중…</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen text-white">
      <div className="page-shell py-6 sm:py-10 max-w-3xl">
        <div className="mb-6">
          <Link href={`/${lang}`} className="text-sm text-slate-400 hover:text-white transition-colors">
            ← 돌아가기
          </Link>
        </div>

        <header className="mb-8">
          <p className="text-xs tracking-[0.22em] text-teal-300/80">CASE CREATE</p>
          <h1 className="mt-2 text-2xl sm:text-3xl font-semibold text-white">사건 만들기</h1>
          <p className="mt-2 text-sm text-slate-400">
            사건 상황과 진실만 작성하면 AI가 게임을 준비합니다. 키워드·단서를 따로 입력할 필요 없습니다.
          </p>
        </header>

        <CaseCreateWizard lang={lang} userId={user.id} authorName={authorName || user.id.slice(0, 8)} />
      </div>
    </div>
  );
}
