// UI strings for the scripts. Static pages are per-language (/ = English, /ko/ = Korean); the viewer
// page is shared and picks the language from ?lang= or the browser.
const h = document.documentElement
export const LANG = h.dataset.autoLang
  ? (((new URLSearchParams(location.search).get('lang') || navigator.language || 'en').toLowerCase().startsWith('ko')) ? 'ko' : 'en')
  : (h.lang === 'ko' ? 'ko' : 'en')
const D = {
  en: {
    'status.idle': 'Files are processed in your browser. Only “Create link” uploads anything.',
    'pdf.unreadable': "Can't read this PDF", 'pdf.loaded': '{name} · {n} pages', 'pdf.loadedNext': '{name} · {n} pages · now add YouTube links or audio',
    'pdf.existing': 'This file already has music. Loaded its tracks and page assignments.', 'drop.change': '{n} pages · click to change', 'fetch.fail': "Couldn't load the file",
    'tracks.none': 'No tracks yet', 'track.title': 'Song title', 'track.remove': 'Remove', 'src.youtube': 'YouTube · {id}', 'src.file': 'Audio · {name}',
    'yt.invalid': "That's not a YouTube link. Example: https://youtu.be/dQw4w9WgXcQ", 'yt.added': 'Track added. Click the title to name the song.',
    'audio.notAudio': '{name}: not an audio file', 'audio.added': '{name} · {mb} MB will be embedded in the file',
    'page.none': 'No track', 'page.continues': 'Continues', 'page.aria': 'Track for page {p}', 'at.label': 'Start', 'at.aria': 'Start position', 'range.from': 'from {t}',
    'save.noPdf': 'Add a PDF first', 'save.noTracks': 'Add at least one track', 'save.making': 'Building…', 'save.done': 'Saved {name} · {mb} MB. Send the file as it is by chat or mail.',
    'link.audio': "Files with embedded audio can't be shared by link (we never host audio). Only YouTube tracks get links; save this one as PDF and send the file.",
    'link.uploading': 'Uploading…', 'link.fail': "Couldn't create a link ({code})", 'link.done': 'Link ready. Paste it into a chat and it opens with a preview.', 'link.copied': 'Link copied', 'link.copyManual': 'Long-press to copy',
    'err.link_disabled': 'Links are not enabled yet. Save as PDF and send the file for now.', 'err.too_large': 'File too large (max 20 MB)', 'err.not_pdf': 'Not a PDF', 'err.unreadable': "Can't read this PDF", 'err.not_mpdf': 'No track information in this file', 'err.embedded_audio': "Files with embedded audio can't be shared by link",
    'v.title': 'Viewer', 'v.noMusic': '{n} pages · no music', 'v.meta': '{n} pages · {m} tracks', 'v.expired': "This link doesn't exist or has expired", 'v.fail': "Couldn't load the file", 'v.copied': 'Copied', 'v.from': 'from {t}',
    'v.copy': 'Copy link', 'v.save': 'Save PDF', 'v.make': 'Make your own', 'v.drop.h': 'MPDF Viewer', 'v.drop.p': 'Drop a .pdf or .mpdf you received. If it carries music, it plays from the pill below. Plain PDFs open too.', 'v.drop.btn': 'Open file', 'v.drop.note': 'Files never leave your browser.',
    'v.player': 'Player · drag to move', 'v.collapse': 'Collapse', 'v.expand': 'Expand', 'v.prev': 'Previous track', 'v.next': 'Next track', 'v.play': 'Play', 'v.pause': 'Pause', 'v.ad': 'ad', 'v.house': 'sponsor',
  },
  ko: {
    'status.idle': '파일은 브라우저 안에서 처리됩니다. "링크 만들기"를 누른 파일만 서버에 올라갑니다.',
    'pdf.unreadable': 'PDF를 읽을 수 없습니다', 'pdf.loaded': '{name} · {n}쪽', 'pdf.loadedNext': '{name} · {n}쪽 · 이제 유튜브 링크나 음원을 넣으세요',
    'pdf.existing': '이미 음악이 붙은 파일입니다. 기존 트랙과 페이지 지정을 불러왔습니다.', 'drop.change': '{n}쪽 · 클릭해서 바꾸기', 'fetch.fail': '파일을 불러오지 못했습니다',
    'tracks.none': '아직 트랙이 없습니다', 'track.title': '곡 제목', 'track.remove': '삭제', 'src.youtube': '유튜브 · {id}', 'src.file': '음원 · {name}',
    'yt.invalid': '유튜브 링크가 아닙니다. 예: https://youtu.be/dQw4w9WgXcQ', 'yt.added': '트랙을 넣었습니다. 제목을 눌러 곡 이름으로 바꿔 두세요.',
    'audio.notAudio': '{name}: 음원 파일이 아닙니다', 'audio.added': '{name} · {mb} MB를 파일에 넣습니다',
    'page.none': '곡 없음', 'page.continues': '이어짐', 'page.aria': '{p}페이지 곡', 'at.label': '시작', 'at.aria': '시작 위치', 'range.from': '{t}부터',
    'save.noPdf': 'PDF를 먼저 넣어 주세요', 'save.noTracks': '트랙을 하나 이상 넣어 주세요', 'save.making': '만드는 중…', 'save.done': '{name} · {mb} MB 저장했습니다. 카톡·메일로 파일 그대로 보내면 됩니다.',
    'link.audio': '음원 파일이 들어 있으면 링크로 공유할 수 없습니다(음원을 서버에 두지 않습니다). 유튜브 트랙만 링크가 되고, 이 파일은 PDF로 저장해 보내 주세요.',
    'link.uploading': '올리는 중…', 'link.fail': '링크를 만들지 못했습니다 ({code})', 'link.done': '링크를 만들었습니다. 카톡에 붙여 넣으면 미리보기와 함께 열립니다.', 'link.copied': '링크를 복사했습니다', 'link.copyManual': '길게 눌러 복사하세요',
    'err.link_disabled': '링크 기능이 아직 켜지지 않았습니다. 지금은 PDF로 저장해 보내 주세요', 'err.too_large': '파일이 너무 큽니다 (최대 20MB)', 'err.not_pdf': 'PDF가 아닙니다', 'err.unreadable': 'PDF를 읽을 수 없습니다', 'err.not_mpdf': '트랙 정보가 없습니다', 'err.embedded_audio': '음원 파일이 들어 있는 파일은 링크로 공유할 수 없습니다',
    'v.title': '뷰어', 'v.noMusic': '{n}쪽 · 음악 없음', 'v.meta': '{n}쪽 · {m}곡', 'v.expired': '없는 링크이거나 보관 기간이 지났습니다', 'v.fail': '파일을 불러오지 못했습니다', 'v.copied': '복사됨', 'v.from': '{t}부터',
    'v.copy': '링크 복사', 'v.save': 'PDF로 저장', 'v.make': '나도 만들기', 'v.drop.h': 'MPDF 뷰어', 'v.drop.p': '받은 .pdf나 .mpdf 파일을 여기에 놓으세요. 음악이 붙어 있으면 아래 알약에서 재생됩니다. 그냥 PDF도 열립니다.', 'v.drop.btn': '파일 열기', 'v.drop.note': '파일은 브라우저 안에서만 열립니다.',
    'v.player': '플레이어 · 끌어서 이동', 'v.collapse': '접기', 'v.expand': '펼치기', 'v.prev': '이전 곡', 'v.next': '다음 곡', 'v.play': '재생', 'v.pause': '일시정지', 'v.ad': '광고', 'v.house': '후원 배너',
  },
}
export const t = (k, v = {}) => (D[LANG][k] || D.en[k] || k).replace(/\{(\w+)\}/g, (_, n) => (v[n] ?? ''))
// Fill elements marked data-i18n / data-i18n-aria / data-i18n-label with the current language.
export function applyDom() {
  h.lang = LANG
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n)
  for (const el of document.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria))
  for (const el of document.querySelectorAll('[data-i18n-label]')) el.dataset.label = t(el.dataset.i18nLabel)
}
// A Korean-speaking visitor on an English page gets a one-line offer of the Korean page.
export function offerKorean() {
  const ko = h.dataset.ko; if (!ko || LANG === 'ko') return
  if (!(navigator.language || '').toLowerCase().startsWith('ko')) return
  try { if (localStorage.getItem('mpdf_lang') === 'en') return } catch {}
  const bar = document.createElement('div'); bar.className = 'langbar'
  bar.innerHTML = `<span>이 페이지는 한국어로도 볼 수 있습니다.</span><a href="${ko}">한국어로 보기</a><button aria-label="닫기">×</button>`
  bar.querySelector('button').onclick = () => { try { localStorage.setItem('mpdf_lang', 'en') } catch {} bar.remove() }
  document.body.prepend(bar)
}
