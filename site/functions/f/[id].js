// GET /f/{id}  -> the stored file (inline PDF; ?download for an attachment)
import { isId } from '../_lib.js'

export async function onRequestGet({ params, env, request }) {
  const id = String(params.id).replace(/\.pdf$/i, '')
  if (!isId(id)) return new Response('Not found', { status: 404 })
  const obj = await env.MPDF_FILES.get(id + '.pdf')
  if (!obj) return new Response('Not found', { status: 404 })
  const title = ((obj.customMetadata && obj.customMetadata.title) || 'mpdf').replace(/[\\/:*?"<>|]/g, '_')
  const attachment = new URL(request.url).searchParams.has('download')
  return new Response(obj.body, { headers: {
    'content-type': 'application/pdf',
    'content-disposition': `${attachment ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(title)}.pdf`,
    'cache-control': 'public, max-age=31536000, immutable',
    'etag': obj.httpEtag || '',
  } })
}
