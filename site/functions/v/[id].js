// GET /v/{id} -> the viewer page with Open Graph tags for this file (chat apps show a preview card)
import { isId, esc } from '../_lib.js'

export async function onRequestGet({ params, env, request }) {
  const id = String(params.id)
  const staticPage = () => env.ASSETS.fetch(new URL('/v/', request.url))
  if (!isId(id) || !env.MPDF_FILES) return staticPage()
  const [head, page] = await Promise.all([env.MPDF_FILES.head(id + '.pdf'), staticPage()])
  let html = await page.text()
  if (!head) return new Response(html.replace('<!--og-->', '<meta name="robots" content="noindex">'), { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } })
  const m = head.customMetadata || {}
  const origin = new URL(request.url).origin
  const title = m.title || 'MPDF'
  const ko = /\bko\b/i.test(request.headers.get('accept-language') || '')
  const desc = ko ? `${m.pages || '?'}쪽 · ${m.tracks || '?'}곡 · 악보를 보면서 듣는 PDF` : `${m.pages || '?'} pages · ${m.tracks || '?'} tracks · a PDF that plays music`
  const og = [
    `<meta property="og:type" content="website">`, `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`, `<meta property="og:image" content="${origin}/${ko ? 'og-ko.png' : 'og.png'}">`,
    `<meta property="og:locale" content="${ko ? 'ko_KR' : 'en_US'}">`,
    `<meta property="og:url" content="${origin}/v/${id}">`, `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="description" content="${esc(desc)}">`,
  ].join('')
  html = html.replace('<title>MPDF Viewer</title>', `<title>${esc(title)} · MPDF</title>`).replace('<!--og-->', og)
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' } })
}

export const onRequestHead = onRequestGet
