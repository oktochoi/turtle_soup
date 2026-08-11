import type { Metadata } from 'next';
import { generateMetadata as buildMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: '게임 시작 | 바다거북스프 추리 퀴즈',
    description: '바다거북스프 문제를 직접 풀어보세요. 다양한 추리 퀴즈를 즐길 수 있습니다.',
    path: '/ko/play',
    keywords: ['바다거북스프 플레이', '추리 퀴즈 게임'],
  });
}

export default function PlayLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
