// POST /api/upload: 90-day public links for YouTube/HTTPS MPDF sharing copies.
// Embedded audio stays in files transferred directly by the user.
import { newId, inspect, json, MAX_BYTES, LINK_TTL_DAYS, LINK_TTL_MS } from '../_lib.js'

export async function onRequestPost({ request, env }) {
  if (!env.MPDF_FILES) return json({ error: 'link_disabled' }, 503)
  const declared = Number(request.headers.get('content-length') || 0)
  if (declared > MAX_BYTES) return json({ error: 'too_large' }, 413)
  // Read with a bound: a chunked body must not bypass the content-length check.
  const reader = request.body?.getReader()
  if (!reader) return json({ error: 'not_pdf' }, 400)
  const chunks = []; let size = 0
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_BYTES) { await reader.cancel(); return json({ error: 'too_large' }, 413) }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size); let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  if (bytes.length < 5 || String.fromCharCode(...bytes.subarray(0, 5)) !== '%PDF-') return json({ error: 'not_pdf' }, 400)
  let info
  try { info = await inspect(bytes) } catch { return json({ error: 'unreadable' }, 400) }
  if (!info.manifest) return json({ error: 'not_mpdf' }, 400)
  if (info.validationErrors.length || info.metadataErrors.length) return json({ error: 'invalid_manifest' }, 400)
  if (info.privateOriginal) return json({ error: 'private_original' }, 400)
  if (info.embeddedAudio) return json({ error: 'embedded_audio' }, 400)
  if (info.unknownAttachments.length || info.pageAttachments) return json({ error: 'unsupported_attachment' }, 400)
  const id = newId(), created = new Date()
  const expires = new Date(created.getTime() + LINK_TTL_MS)
  const meta = { title: String(info.manifest.title || '').slice(0, 120), pages: String(info.pageCount), tracks: String(info.manifest.tracks.length), created: created.toISOString(), expires: expires.toISOString() }
  await env.MPDF_FILES.put(id + '.pdf', bytes, { httpMetadata: { contentType: 'application/pdf' }, customMetadata: meta })
  const url = new URL(request.url); url.pathname = '/v/' + id; url.search = ''; url.hash = ''
  return json({ id, url: url.toString(), expiresAt: expires.toISOString(), retentionDays: LINK_TTL_DAYS })
}
export const onRequest = ({ request }) => request.method === 'POST' ? undefined : json({ error: 'method' }, 405)
