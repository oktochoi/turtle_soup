import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '새 방 만들기',
  description: '바다거북스프 게임 방을 만들고 친구들과 함께 추리 게임을 즐기세요. 관리자로 게임을 시작하고 이야기와 진실을 설정하세요.',
  openGraph: {
    title: '새 방 만들기 | 바다거북스프게임',
    description: '바다거북스프 게임 방을 만들고 친구들과 함께 추리 게임을 즐기세요.',
    url: '/create-room',
  },
};

export default function CreateRoomLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

