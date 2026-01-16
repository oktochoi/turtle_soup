import type { Metadata } from "next";
import { Geist, Geist_Mono, Pacifico } from "next/font/google";
import "./globals.css";

const pacifico = Pacifico({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-pacifico',
})

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 루트 레이아웃 - middleware가 /를 /ko로 리다이렉트하므로 여기는 거의 사용되지 않음
// 실제 레이아웃은 app/[lang]/layout.tsx에서 처리됨
// 하지만 Next.js는 루트 레이아웃에 <html>과 <body> 태그를 요구함

export const metadata: Metadata = {
  title: "퀴즈 천국",
  description: "다양한 퀴즈와 추리 게임을 즐기는 퀴즈 플랫폼",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning={true}>
      <head>
        <meta name="google-adsense-account" content="ca-pub-4462339094246168" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${pacifico.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
