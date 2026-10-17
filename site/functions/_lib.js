// Shared by Pages Functions. Runs on Cloudflare Workers (no Node APIs).
import { PDFDocument, PDFName, PDFDict, PDFArray, PDFStream, decodePDFRawStream } from 'pdf-lib'
import { validate, inspectPublication, PUBLICATION, SCORE } from '../mpdf-browser.js'

const ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export function newId(len = 10) { const a = new Uint8Array(len); crypto.getRandomValues(a); return Array.from(a, b => ALPHABET[b % ALPHABET.length]).join('') }
export const isId = s => /^[A-Za-z0-9]{8,16}$/.test(s || '')
export const MAX_BYTES = 20 * 1024 * 1024
export const LINK_TTL_DAYS = 90
export const LINK_TTL_MS = LINK_TTL_DAYS * 24 * 60 * 60 * 1000
export const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } })
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
export const expiresAt = object => {
  // R2's immutable upload timestamp is authoritative, including legacy objects
  // without customMetadata.created. The custom timestamp supports old fixtures.
  const uploaded = object?.uploaded ? new Date(object.uploaded).getTime() : NaN
  const created = Number.isFinite(uploaded) ? uploaded : Date.parse(object?.customMetadata?.created || '')
  return Number.isFinite(created) ? created + LINK_TTL_MS : null
}
export const isExpired = (object, now = Date.now()) => { const expiry = expiresAt(object); return expiry !== null && now >= expiry }
export function cacheHeader(object) {
  const expiry = expiresAt(object)
  const seconds = expiry === null ? 60 : Math.max(0, Math.min(60, Math.floor((expiry-Date.now())/1000)))
  return `public, max-age=${seconds}, must-revalidate`
}
export const gone = () => new Response('This MPDF link has expired. Ask the sender for a new link.', { status: 410, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } })

// Count all attachments, but only decode the small known JSON records. Audio is
// identified by track references, MIME, and extension rather than "any file".
export async function inspect(bytes) {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false })
  if (doc.isEncrypted) throw new Error('encrypted')
  const names = doc.catalog.lookupMaybe(PDFName.of('Names'), PDFDict)
  const tree = names?.lookupMaybe(PDFName.of('EmbeddedFiles'), PDFDict)
  let manifest = null
  const files = Object.create(null), fileNames = [], attachments = [], seen = new Set()
  if (tree) for (const [name, stream] of walk(tree)) {
    if (seen.has(name)) throw new Error('duplicate attachment')
    seen.add(name)
    if (seen.size > 512) throw new Error('too many attachments')
    if (!name || new TextEncoder().encode(name).length > 512 || /[\u0000-\u001f\u007f/\\]/.test(name) || name.includes('..')) throw new Error('invalid attachment key')
    const subtype = stream.dict.get(PDFName.of('Subtype'))?.decodeText?.() || ''
    attachments.push({ name, mime: subtype })
    if (name !== 'mpdf.json') fileNames.push(name)
    const limit = name === 'mpdf.json' ? 1048576 : name === PUBLICATION ? 4194304 : name === SCORE ? 16777216 : 0
    if (!limit) continue
    const declared = stream.dict.lookupMaybe(PDFName.of('Params'), PDFDict)?.get(PDFName.of('Size'))?.asNumber?.()
    if (declared > limit) throw new Error('metadata too large')
    const content = decodePDFRawStream(stream).decode()
    if (content.byteLength > limit) throw new Error('metadata too large')
    if (name === 'mpdf.json') { try { manifest = JSON.parse(new TextDecoder().decode(content)) } catch {} }
    else files[name] = content
  }
  if (!manifest || typeof manifest.mpdf !== 'string' || !manifest.mpdf.startsWith('1.')) manifest = null
  const validationErrors = manifest ? validate(manifest, fileNames, { pageCount: doc.getPageCount(), forWriting: true }) : []
  const info = inspectPublication(files, manifest || {})
  const privateKeys = new Set(['seetogether-original.pdf','seetogether-editing.pdf','seetogether-markup.json','mpdf-web-source.pdf'])
  for (const key of [info.publication?.sourcePDFKey, info.publication?.editableMarkupKey, manifest?.web?.sourcePDFKey]) if (typeof key === 'string') privateKeys.add(key)
  const privateOriginal = privateKeys.size && (fileNames.some(name => privateKeys.has(name)) || !!info.publication?.sourcePDFKey || !!info.publication?.editableMarkupKey || !!manifest?.web?.sourcePDFKey || (info.publication && info.publication.sharedReadOnly !== true))
  const embeddedAudio = (manifest?.tracks || []).some(t => typeof t?.src === 'string' && t.src.startsWith('file:')) || attachments.some(a => a.mime.startsWith('audio/') || /\.(mp3|m4a|wav|aac|ogg|flac|aif|aiff|opus|webm)$/i.test(a.name))
  const unknownAttachments = fileNames.filter(name => name !== PUBLICATION && name !== SCORE && !privateKeys.has(name) && !attachments.some(a => a.name === name && (a.mime.startsWith('audio/') || /\.(mp3|m4a|wav|aac|ogg|flac|aif|aiff|opus|webm)$/i.test(name))))
  // Per-page associated files and file annotations cannot bypass the name tree.
  let pageAttachments = !!doc.catalog.lookupMaybe(PDFName.of('AF'), PDFArray)?.size()
  // pdf-lib/native producers may add AF for their name-tree entries. These are
  // valid only when every associated file is represented by that name tree.
  const knownStreams = new Set(attachments.map(a => a.name))
  const af = doc.catalog.lookupMaybe(PDFName.of('AF'), PDFArray)
  if (af) {
    pageAttachments = false
    for (let i = 0; i < af.size(); i++) {
      const spec = af.lookupMaybe(i, PDFDict)
      const name = spec?.get(PDFName.of('UF'))?.decodeText?.() || spec?.get(PDFName.of('F'))?.decodeText?.()
      if (!knownStreams.has(name)) pageAttachments = true
    }
  }
  for (const page of doc.getPages()) {
    if (page.node.has(PDFName.of('AF'))) pageAttachments = true
    const annotations = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray)
    if (annotations) for (let i = 0; i < annotations.size(); i++) {
      const a = annotations.lookupMaybe(i, PDFDict), kind = a?.get(PDFName.of('Subtype'))?.toString()
      if (a?.has(PDFName.of('FS')) || a?.has(PDFName.of('AF')) || ['/FileAttachment','/RichMedia','/Sound','/Movie','/Screen'].includes(kind)) pageAttachments = true
    }
  }
  return { pageCount: doc.getPageCount(), manifest, fileNames, validationErrors, metadataErrors: info.errors, privateOriginal: !!privateOriginal, embeddedAudio, unknownAttachments, pageAttachments }
}
function* walk(node, seen = new Set()) {
  if (seen.has(node)) throw new Error('cyclic attachment tree')
  seen.add(node)
  if (seen.size > 1024) throw new Error('attachment tree too large')
  const names = node.lookupMaybe(PDFName.of('Names'), PDFArray)
  if (names) for (let i = 0; i + 1 < names.size(); i += 2) {
    const spec = names.lookupMaybe(i + 1, PDFDict)
    const ef = spec?.lookupMaybe(PDFName.of('EF'), PDFDict)
    const stream = ef && (ef.lookupMaybe(PDFName.of('UF'), PDFStream) || ef.lookupMaybe(PDFName.of('F'), PDFStream))
    if (stream) yield [names.lookup(i).decodeText(), stream]
  }
  const kids = node.lookupMaybe(PDFName.of('Kids'), PDFArray)
  if (kids) for (let i = 0; i < kids.size(); i++) { const k = kids.lookupMaybe(i, PDFDict); if (k) yield* walk(k, seen) }
}
