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

export const metadata: Metadata = {
  title: {
    default: "온라인 멀티 바다거북스프게임",
    template: "%s | 바다거북스프게임",
  },
  description: "추리와 질문으로 진실을 밝혀내는 온라인 멀티플레이어 바다거북스프 게임. 친구들과 함께 실시간으로 추리 게임을 즐기세요. 관리자가 이야기의 진실을 숨기고, 참여자들은 예/아니오 질문으로 진실을 찾아냅니다.",
  keywords: [
    "바다거북스프",
    "바다거북스프게임",
    "추리게임",
    "온라인게임",
    "멀티플레이어게임",
    "실시간게임",
    "질문게임",
    "추리",
    "게임",
    "온라인추리게임",
  ],
  authors: [{ name: "바다거북스프게임" }],
  creator: "바다거북스프게임",
  publisher: "바다거북스프게임",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://turtle-soup-rust.vercel.app"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "/",
    siteName: "바다거북스프게임",
    title: "온라인 멀티 바다거북스프게임",
    description: "추리와 질문으로 진실을 밝혀내는 온라인 멀티플레이어 바다거북스프 게임. 친구들과 함께 실시간으로 추리 게임을 즐기세요.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "바다거북스프게임",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "온라인 멀티 바다거북스프게임",
    description: "추리와 질문으로 진실을 밝혀내는 온라인 멀티플레이어 바다거북스프 게임",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "4j3cTkVACL2lF9s0CFfg6x9kHsVdndQdbKI5atxdBGQ",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://turtle-soup-rust.vercel.app";
  
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "바다거북스프게임",
    "description": "추리와 질문으로 진실을 밝혀내는 온라인 멀티플레이어 바다거북스프 게임",
    "url": siteUrl,
    "applicationCategory": "Game",
    "operatingSystem": "Web",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "KRW"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.5",
      "ratingCount": "100"
    },
    "game": {
      "@type": "VideoGame",
      "name": "바다거북스프",
      "description": "추리 게임",
      "gamePlatform": "Web Browser",
      "genre": "추리게임"
    }
  };

  return (
    <html lang="ko" suppressHydrationWarning={true}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
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
