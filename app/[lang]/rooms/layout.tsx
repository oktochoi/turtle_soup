import type { Metadata } from 'next';
import { generateMetadata as buildMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: '멀티플레이 방 목록 | 바다거북스프 실시간 추리',
    description: '바다거북스프 멀티플레이 방을 만들거나 참가하세요. 친구와 함께 실시간으로 추리 게임을 즐길 수 있습니다.',
    path: '/ko/rooms',
    keywords: ['바다거북스프 멀티플레이', '실시간 추리 게임', '바다거북스프 방'],
  });
}

export default function RoomsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
