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
    locale === 'ko' ? '방 목록 - 멀티플레이 방 만들기/참가' : 'Rooms - Create or Join Multiplayer';
  const description =
    locale === 'ko'
      ? '바다거북스프·라이어·마피아 등 멀티플레이 방을 만들거나 참가하세요. 친구와 함께 실시간으로 플레이할 수 있습니다.'
      : 'Create or join multiplayer rooms for turtle soup, liar, mafia. Play in real time with friends.';
  const keywords =
    locale === 'ko' ? ['멀티플레이 방', '바다거북스프 방', '실시간 퀴즈'] : ['multiplayer rooms', 'turtle soup room', 'live quiz'];

  return buildMetadata({
    title,
    description,
    path: `/${locale}/rooms`,
    locale,
    keywords,
  });
}
