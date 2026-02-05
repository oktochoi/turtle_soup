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
      ? '가이드 - 바다거북스프 & 퀴즈 플레이 방법'
      : 'Guide - How to Play Turtle Soup & Quizzes';
  const description =
    locale === 'ko'
      ? '바다거북스프, 멀티플레이 퀴즈, 룰과 진행 방법을 자세히 안내합니다. 초보도 쉽게 따라 할 수 있는 가이드.'
      : 'Learn how to play turtle soup and multiplayer quizzes with clear rules and steps. Beginner-friendly guide.';
  const keywords =
    locale === 'ko'
      ? ['바다거북스프 가이드', '퀴즈 플레이 방법', '추리 게임 룰', '초보자 가이드']
      : ['turtle soup guide', 'how to play quiz', 'logic puzzle rules', 'beginner guide'];

  return buildMetadata({
    title,
    description,
    path: `/${locale}/guide`,
    locale,
    keywords,
  });
}

