// GET /v/{id}: shared viewer with an Open Graph preview, valid for 90 days.
import { isId, esc, isExpired, cacheHeader } from '../_lib.js'

export async function onRequestGet({ params, env, request }) {
  const id = String(params.id)
  const staticPage = () => env.ASSETS.fetch(new URL('/v/', request.url))
  if (!isId(id) || !env.MPDF_FILES) return staticPage()
  const [head, page] = await Promise.all([env.MPDF_FILES.head(id + '.pdf'), staticPage()])
  let html = await page.text()
  if (!head || isExpired(head)) {
    const status = head ? 410 : 404
    html = html.replace('<!--og-->', '<meta name="robots" content="noindex">')
    return new Response(request.method === 'HEAD' ? null : html, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } })
  }
  const m = head.customMetadata || {}, origin = new URL(request.url).origin
  const title = m.title || 'MPDF'
  const ko = /\bko\b/i.test(request.headers.get('accept-language') || '')
  const desc = ko ? `${m.pages || '?'}쪽 · ${m.tracks || '?'}곡 · 악보를 보면서 듣는 PDF` : `${m.pages || '?'} pages · ${m.tracks || '?'} tracks · a PDF that plays music`
  const og = [
    '<meta property="og:type" content="website">', `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`, `<meta property="og:image" content="${origin}/${ko ? 'og-ko.png' : 'og.png'}">`,
    `<meta property="og:locale" content="${ko ? 'ko_KR' : 'en_US'}">`, `<meta property="og:url" content="${origin}/v/${id}">`,
    '<meta name="twitter:card" content="summary_large_image">', `<meta name="description" content="${esc(desc)}">`,
  ].join('')
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)} · MPDF</title>`).replace('<!--og-->', og)
  return new Response(request.method === 'HEAD' ? null : html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': cacheHeader(head) } })
}
export const onRequestHead = onRequestGet
