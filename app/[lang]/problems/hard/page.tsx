import { Metadata } from 'next';
import { generateMetadata as buildMetadata } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';
import ProblemsListClient from '../components/ProblemsListClient';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const locale = 'ko';

  const title = '어려운 바다거북스프 문제 모음 | 고난도 추리 문제';
  const description = '난이도 최상! 도전적인 바다거북스프 문제를 풀어보세요.';
  const keywords = ['바다거북스프', '어려운 문제', '고난도 추리', '추리 퀴즈', '수평적 사고'];

  return buildMetadata({ title, description, path: `/${locale}/problems/hard`, locale, keywords });
}

export default async function HardPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const locale = 'ko';
  const supabase = await createClient();

  const { data: problems } = await supabase
    .from('problems')
    .select('id, title, content, difficulty, tags, like_count, view_count, comment_count, created_at')
    .eq('lang', locale)
    .in('status', ['published', 'featured'])
    .eq('difficulty', 'hard')
    .order('like_count', { ascending: false })
    .limit(50);

  const h1 = '어려운 바다거북스프 문제';
  const intro = '난이도 최상! 도전적인 바다거북스프 문제를 풀어보세요.';

  return (
    <div className="min-h-screen text-bone">
      <div className="page-shell max-w-4xl py-10">
        <h1 className="font-display text-3xl mb-3 text-bone">{h1}</h1>
        <p className="text-fog mb-8">{intro}</p>
        <ProblemsListClient problems={problems || []} lang={locale} />
      </div>
    </div>
  );
}
