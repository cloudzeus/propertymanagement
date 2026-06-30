"use client";
import Script from "next/script";
export function SiteTags({ ga, gtm, pixel, extraHead }: { ga?: string | null; gtm?: string | null; pixel?: string | null; extraHead?: string | null }) {
  return (
    <>
      <Script id="consent-default" strategy="beforeInteractive">{`
        window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=window.gtag||gtag;
        gtag('consent','default',{ad_storage:'denied',analytics_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
      `}</Script>
      {ga && (<><Script src={`https://www.googletagmanager.com/gtag/js?id=${ga}`} strategy="afterInteractive" /><Script id="ga-init" strategy="afterInteractive">{`gtag('js',new Date());gtag('config','${ga}');`}</Script></>)}
      {gtm && (<Script id="gtm" strategy="afterInteractive">{`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtm}');`}</Script>)}
      {pixel && (<Script id="fb-pixel" strategy="afterInteractive">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('consent','revoke');fbq('init','${pixel}');fbq('track','PageView');`}</Script>)}
      {extraHead ? <div dangerouslySetInnerHTML={{ __html: extraHead }} /> : null}
    </>
  );
}
