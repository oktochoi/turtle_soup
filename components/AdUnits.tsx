'use client';

import Script from 'next/script';

/** Popunder, Banner(300x250), SocialBar, Native Bar 스크립트 및 컨테이너 */
export function AdScripts() {
  return (
    <>
      {/* Popunder: 페이지 로드 후 비동기 로드 (세션당 노출 제어는 광고 네트워크 측) */}
      <Script
        src="https://pl28493943.effectivegatecpm.com/4e/aa/53/4eaa533e8af316dc8287bf5ab5a27d46.js"
        strategy="lazyOnload"
      />

      {/* Banner 300x250: atOptions 설정 후 invoke.js 로드 */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            if (typeof atOptions === 'undefined') {
              atOptions = {
                key: 'af92c18ee1c46169b735a94109cbf875',
                format: 'iframe',
                height: 250,
                width: 300,
                params: {}
              };
            }
          `,
        }}
      />
      <Script
        src="https://www.highperformanceformat.com/af92c18ee1c46169b735a94109cbf875/invoke.js"
        strategy="lazyOnload"
      />

      {/* SocialBar */}
      <Script
        src="https://pl28489651.effectivegatecpm.com/03/8a/81/038a81177705a94b1b3a016e57699e3f.js"
        strategy="lazyOnload"
      />

      {/* Native Bar: 컨테이너 ID는 스크립트가 찾음 */}
      <Script
        src="https://pl28489713.effectivegatecpm.com/e55815afb3e5d73fa76db3038a7eff13/invoke.js"
        strategy="lazyOnload"
        data-cfasync="false"
        async
      />
    </>
  );
}

/** 배너 300x250 슬롯 (invoke 스크립트가 body 또는 이 영역에 주입) */
export function AdBannerSlot() {
  return (
    <div
      id="ad-banner-300x250"
      className="ad-banner-300x250 flex items-center justify-center min-h-[250px] w-full max-w-[300px] mx-auto bg-slate-800/30 rounded-lg"
      style={{ width: 300, height: 250 }}
    />
  );
}

/** Native Bar 컨테이너 (스크립트가 이 id로 주입) */
export function AdNativeBarContainer() {
  return (
    <div
      id="container-e55815afb3e5d73fa76db3038a7eff13"
      className="ad-native-banner w-full min-h-[50px] bg-slate-800/30"
    />
  );
}
