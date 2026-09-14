// POST /api/upload  (body: the MPDF bytes, content-type application/pdf) -> { id, url }
// Policy: links are only made for files whose tracks are YouTube/URL. Files with embedded audio are refused
// (we never host audio), so the maker tells people to send those as a plain file instead.
import { newId, inspect, json, MAX_BYTES } from '../_lib.js'

export async function onRequestPost({ request, env }) {
  if (!env.MPDF_FILES) return json({ error: 'link_disabled' }, 503)
  const declared = +(request.headers.get('content-length') || 0)
  if (declared > MAX_BYTES) return json({ error: 'too_large' }, 413)
  const bytes = new Uint8Array(await request.arrayBuffer())
  if (bytes.length > MAX_BYTES) return json({ error: 'too_large' }, 413)
  if (bytes.length < 5 || String.fromCharCode(...bytes.subarray(0, 5)) !== '%PDF-') return json({ error: 'not_pdf' }, 400)
  let info
  try { info = await inspect(bytes) } catch { return json({ error: 'unreadable' }, 400) }
  if (!info.manifest) return json({ error: 'not_mpdf' }, 400)
  if (info.fileNames.length) return json({ error: 'embedded_audio' }, 400)
  const id = newId()
  const meta = { title: String(info.manifest.title || '').slice(0, 120), pages: String(info.pageCount),
                 tracks: String((info.manifest.tracks || []).length), created: new Date().toISOString() }
  await env.MPDF_FILES.put(id + '.pdf', bytes, { httpMetadata: { contentType: 'application/pdf' }, customMetadata: meta })
  const url = new URL(request.url); url.pathname = '/v/' + id; url.search = ''
  return json({ id, url: url.toString() })
}
export const onRequest = ({ request }) => request.method === 'POST' ? undefined : json({ error: 'method' }, 405)
