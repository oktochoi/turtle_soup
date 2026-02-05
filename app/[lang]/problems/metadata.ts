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
      ? '문제 목록 - 최신/인기 바다거북스프 모음'
      : 'Problem List - Latest & Popular Turtle Soup Riddles';
  const description =
    locale === 'ko'
      ? '바다거북스프와 다양한 퀴즈를 최신순·인기순으로 모아보세요. 난이도, 유형, 태그로 필터링 가능.'
      : 'Browse turtle soup riddles and quizzes by latest and popular. Filter by difficulty, type, and tags.';
  const keywords =
    locale === 'ko'
      ? ['바다거북스프 문제', '추리 퀴즈 목록', '인기 퀴즈', '난이도별 퀴즈']
      : ['turtle soup riddles', 'logic puzzle list', 'popular puzzles', 'difficulty filter'];

  return buildMetadata({
    title,
    description,
    path: `/${locale}/problems`,
    locale,
    keywords,
  });
}

