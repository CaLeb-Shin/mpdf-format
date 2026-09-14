// Shared by the Pages Functions. Runs on Cloudflare Workers (no Node APIs).
import { PDFDocument, PDFName, PDFDict, PDFArray, PDFStream, decodePDFRawStream } from 'pdf-lib'

const ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'  // no 0/O/1/l
export function newId(len = 10) { const a = new Uint8Array(len); crypto.getRandomValues(a); return Array.from(a, (b) => ALPHABET[b % ALPHABET.length]).join('') }
export const isId = (s) => /^[A-Za-z0-9]{8,16}$/.test(s || '')
export const MAX_BYTES = 20 * 1024 * 1024
export const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

// What is in this PDF: page count, the MPDF manifest (or null), and the names of other embedded files.
export async function inspect(bytes) {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false, ignoreEncryption: true })
  const names = doc.catalog.lookupMaybe(PDFName.of('Names'), PDFDict)
  const tree = names && names.lookupMaybe(PDFName.of('EmbeddedFiles'), PDFDict)
  let manifest = null; const fileNames = []
  if (tree) for (const [name, stream] of walk(tree)) {
    if (name !== 'mpdf.json') { fileNames.push(name); continue }
    try { manifest = JSON.parse(new TextDecoder().decode(decodePDFRawStream(stream).decode())) } catch { manifest = null }
  }
  if (!manifest || typeof manifest.mpdf !== 'string' || !manifest.mpdf.startsWith('1.')) manifest = null
  return { pageCount: doc.getPageCount(), manifest, fileNames }
}
function* walk(node) {
  const names = node.lookupMaybe(PDFName.of('Names'), PDFArray)
  if (names) for (let i = 0; i + 1 < names.size(); i += 2) {
    const spec = names.lookupMaybe(i + 1, PDFDict)
    const ef = spec && spec.lookupMaybe(PDFName.of('EF'), PDFDict)
    const stream = ef && (ef.lookupMaybe(PDFName.of('UF'), PDFStream) || ef.lookupMaybe(PDFName.of('F'), PDFStream))
    if (stream) yield [names.lookup(i).decodeText(), stream]
  }
  const kids = node.lookupMaybe(PDFName.of('Kids'), PDFArray)
  if (kids) for (let i = 0; i < kids.size(); i++) { const k = kids.lookupMaybe(i, PDFDict); if (k) yield* walk(k) }
}
