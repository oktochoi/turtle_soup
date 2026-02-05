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
    locale === 'ko' ? '게임 선택 - 바다거북스프·맞추기' : 'Select Game - Turtle Soup & Guess';
  const description =
    locale === 'ko'
      ? '바다거북스프 문제 풀기 또는 맞추기 게임을 선택하세요. 퀴즈와 추리 게임을 즐길 수 있습니다.'
      : 'Choose to solve turtle soup problems or play the guess game. Enjoy quizzes and deduction games.';
  const keywords =
    locale === 'ko' ? ['게임 선택', '바다거북스프', '맞추기 게임'] : ['select game', 'turtle soup', 'guess game'];

  return buildMetadata({
    title,
    description,
    path: `/${locale}/play`,
    locale,
    keywords,
  });
}
