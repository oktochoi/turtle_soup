import { generateMetadata as buildMetadata, type Locale } from '@/lib/seo';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const locale: Locale = lang === 'en' ? 'en' : 'ko';
  const title =
    locale === 'ko'
      ? '커뮤니티 - 퀴즈 토론과 공유'
      : 'Community - Quiz Discussions & Sharing';
  const description =
    locale === 'ko'
      ? '퀴즈와 바다거북스프에 대한 토론, 팁, 해설을 공유하세요. 공지와 인기 글을 한곳에서 확인.'
      : 'Discuss and share turtle soup riddles, tips, and explanations. See notices and popular posts in one place.';
  const keywords =
    locale === 'ko'
      ? ['퀴즈 커뮤니티', '바다거북스프 토론', '퀴즈 해설 공유', '인기 글']
      : ['quiz community', 'turtle soup discussion', 'puzzle explanations', 'popular posts'];

  return buildMetadata({
    title,
    description,
    path: `/${locale}/community`,
    locale,
    keywords,
  });
}

