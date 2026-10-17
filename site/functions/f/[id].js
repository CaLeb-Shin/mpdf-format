// GET /f/{id}. Expiry is checked on every origin read, including legacy links.
import { isId, isExpired, cacheHeader, gone } from '../_lib.js'

export async function onRequestGet({ params, env, request }) {
  const id = String(params.id).replace(/\.pdf$/i, '')
  if (!isId(id) || !env.MPDF_FILES) return new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store' } })
  const obj = await env.MPDF_FILES.get(id + '.pdf')
  if (!obj) return new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store' } })
  if (isExpired(obj)) { await obj.body?.cancel?.(); return gone() }
  const title = ((obj.customMetadata && obj.customMetadata.title) || 'mpdf').replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, '_')
  const attachment = new URL(request.url).searchParams.has('download')
  const headers = {
    'content-type': 'application/pdf',
    'content-disposition': `${attachment ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(title)}.pdf`,
    'cache-control': cacheHeader(obj), 'x-content-type-options': 'nosniff',
    'etag': obj.httpEtag || '',
  }
  if (request.method === 'HEAD') { await obj.body?.cancel?.(); return new Response(null, { headers }) }
  return new Response(obj.body, { headers })
}
export const onRequestHead = onRequestGet
