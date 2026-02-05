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
      ? '튜토리얼 - 바다거북스프 플레이 방법'
      : 'Tutorial - How to Play Turtle Soup';
  const description =
    locale === 'ko'
      ? '바다거북스프 게임을 처음부터 끝까지 따라 할 수 있는 튜토리얼. 질문 예시, 정답 확인, 힌트 활용법 제공.'
      : 'Step-by-step tutorial for playing turtle soup riddles. Includes sample questions, answer checking, and hint usage.';
  const keywords =
    locale === 'ko'
      ? ['바다거북스프 튜토리얼', '퀴즈 플레이 방법', '추리 게임 예시']
      : ['turtle soup tutorial', 'quiz how to play', 'logic puzzle examples'];

  return buildMetadata({
    title,
    description,
    path: `/${locale}/tutorial`,
    locale,
    keywords,
  });
}

