// MPDF reference implementation (JavaScript, ESM). MIT. Depends on pdf-lib.
// createMpdf(pdfBytes, manifest, files) -> Uint8Array   readMpdf(pdfBytes) -> {manifest, files} | null
import { PDFDocument, PDFName, PDFDict, PDFArray, PDFStream, decodePDFRawStream } from 'pdf-lib'

export const MANIFEST_NAME = 'mpdf.json'
export const SPEC_VERSION = '1.0'
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/
const MIME = { m4a: 'audio/mp4', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' }
const mimeOf = (name) => MIME[name.split('.').pop().toLowerCase()] || 'application/octet-stream'

/** Returns a list of problems. Empty list means valid. fileNames: keys of embedded files (optional). */
export function validate(m, fileNames) {
  const e = []
  if (!m || typeof m !== 'object') return ['manifest must be an object']
  if (typeof m.mpdf !== 'string' || !m.mpdf.startsWith('1.')) e.push('mpdf must be "1.x"')
  const tracks = Array.isArray(m.tracks) && m.tracks.length ? m.tracks : (e.push('tracks must be a non-empty array'), [])
  const ids = new Set()
  tracks.forEach((t, i) => {
    const id = t && t.id
    if (typeof id !== 'string' || !ID_RE.test(id)) e.push(`tracks[${i}].id invalid`)
    else if (ids.has(id)) e.push(`tracks[${i}].id duplicate: ${id}`)
    ids.add(id)
    const src = t && t.src
    if (typeof src !== 'string' || !src) e.push(`tracks[${i}].src missing`)
    else if (fileNames && src.startsWith('file:') && !fileNames.includes(src.slice(5))) e.push(`tracks[${i}].src refers to missing file ${src.slice(5)}`)
  })
  ;(Array.isArray(m.cues) ? m.cues : []).forEach((c, i) => {
    c = c || {}
    if (!Number.isInteger(c.page) || c.page < 1) e.push(`cues[${i}].page must be an integer >= 1`)
    if (!ids.has(c.track)) e.push(`cues[${i}].track unknown: ${c.track}`)
    if (c.at != null && !(typeof c.at === 'number' && c.at >= 0)) e.push(`cues[${i}].at must be >= 0`)
  })
  return e
}

/** pdfBytes: a normal PDF (Uint8Array/ArrayBuffer). files: { 'track2.m4a': Uint8Array }. Returns the .mpdf bytes. */
export async function createMpdf(pdfBytes, manifest, files = {}) {
  const errors = validate(manifest, Object.keys(files))
  if (errors.length) throw new Error('invalid manifest: ' + errors.join('; '))
  const doc = await PDFDocument.load(pdfBytes, { updateMetadata: false })
  for (const [name] of attachments(doc)) if (name === MANIFEST_NAME) throw new Error('PDF already contains mpdf.json')
  await doc.attach(new TextEncoder().encode(JSON.stringify(manifest, null, 2)), MANIFEST_NAME,
    { mimeType: 'application/json', description: 'MPDF manifest' })
  for (const [name, bytes] of Object.entries(files)) await doc.attach(bytes, name, { mimeType: mimeOf(name) })
  return doc.save()
}

/** Returns { manifest, files: { name: Uint8Array } } or null when the PDF is not an MPDF. */
export async function readMpdf(pdfBytes) {
  const doc = await PDFDocument.load(pdfBytes, { updateMetadata: false, ignoreEncryption: true })
  const files = {}
  for (const [name, bytes] of attachments(doc)) files[name] = bytes
  const raw = files[MANIFEST_NAME]
  if (!raw) return null
  delete files[MANIFEST_NAME]
  const manifest = JSON.parse(new TextDecoder().decode(raw))
  if (typeof manifest.mpdf !== 'string' || !manifest.mpdf.startsWith('1.')) return null
  return { manifest, files }
}

// Walk the EmbeddedFiles name tree (both flat /Names and /Kids forms) and yield [key, bytes].
function* attachments(doc) {
  const names = doc.catalog.lookupMaybe(PDFName.of('Names'), PDFDict)
  const tree = names && names.lookupMaybe(PDFName.of('EmbeddedFiles'), PDFDict)
  if (tree) yield* walk(tree)
}
function* walk(node) {
  const names = node.lookupMaybe(PDFName.of('Names'), PDFArray)
  if (names) for (let i = 0; i + 1 < names.size(); i += 2) {
    const spec = names.lookupMaybe(i + 1, PDFDict)
    const ef = spec && spec.lookupMaybe(PDFName.of('EF'), PDFDict)
    const stream = ef && (ef.lookupMaybe(PDFName.of('UF'), PDFStream) || ef.lookupMaybe(PDFName.of('F'), PDFStream))
    if (stream) yield [names.lookup(i).decodeText(), decodePDFRawStream(stream).decode()]
  }
  const kids = node.lookupMaybe(PDFName.of('Kids'), PDFArray)
  if (kids) for (let i = 0; i < kids.size(); i++) { const k = kids.lookupMaybe(i, PDFDict); if (k) yield* walk(k) }
}
