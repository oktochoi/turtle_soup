import type { Metadata } from "next";
import { Geist, Geist_Mono, Pacifico } from "next/font/google";
import "./globals.css";

const pacifico = Pacifico({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  variable: '--font-pacifico',
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

// 루트 레이아웃 - middleware가 /를 /ko로 리다이렉트하므로 여기는 거의 사용되지 않음
// 실제 레이아웃은 app/[lang]/layout.tsx에서 처리됨
// 하지만 Next.js는 루트 레이아웃에 <html>과 <body> 태그를 요구함

export const metadata: Metadata = {
  title: "바다거북스프",
  description: "바다거북스프, 밸런스게임, 라이어, 마피아게임, 퀴즈와 추리 게임을 즐기는 퀴즈 플랫폼",
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
        {/* GSC/GA4 placeholders: 실제 ID로 교체 시 측정 신호 활성화 */}
        <meta name="google-site-verification" content="GSC_VERIFICATION_TOKEN" />
        <script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'GA_MEASUREMENT_ID');
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${pacifico.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
