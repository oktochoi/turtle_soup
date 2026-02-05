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
    locale === 'ko' ? '랭킹 - 퀴즈 정답률 순위' : 'Ranking - Quiz Accuracy Leaderboard';
  const description =
    locale === 'ko'
      ? '바다거북스프와 퀴즈 정답률 순위를 확인하세요. 상위 랭커와 나의 순위를 비교할 수 있습니다.'
      : 'Check turtle soup and quiz accuracy rankings. Compare top players and your rank.';
  const keywords =
    locale === 'ko' ? ['퀴즈 랭킹', '정답률 순위', '바다거북스프 순위'] : ['quiz ranking', 'accuracy leaderboard', 'turtle soup rank'];

  return buildMetadata({
    title,
    description,
    path: `/${locale}/ranking`,
    locale,
    keywords,
  });
}
