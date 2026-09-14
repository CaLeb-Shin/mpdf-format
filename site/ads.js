// Default ad slots. Fill in unit ids when the ad account is approved; until then slots stay as dashed placeholders.
export const ADS = {
  provider: '',                 // 'adfit' | 'adsense' | '' (placeholders)
  adfit: { landing: '', viewerTop: '', viewerPanel: '', viewerMobileTop: '' },
  adsense: { client: '', landing: '', viewerTop: '', viewerPanel: '' },
}
export function mountAds() {
  for (const slot of document.querySelectorAll('[data-ad]')) {
    const key = slot.dataset.ad
    if (ADS.provider === 'adfit' && ADS.adfit[key]) {
      const [w, h] = (slot.dataset.size || '728x90').split('x')
      slot.innerHTML = `<ins class="kakao_ad_area" style="display:none;" data-ad-unit="${ADS.adfit[key]}" data-ad-width="${w}" data-ad-height="${h}"></ins>`
      slot.classList.remove('ad-slot')
      if (!document.querySelector('script[src*="kas/static/ba.min.js"]')) { const s = document.createElement('script'); s.async = true; s.src = '//t1.daumcdn.net/kas/static/ba.min.js'; document.body.appendChild(s) }
    } else if (ADS.provider === 'adsense' && ADS.adsense[key]) {
      slot.innerHTML = `<ins class="adsbygoogle" style="display:block" data-ad-client="${ADS.adsense.client}" data-ad-slot="${ADS.adsense[key]}" data-ad-format="auto" data-full-width-responsive="true"></ins>`
      slot.classList.remove('ad-slot')
      if (!document.querySelector('script[src*="adsbygoogle"]')) { const s = document.createElement('script'); s.async = true; s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADS.adsense.client}`; s.crossOrigin = 'anonymous'; document.head.appendChild(s) }
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    }
  }
}
