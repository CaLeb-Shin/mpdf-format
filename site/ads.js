// Ad slots. Fill in the unit ids once the ad account is approved; until then slots stay as dashed placeholders.
//
// Where ads go (and where they don't):
//   landing    728x90  under the maker card         (mobile: 320x50 'landingMobile')
//   viewerTop  728x90  strip above the PDF          (mobile: 320x50 'viewerTopMobile')
//   house      the slot inside the floating player  -> never a network ad (AdFit/AdSense forbid ads in
//              floating/fixed elements); use it for a self-sold sponsor banner or leave it empty.
export const ADS = {
  provider: '',                                   // 'adfit' | 'adsense' | '' (placeholders only)
  adfit:   { landing: '', landingMobile: '', viewerTop: '', viewerTopMobile: '' },
  adsense: { client: '', landing: '', viewerTop: '' },   // client = 'ca-pub-XXXXXXXXXXXXXXXX'
  house:   { html: '' },                          // e.g. '<a href="..."><img src="..." alt=""></a>'
}
const isMobile = () => matchMedia('(max-width: 720px)').matches

export function mountAds() {
  for (const slot of document.querySelectorAll('[data-ad]')) {
    const key = slot.dataset.ad
    if (key === 'house') { if (ADS.house.html) { slot.innerHTML = ADS.house.html; slot.classList.remove('ad-slot') } else slot.remove(); continue }
    if (ADS.provider === 'adfit') {
      const unit = (isMobile() && ADS.adfit[key + 'Mobile']) || ADS.adfit[key]
      if (!unit) continue
      const [w, h] = (isMobile() && ADS.adfit[key + 'Mobile'] ? '320x50' : (slot.dataset.size || '728x90')).split('x')
      slot.innerHTML = `<ins class="kakao_ad_area" style="display:none;" data-ad-unit="${unit}" data-ad-width="${w}" data-ad-height="${h}"></ins>`
      slot.classList.remove('ad-slot')
      if (!document.querySelector('script[src*="kas/static/ba.min.js"]')) { const s = document.createElement('script'); s.async = true; s.src = '//t1.daumcdn.net/kas/static/ba.min.js'; document.body.appendChild(s) }
    } else if (ADS.provider === 'adsense' && ADS.adsense.client && ADS.adsense[key]) {
      slot.innerHTML = `<ins class="adsbygoogle" style="display:block" data-ad-client="${ADS.adsense.client}" data-ad-slot="${ADS.adsense[key]}" data-ad-format="horizontal" data-full-width-responsive="true"></ins>`
      slot.classList.remove('ad-slot')
      if (!document.querySelector('script[src*="adsbygoogle"]')) { const s = document.createElement('script'); s.async = true; s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADS.adsense.client}`; s.crossOrigin = 'anonymous'; document.head.appendChild(s) }
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    }
  }
}
