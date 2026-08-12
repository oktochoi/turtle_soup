import type { Metadata } from "next";
import { Noto_Serif_KR, IBM_Plex_Sans_KR } from "next/font/google";
import AdSenseScript from "@/components/ads/AdSenseScript";
import GoogleAnalytics from "@/components/analytics/GoogleAnalytics";
import "./globals.css";

const display = Noto_Serif_KR({
  weight: ['500', '700'],
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  variable: '--font-display',
});

const body = IBM_Plex_Sans_KR({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  variable: '--font-body',
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://turtle-soup-rust.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "바다거북스프",
  description: "질문으로 비밀을 푸는 추리 퀴즈",
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon" },
      { url: "/icon.png", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    title: "바다거북스프",
    description: "질문으로 비밀을 푸는 추리 퀴즈",
    url: SITE_URL,
    siteName: "바다거북스프",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "바다거북스프",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "바다거북스프",
    description: "질문으로 비밀을 푸는 추리 퀴즈",
    images: ["/og.png"],
  },
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
        <meta name="google-site-verification" content="4j3cTkVACL2lF9s0CFfg6x9kHsVdndQdbKI5atxdBGQ" />
      </head>
      <body className={`${display.variable} ${body.variable} antialiased`}>
        <GoogleAnalytics />
        <AdSenseScript />
        {children}
      </body>
    </html>
  );
}
