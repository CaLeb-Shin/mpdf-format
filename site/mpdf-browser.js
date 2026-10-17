// MPDF 1.x browser codec. pdf-lib is loaded only when a PDF is written.
export const MANIFEST = 'mpdf.json'
export const PUBLICATION = 'seetogether-mpdf.json'
export const SCORE = 'seetogether-score.json'
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MIME = { m4a: 'audio/mp4', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', aac: 'audio/aac', flac: 'audio/flac', webm: 'audio/webm', json: 'application/json', pdf: 'application/pdf' }
const PRIVATE_FILES = ['seetogether-original.pdf', 'seetogether-editing.pdf', 'seetogether-markup.json', 'mpdf-web-source.pdf']
const RESERVED_AUDIO = new Set([MANIFEST, PUBLICATION, SCORE, ...PRIVATE_FILES])
const encoder = new TextEncoder()
const decoder = new TextDecoder()
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const clone = (value) => JSON.parse(JSON.stringify(value))
const finite = (value) => typeof value === 'number' && Number.isFinite(value)
const safeKey = (name) => typeof name === 'string' && name.length > 0 && encoder.encode(name).length <= 512 && !/[\u0000-\u001f\u007f/\\]/.test(name) && !name.includes('..')
export const mimeOf = (name) => MIME[String(name).split('.').pop().toLowerCase()] || 'application/octet-stream'
export function safeAttachmentName(original = 'audio.m4a') {
  const extension = String(original).split('.').pop().toLowerCase()
  return `audio-${crypto.randomUUID()}.${/^[a-z0-9]{1,8}$/.test(extension) ? extension : 'bin'}`
}

// Validation is shared with the upload API. Reading never replaces unknown fields.
// Unsupported future URI schemes can be retained on reads; writing refuses them.
export function validate(m, fileNames, { pageCount, forWriting = false } = {}) {
  const errors = []
  if (!record(m)) return ['manifest must be an object']
  if (typeof m.mpdf !== 'string' || !m.mpdf.startsWith('1.') || m.mpdf.length > 32) errors.push('mpdf must be "1.x"')
  const checkString = (value, path) => { if (value != null && (typeof value !== 'string' || encoder.encode(value).length > 4096)) errors.push(`${path} must be a string of at most 4096 bytes`) }
  checkString(m.title, 'title')
  const tracks = Array.isArray(m.tracks) && m.tracks.length > 0 && m.tracks.length <= 256 ? m.tracks : (errors.push('트랙은 1~256개 필요합니다'), [])
  const ids = new Set(), byID = new Map()
  tracks.forEach((t, i) => {
    const path = `tracks[${i}]`
    if (!record(t)) { errors.push(`${path} invalid`); return }
    if (typeof t.id !== 'string' || !ID_RE.test(t.id) || ids.has(t.id)) errors.push(`${path}.id invalid or duplicate`)
    ids.add(t.id); byID.set(t.id, t)
    checkString(t.title, `${path}.title`); checkString(t.artist, `${path}.artist`)
    if (typeof t.src !== 'string' || !t.src || encoder.encode(t.src).length > 4096) errors.push(`${path}.src missing or too long`)
    else if (t.src.startsWith('file:')) {
      const key = t.src.slice(5)
      if (!safeKey(key) || RESERVED_AUDIO.has(key)) errors.push(`${path}.src invalid attachment`)
      if (fileNames && !fileNames.includes(key)) errors.push(`missing file ${key}`)
    } else if (t.src.startsWith('youtube:')) {
      if (!/^[A-Za-z0-9_-]{11}$/.test(t.src.slice(8))) errors.push(`${path}.src invalid YouTube ID`)
    } else if (t.src.startsWith('https:')) {
      try { const u = new URL(t.src); if (u.protocol !== 'https:' || !u.hostname || u.username || u.password) throw new Error(); } catch { errors.push(`${path}.src invalid HTTPS URL`) }
    } else if (forWriting) errors.push(`${path}.src unsupported`)
    if (t.start != null && (!finite(t.start) || t.start < 0)) errors.push(`${path}.start invalid`)
    if (t.end != null && (!finite(t.end) || t.end <= (t.start ?? 0))) errors.push(`${path}.end must be after start`)
  })
  function list(key, limit) {
    if (m[key] == null) return []
    if (!Array.isArray(m[key]) || m[key].length > limit) { errors.push(`${key} invalid or too many entries`); return [] }
    return m[key]
  }
  function pageTrack(item, path) {
    if (!Number.isInteger(item.page) || item.page < 1 || (pageCount != null && item.page > pageCount)) errors.push(`${path}.page invalid`)
    if (!ids.has(item.track)) errors.push(`${path}.track unknown`)
  }
  list('cues', 100000).forEach((c, i) => {
    if (!record(c)) { errors.push(`cues[${i}] invalid`); return }
    pageTrack(c, `cues[${i}]`)
    if (c.at != null && (!finite(c.at) || c.at < 0)) errors.push(`cues[${i}].at invalid`)
  })
  for (const key of ['buttons', 'timeMarkers']) {
    const used = new Set(), isMarker = key === 'timeMarkers'
    list(key, isMarker ? 2048 : 256).forEach((p, i) => {
      const path = `${key}[${i}]`
      if (!record(p)) { errors.push(`${path} invalid`); return }
      if (typeof p.id !== 'string' || !UUID_RE.test(p.id) || used.has(p.id)) errors.push(`${path}.id invalid or duplicate`)
      used.add(p.id); pageTrack(p, path)
      const min = isMarker ? 0 : 0.05, max = isMarker ? 1 : 0.95
      for (const axis of ['x', 'y']) if (!finite(p[axis]) || p[axis] < min || p[axis] > max) errors.push(`${path}.${axis} invalid`)
      if (isMarker) {
        const track = byID.get(p.track)
        if (!finite(p.seconds) || p.seconds < 0 || (track?.end != null && p.seconds > track.end - (track.start ?? 0))) errors.push(`${path}.seconds outside track`)
        if (p.choice != null && (typeof p.choice !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(p.choice))) errors.push(`${path}.choice invalid`)
      }
    })
  }
  if (m.web != null) {
    if (!record(m.web)) errors.push('web invalid')
    else {
      if (m.web.sourcePDFKey != null && !safeKey(m.web.sourcePDFKey)) errors.push('web.sourcePDFKey invalid')
      if (m.web.buttonRendering != null && !['baked', 'overlay'].includes(m.web.buttonRendering)) errors.push('web.buttonRendering invalid')
      if (m.web.sharedReadOnly != null && typeof m.web.sharedReadOnly !== 'boolean') errors.push('web.sharedReadOnly invalid')
    }
  }
  if (m.options != null) {
    if (!record(m.options)) errors.push('options invalid')
    else for (const key of ['autoplay', 'followPage', 'loop']) if (m.options[key] != null && typeof m.options[key] !== 'boolean') errors.push(`options.${key} invalid`)
  }
  return errors
}

function parseAttachment(files, key, limit, errors) {
  if (!Object.hasOwn(files, key)) return null
  try {
    if (files[key].byteLength > limit) throw new Error('too large')
    const value = JSON.parse(decoder.decode(files[key]))
    if (!record(value)) throw new Error('not an object')
    return value
  } catch { errors.push(`${key}: invalid metadata`); return null }
}

// Metadata is an unverified claim. Only SEETO's registry + exact file hash can
// authorize a creator revision; sharedReadOnly always takes precedence.
export function inspectPublication(files = {}, manifest = {}) {
  const errors = []
  const publication = parseAttachment(files, PUBLICATION, 4 * 1024 * 1024, errors)
  const score = parseAttachment(files, SCORE, 16 * 1024 * 1024, errors)
  const publicationErrors = []
  if (publication) {
    if (publication.version !== 1) publicationErrors.push(`${PUBLICATION}: unsupported version`)
    if (!finite(publication.sourceStartSeconds) || publication.sourceStartSeconds < 0 || publication.sourceStartSeconds > 86400) publicationErrors.push(`${PUBLICATION}: sourceStartSeconds invalid`)
    if (publication.tempo != null && (!Number.isInteger(publication.tempo) || publication.tempo <= 0 || publication.tempo > 400)) publicationErrors.push(`${PUBLICATION}: tempo invalid`)
    if (publication.audioSyncMap != null) {
      const map = publication.audioSyncMap, anchors = map?.anchors
      let invalid = !record(map) || !Array.isArray(anchors) || anchors.length < 2 || anchors.length > 20000
      if (!invalid) {
        invalid = anchors[0]?.tick !== 0
        let previousTick = -1, previousSeconds = -1
        for (const a of anchors) {
          if (!record(a) || !finite(a.tick) || a.tick < 0 || a.tick <= previousTick || !finite(a.seconds) || a.seconds < 0 || a.seconds > 86400 || a.seconds <= previousSeconds) { invalid = true; break }
          previousTick = a.tick; previousSeconds = a.seconds
        }
        if (map.confidence != null && (!finite(map.confidence) || map.confidence < 0 || map.confidence > 1)) invalid = true
        if (map.origin != null && !['automatic', 'manual'].includes(map.origin)) invalid = true
        if (!invalid && map.pinnedTicks != null) {
          if (!Array.isArray(map.pinnedTicks) || map.pinnedTicks.length > anchors.length) invalid = true
          else {
            let previous = -1, index = 0
            for (const tick of map.pinnedTicks) {
              if (!finite(tick) || tick < 0 || tick <= previous) { invalid = true; break }
              while (index < anchors.length && anchors[index].tick < tick) index++
              if (index >= anchors.length || Math.abs(anchors[index].tick - tick) > .000001) { invalid = true; break }
              previous = tick
            }
          }
        }
      }
      if (invalid) publicationErrors.push(`${PUBLICATION}: audioSyncMap invalid`)
    }
    for (const key of ['sourcePDFKey', 'editableMarkupKey']) if (publication[key] != null && !safeKey(publication[key])) publicationErrors.push(`${PUBLICATION}: ${key} invalid`)
    if (publication.sharedReadOnly != null && typeof publication.sharedReadOnly !== 'boolean') publicationErrors.push(`${PUBLICATION}: sharedReadOnly invalid`)
    for (const key of ['scoreTrackID', 'chordTrackID', 'sourceTrackID']) if (publication[key] != null && (typeof publication[key] !== 'string' || !ID_RE.test(publication[key]))) publicationErrors.push(`${PUBLICATION}: ${key} invalid`)
  }
  errors.push(...publicationErrors)
  const attachment = key => {
    if (typeof key !== 'string' || !Object.hasOwn(files, key)) return null
    const value = files[key]
    return value instanceof Uint8Array ? value : value instanceof ArrayBuffer ? new Uint8Array(value) : null
  }
  const privateNames = new Set(PRIVATE_FILES)
  for (const key of [publication?.sourcePDFKey, publication?.editableMarkupKey, manifest.web?.sourcePDFKey]) if (typeof key === 'string') privateNames.add(key)
  return {
    publication: publicationErrors.length ? null : publication, score,
    sourcePdf: attachment(publication?.sourcePDFKey || manifest.web?.sourcePDFKey || 'mpdf-web-source.pdf'),
    editingPdf: attachment('seetogether-editing.pdf'),
    markup: attachment(publication?.editableMarkupKey),
    privateFileNames: [...privateNames].filter(key => Object.hasOwn(files, key)),
    errors,
  }
}

// This is explicit sharing, not a lossless save. Preserve finalized score data
// like the native app does; remove clean source PDFs and editable drawing data.
export function prepareSharedFiles(manifest, files = {}) {
  const next = clone(manifest), kept = Object.assign(Object.create(null), files)
  const info = inspectPublication(files, manifest)
  if (info.errors.length) throw new Error(info.errors.join('; '))
  const removed = [...info.privateFileNames]
  for (const key of removed) delete kept[key]
  if ((next.tracks || []).some(t => t.src?.startsWith('file:') && removed.includes(t.src.slice(5)))) throw new Error('편집 원본을 음원으로 사용할 수 없습니다.')
  if (info.publication) {
    const p = { ...info.publication, id: crypto.randomUUID(), createdAt: Date.now() / 1000 - 978307200, sharedReadOnly: true }
    delete p.sourcePDFKey; delete p.editableMarkupKey
    kept[PUBLICATION] = encoder.encode(JSON.stringify(p))
  }
  next.web = { ...(record(next.web) ? next.web : {}), sharedReadOnly: true }
  delete next.web.sourcePDFKey
  return { manifest: next, files: kept, removed }
}

// Opt-in migration for legacy Unicode/path-incompatible audio keys. Unknown
// attachments are retained. Call only while authoring an explicitly new revision.
export function normalizeAttachmentNames(manifest, files = {}) {
  const next = clone(manifest), kept = Object.assign(Object.create(null), files), renamed = {}
  for (const track of next.tracks || []) {
    if (!track.src?.startsWith('file:')) continue
    const key = track.src.slice(5)
    if (/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(key) && !key.includes('..')) continue
    if (!Object.hasOwn(kept, key) && !renamed[key]) throw new Error(`missing file ${key}`)
    if (!renamed[key]) { renamed[key] = safeAttachmentName(key); kept[renamed[key]] = kept[key]; delete kept[key] }
    track.src = 'file:' + renamed[key]
  }
  // Score source.filename is a portable attachment key, not a local path.
  if (kept[SCORE] && Object.keys(renamed).length) {
    const errors = [], score = parseAttachment(kept, SCORE, 16 * 1024 * 1024, errors)
    if (score?.source?.filename && renamed[score.source.filename]) { score.source.filename = renamed[score.source.filename]; kept[SCORE] = encoder.encode(JSON.stringify(score)) }
  }
  return { manifest: next, files: kept, renamed, removed: Object.keys(renamed) }
}

function pdfLib() {
  const lib = globalThis.PDFLib || globalThis.window?.PDFLib
  if (!lib) throw new Error('PDF 저장 도구를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.')
  return lib
}
function attachmentEntries(doc, lib) {
  const { PDFName, PDFDict, PDFArray } = lib
  const names = doc.catalog.lookupMaybe(PDFName.of('Names'), PDFDict)
  const tree = names?.lookupMaybe(PDFName.of('EmbeddedFiles'), PDFDict)
  const seen = new Set(), result = []
  function walk(node) {
    if (!node || seen.has(node)) return
    seen.add(node)
    const entries = node.lookupMaybe(PDFName.of('Names'), PDFArray)
    if (entries) for (let i = 0; i + 1 < entries.size(); i += 2) {
      const key = entries.lookup(i).decodeText(), ref = entries.get(i + 1)
      const spec = entries.lookupMaybe(i + 1, PDFDict)
      if (spec) result.push({ key, ref, spec })
    }
    const kids = node.lookupMaybe(PDFName.of('Kids'), PDFArray)
    if (kids) for (let i = 0; i < kids.size(); i++) walk(kids.lookupMaybe(i, PDFDict))
  }
  walk(tree)
  return { names, tree, entries: result }
}
function scrubPageAttachments(doc, lib) {
  const { PDFName, PDFArray, PDFDict } = lib
  for (const page of doc.getPages()) {
    page.node.delete(PDFName.of('AF'))
    const annots = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray)
    if (!annots) continue
    for (let i = annots.size() - 1; i >= 0; i--) {
      const annotation = annots.lookupMaybe(i, PDFDict)
      const subtype = annotation?.get(PDFName.of('Subtype'))?.toString()
      if (['/FileAttachment', '/RichMedia', '/Movie', '/Sound', '/Screen'].includes(subtype)) annots.remove(i)
      else { annotation?.delete(PDFName.of('AF')); annotation?.delete(PDFName.of('FS')) }
    }
  }
}
async function pagesOnly(bytes, lib) {
  const input = await lib.PDFDocument.load(bytes, { updateMetadata: false })
  if (input.isEncrypted) throw new Error('암호화된 PDF는 먼저 암호를 해제해 주세요.')
  scrubPageAttachments(input, lib)
  const output = await lib.PDFDocument.create()
  for (const page of await output.copyPages(input, input.getPageIndices())) output.addPage(page)
  return output
}

// A fresh document is important: merely unlinking EmbeddedFiles leaves private
// attachment streams in pdf-lib's serialized object table.
export async function exportPlainPdf(bytes) { return (await pagesOnly(bytes, pdfLib())).save() }

// Lossless attachment preservation by default. Existing unknown FileSpecs and
// bytes survive; only explicit removeFiles and replacement keys are changed.
// shared:true creates a fresh page document so removed private streams cannot
// remain in the serialized PDF. Always pass it after prepareSharedFiles too.
export async function createMpdf(pdfBytes, manifest, files = {}, { replace = false, removeFiles = [], shared = false } = {}) {
  const lib = pdfLib(), { PDFDocument, PDFName, PDFDict, PDFArray, PDFHexString } = lib
  let nextManifest = manifest, nextFiles = Object.assign(Object.create(null), files)
  let doc = await PDFDocument.load(pdfBytes, { updateMetadata: false })
  if (doc.isEncrypted) throw new Error('암호화된 PDF는 먼저 암호를 해제해 주세요.')
  let existing = attachmentEntries(doc, lib)
  if (existing.entries.some(e => e.key === MANIFEST) && !replace) throw new Error('이미 음악이 붙은 PDF입니다')
  if (shared) {
    // Derive private keys from the original container too: callers may already
    // have sanitized the metadata they pass in, but the input PDF still has it.
    const originalMetadata = Object.create(null)
    let originalManifest = {}
    for (const entry of existing.entries) if ([MANIFEST, PUBLICATION].includes(entry.key)) {
      const ef = entry.spec.lookupMaybe(PDFName.of('EF'), PDFDict)
      const stream = ef && (ef.lookupMaybe(PDFName.of('UF'), lib.PDFStream) || ef.lookupMaybe(PDFName.of('F'), lib.PDFStream))
      if (stream) {
        const content = lib.decodePDFRawStream(stream).decode()
        if (content.byteLength > 4 * 1024 * 1024) throw new Error('MPDF 메타데이터가 너무 큽니다.')
        if (entry.key === MANIFEST) originalManifest = JSON.parse(decoder.decode(content))
        else originalMetadata[entry.key] = content
      }
    }
    const originalInfo = inspectPublication(originalMetadata, originalManifest)
    if (originalInfo.errors.length) throw new Error(originalInfo.errors.join('; '))
    const originalPrivate = new Set([...PRIVATE_FILES, originalInfo.publication?.sourcePDFKey, originalInfo.publication?.editableMarkupKey, originalManifest.web?.sourcePDFKey].filter(Boolean))
    for (const key of originalPrivate) delete nextFiles[key]
    // Collect unprovided attachments before sanitizing. This is the only mode
    // that intentionally removes private sources from a newly created copy.
    for (const entry of existing.entries) if (entry.key !== MANIFEST && !Object.hasOwn(nextFiles, entry.key) && !removeFiles.includes(entry.key) && !originalPrivate.has(entry.key)) {
      const ef = entry.spec.lookupMaybe(PDFName.of('EF'), PDFDict)
      const stream = ef && (ef.lookupMaybe(PDFName.of('UF'), lib.PDFStream) || ef.lookupMaybe(PDFName.of('F'), lib.PDFStream))
      if (stream) nextFiles[entry.key] = lib.decodePDFRawStream(stream).decode()
    }
    const result = prepareSharedFiles(nextManifest, nextFiles)
    nextManifest = result.manifest; nextFiles = result.files
    doc = await pagesOnly(pdfBytes, lib); existing = attachmentEntries(doc, lib)
  }
  const removed = new Set([MANIFEST, ...removeFiles, ...Object.keys(nextFiles)])
  const kept = existing.entries.filter(e => !removed.has(e.key))
  const fileNames = [...new Set([...kept.map(e => e.key), ...Object.keys(nextFiles)])]
  const errors = validate(nextManifest, fileNames, { pageCount: doc.getPageCount(), forWriting: true })
  if (errors.length) throw new Error(errors.join('; '))
  if (encoder.encode(JSON.stringify(nextManifest)).length > 1024 * 1024) throw new Error('MPDF 재생 정보가 너무 큽니다.')
  for (const key of Object.keys(nextFiles)) if (key === MANIFEST || !safeKey(key)) throw new Error(`첨부 파일 이름을 확인해 주세요: ${key}`)
  // Drop replaced streams physically, while preserving any stream still used by
  // another attachment. Removed FileSpecs are also removed from catalog AF.
  const protectedRefs = new Set(), protectedSpecs = new Set(kept.map(e => e.ref.toString()))
  for (const entry of kept) {
    const ef = entry.spec.lookupMaybe(PDFName.of('EF'), PDFDict)
    for (const [, ref] of ef?.entries() || []) protectedRefs.add(ref.toString())
  }
  const removedSpecs = new Set()
  for (const entry of existing.entries) if (removed.has(entry.key)) {
    if (!protectedSpecs.has(entry.ref.toString())) removedSpecs.add(entry.ref.toString())
    const ef = entry.spec.lookupMaybe(PDFName.of('EF'), PDFDict)
    for (const [, ref] of ef?.entries() || []) if (ref instanceof lib.PDFRef && !protectedRefs.has(ref.toString())) doc.context.delete(ref)
    if (entry.ref instanceof lib.PDFRef && !protectedSpecs.has(entry.ref.toString())) doc.context.delete(entry.ref)
  }
  const af = doc.catalog.lookupMaybe(PDFName.of('AF'), PDFArray)
  if (af) for (let i = af.size() - 1; i >= 0; i--) if (removedSpecs.has(af.get(i).toString())) af.remove(i)
  let names = existing.names
  if (!names) { names = doc.context.obj({}); doc.catalog.set(PDFName.of('Names'), names) }
  names.set(PDFName.of('EmbeddedFiles'), doc.context.obj({ Names: kept.flatMap(e => [PDFHexString.fromText(e.key), e.ref]) }))
  await doc.attach(encoder.encode(JSON.stringify(nextManifest, null, 2)), MANIFEST, { mimeType: 'application/json', description: 'MPDF manifest' })
  for (const [name, bytes] of Object.entries(nextFiles)) await doc.attach(bytes, name, { mimeType: mimeOf(name) })
  await doc.flush()
  const final = attachmentEntries(doc, lib)
  final.names.set(PDFName.of('EmbeddedFiles'), doc.context.obj({ Names: final.entries.sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0).flatMap(e => [PDFHexString.fromText(e.key), e.ref]) }))
  return doc.save()
}

// Read using PDF.js. Preserve the complete manifest and attachment map, without
// mapping tracks into a smaller model or inventing new track/control IDs.
export async function readMpdf(pdfjsDoc) {
  const attachments = (await pdfjsDoc.getAttachments()) || {}
  const raw = attachments[MANIFEST]
  if (!raw) return null
  if (raw.content.byteLength > 1024 * 1024) throw new Error('MPDF 재생 정보가 너무 큽니다.')
  let manifest
  try { manifest = JSON.parse(decoder.decode(raw.content)) } catch { throw new Error('MPDF 재생 정보를 읽을 수 없습니다.') }
  if (!record(manifest) || typeof manifest.mpdf !== 'string' || !manifest.mpdf.startsWith('1.')) throw new Error('지원하지 않는 MPDF 버전입니다.')
  const files = Object.create(null)
  for (const [name, f] of Object.entries(attachments)) if (name !== MANIFEST) files[name] = f.content
  const info = inspectPublication(files, manifest)
  return { manifest, files, ...info, validationErrors: validate(manifest, Object.keys(files), { pageCount: pdfjsDoc.numPages }) }
}

// Draw printable controls once onto the clean source. Coordinates use PDF.js's
// rotated crop-box viewport, matching normalized native MPDF page coordinates.
export async function renderPageButtons(bytes, buttons = [], { guideURL = 'https://mpdf.pages.dev/v/' } = {}) {
  const lib = pdfLib(), { PDFDocument, PDFName, PDFArray, rgb } = lib
  const doc = await PDFDocument.load(bytes, { updateMetadata: false })
  const destination = new URL(guideURL)
  if (destination.protocol !== 'https:') throw new Error('재생 안내 주소는 HTTPS여야 합니다.')
  const font = await doc.embedFont(lib.StandardFonts.HelveticaBold)
  for (const b of buttons) {
    if (!Number.isInteger(b.page) || b.page < 1 || b.page > doc.getPageCount() || !finite(b.x) || !finite(b.y)) throw new Error('재생 버튼 위치를 확인해 주세요.')
    const page = doc.getPage(b.page - 1), box = page.getCropBox()
    const rotation = ((page.getRotation().angle % 360) + 360) % 360
    const width = rotation % 180 ? box.height : box.width, height = rotation % 180 ? box.width : box.height
    const size = width * 0.065, cx = width * b.x, cy = height * b.y, glyphY = cy - size * .19
    function point(x, y) {
      if (rotation === 90) return [box.x + y, box.y + x]
      if (rotation === 180) return [box.x + box.width - x, box.y + y]
      if (rotation === 270) return [box.x + box.width - y, box.y + box.height - x]
      return [box.x + x, box.y + box.height - y]
    }
    // Transform a top-left viewport into PDF space; drawing stays vector-based.
    const [x0, y0] = point(cx - size / 2, glyphY + size / 2)
    const [x1, y1] = point(cx + size / 2, glyphY + size / 2)
    const [x2, y2] = point(cx - size / 2, glyphY - size / 2)
    page.pushOperators(lib.pushGraphicsState(), lib.concatTransformationMatrix((x1-x0)/size, (y1-y0)/size, (x2-x0)/size, (y2-y0)/size, x0, y0))
    page.drawCircle({ x: size / 2, y: size / 2, size: size / 2, color: rgb(1, .93, .86), borderColor: rgb(.92, .40, .09), borderWidth: .8 })
    page.drawSvgPath(`M ${size*.40} ${size*.25} L ${size*.40} ${size*.69} L ${size*.76} ${size*.47} Z`, { x: 0, y: size, color: rgb(.86, .31, .055) })
    page.drawText('MPDF', { x: size*.03, y: -size*.32, size: size*.28, font, color: rgb(.68,.25,.055) })
    page.pushOperators(lib.popGraphicsState())
    const corners = [point(cx-size/2, cy-size*.69), point(cx+size/2, cy+size*.69)]
    const rect = [Math.min(corners[0][0],corners[1][0]), Math.min(corners[0][1],corners[1][1]), Math.max(corners[0][0],corners[1][0]), Math.max(corners[0][1],corners[1][1])]
    const annotation = doc.context.register(doc.context.obj({ Type: 'Annot', Subtype: 'Link', Rect: rect, Border: [0,0,0], A: { Type: 'Action', S: 'URI', URI: lib.PDFString.of(destination.toString()) } }))
    let annots = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray)
    if (!annots) { annots = doc.context.obj([]); page.node.set(PDFName.of('Annots'), annots) }
    annots.push(annotation)
  }
  return doc.save()
}

export function parseYouTube(s) {
  s = String(s || '').trim()
  const valid = (id) => /^[A-Za-z0-9_-]{11}$/.test(id || '') ? id : null
  if (valid(s)) return s
  try {
    const u = new URL(s)
    if (!['https:', 'http:'].includes(u.protocol)) return null
    if (u.hostname === 'youtu.be' || u.hostname === 'www.youtu.be') return valid(u.pathname.slice(1).split('/')[0])
    if (/(^|\.)youtube\.com$/.test(u.hostname) || /(^|\.)youtube-nocookie\.com$/.test(u.hostname)) return valid(u.searchParams.get('v')) || valid(u.pathname.match(/^\/(shorts|embed|live|v)\/([^/]+)/)?.[2])
  } catch {}
  return null
}
export const parseTime = (s) => {
  const text = String(s ?? '').trim()
  if (!text) return null
  const parts = text.split(':')
  if (parts.length > 3 || parts.some((part, i) => !(i === parts.length - 1 ? /^\d+(?:\.\d+)?$/ : /^\d+$/).test(part))) return null
  if (parts.length > 1 && parts.slice(1).some(part => Number(part) >= 60)) return null
  const result = parts.reduce((total, part) => total * 60 + Number(part), 0)
  return Number.isFinite(result) ? result : null
}
export const fmtTime = (t) => { t = Math.max(0, Math.floor(Number.isFinite(t) ? t : 0)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` }
export function rangesOf(cues = [], pageCount) {
  const seen = new Set()
  const sorted = cues.filter(c => c && Number.isInteger(c.page) && c.page > 0 && !seen.has(c.page) && seen.add(c.page)).sort((a,b) => a.page-b.page)
  return sorted.map((c,i) => ({ ...c, from:c.page, to:sorted[i+1] ? sorted[i+1].page-1 : pageCount }))
}
export const TRACK_COLORS = ['#ed762f', '#249d91', '#8e74bb', '#c39227', '#d96083', '#4d94bd']
