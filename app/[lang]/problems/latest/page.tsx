import { Metadata } from 'next';
import { generateMetadata as buildMetadata } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';
import ProblemsListClient from '../components/ProblemsListClient';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const locale = 'ko';

  const title = '최신 바다거북스프 문제 | 새로운 추리 문제 모음';
  const description = '방금 올라온 최신 바다거북스프 문제를 바로 풀어보세요.';
  const keywords = ['바다거북스프', '최신 문제', '새로운 추리', '추리 퀴즈', '신규 문제'];

  return buildMetadata({ title, description, path: `/${locale}/problems/latest`, locale, keywords });
}

export default async function LatestPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const locale = 'ko';
  const supabase = await createClient();

  const { data: problems } = await supabase
    .from('problems')
    .select('id, title, content, difficulty, tags, like_count, view_count, comment_count, created_at')
    .eq('lang', locale)
    .order('created_at', { ascending: false })
    .limit(50);

  const h1 = '최신 바다거북스프 문제';
  const intro = '방금 올라온 최신 바다거북스프 문제를 바로 풀어보세요.';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold mb-3 bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">{h1}</h1>
        <p className="text-slate-400 mb-8">{intro}</p>
        <ProblemsListClient problems={problems || []} lang={locale} />
      </div>
    </div>
  );
}
