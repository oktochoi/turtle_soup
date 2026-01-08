import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '게임 설명',
  description: '바다거북스프 게임의 규칙과 플레이 방법을 알아보세요.',
};

export default function TutorialLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

