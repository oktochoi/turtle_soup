import { Metadata } from 'next';
import { generateMetadata as buildMetadata } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';
import ProblemsListClient from '../components/ProblemsListClient';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const locale = 'ko';

  const title = '공포 바다거북스프 문제 모음 | 무서운 추리 문제';
  const description = '소름 돋는 공포·반전 바다거북스프 문제를 모았습니다.';
  const keywords = ['바다거북스프', '공포 문제', '무서운 추리', '반전 문제', '호러 퀴즈'];

  return buildMetadata({ title, description, path: `/${locale}/problems/scary`, locale, keywords });
}

export default async function ScaryPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const locale = 'ko';
  const supabase = await createClient();

  const { data: problems } = await supabase
    .from('problems')
    .select('id, title, content, difficulty, tags, like_count, view_count, comment_count, created_at')
    .eq('lang', locale)
    .overlaps('tags', ['공포', '무서운', '반전', 'horror', 'scary'])
    .order('like_count', { ascending: false })
    .limit(50);

  const h1 = '공포·반전 바다거북스프 문제';
  const intro = '소름 돋는 공포·반전 바다거북스프 문제를 모았습니다.';

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
