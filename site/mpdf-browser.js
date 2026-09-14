// MPDF in the browser. Needs pdf-lib loaded as a global (window.PDFLib, the UMD build). MIT.
const MANIFEST = 'mpdf.json'
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/
const MIME = { m4a: 'audio/mp4', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', aac: 'audio/aac' }
export const mimeOf = (name) => MIME[name.split('.').pop().toLowerCase()] || 'application/octet-stream'

export function validate(m, fileNames) {
  const e = []
  if (!m || typeof m !== 'object') return ['manifest must be an object']
  if (typeof m.mpdf !== 'string' || !m.mpdf.startsWith('1.')) e.push('mpdf must be "1.x"')
  const tracks = Array.isArray(m.tracks) && m.tracks.length ? m.tracks : (e.push('트랙이 하나 이상 필요합니다'), [])
  const ids = new Set()
  tracks.forEach((t, i) => {
    if (!t || typeof t.id !== 'string' || !ID_RE.test(t.id)) e.push(`tracks[${i}].id invalid`)
    else if (ids.has(t.id)) e.push(`tracks[${i}].id duplicate`)
    ids.add(t && t.id)
    if (!t || typeof t.src !== 'string' || !t.src) e.push(`tracks[${i}].src missing`)
    else if (fileNames && t.src.startsWith('file:') && !fileNames.includes(t.src.slice(5))) e.push(`missing file ${t.src.slice(5)}`)
  })
  ;(Array.isArray(m.cues) ? m.cues : []).forEach((c, i) => {
    c = c || {}
    if (!Number.isInteger(c.page) || c.page < 1) e.push(`cues[${i}].page invalid`)
    if (!ids.has(c.track)) e.push(`cues[${i}].track unknown`)
    if (c.at != null && !(typeof c.at === 'number' && c.at >= 0)) e.push(`cues[${i}].at invalid`)
  })
  return e
}

// Attach mpdf.json (+ files) to a PDF. replace: drop an existing EmbeddedFiles tree first (editing an MPDF).
export async function createMpdf(pdfBytes, manifest, files = {}, { replace = false } = {}) {
  const { PDFDocument, PDFName, PDFDict } = window.PDFLib
  const errors = validate(manifest, Object.keys(files))
  if (errors.length) throw new Error(errors.join('; '))
  const doc = await PDFDocument.load(pdfBytes, { updateMetadata: false, ignoreEncryption: true })
  const names = doc.catalog.lookupMaybe(PDFName.of('Names'), PDFDict)
  if (names && names.has(PDFName.of('EmbeddedFiles'))) {
    if (!replace) throw new Error('이미 음악이 붙은 PDF입니다')
    names.delete(PDFName.of('EmbeddedFiles'))
  }
  await doc.attach(new TextEncoder().encode(JSON.stringify(manifest, null, 2)), MANIFEST, { mimeType: 'application/json', description: 'MPDF manifest' })
  for (const [name, bytes] of Object.entries(files)) await doc.attach(bytes, name, { mimeType: mimeOf(name) })
  return doc.save()
}

// Read with pdf.js (already loaded in every page that renders): { manifest, files } or null.
export async function readMpdf(pdfjsDoc) {
  const att = (await pdfjsDoc.getAttachments()) || {}
  const raw = att[MANIFEST]
  if (!raw) return null
  let manifest
  try { manifest = JSON.parse(new TextDecoder().decode(raw.content)) } catch { return null }
  if (typeof manifest.mpdf !== 'string' || !manifest.mpdf.startsWith('1.')) return null
  const files = {}
  for (const [name, f] of Object.entries(att)) if (name !== MANIFEST) files[name] = f.content
  return { manifest, files }
}

// youtube URL or bare id -> id, else null
export function parseYouTube(s) {
  s = (s || '').trim()
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s
  try {
    const u = new URL(s)
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null
    if (/(^|\.)youtube\.com$/.test(u.hostname) || /(^|\.)youtube-nocookie\.com$/.test(u.hostname)) {
      const v = u.searchParams.get('v'); if (v) return v
      const m = u.pathname.match(/^\/(shorts|embed|live|v)\/([A-Za-z0-9_-]{11})/); if (m) return m[2]
    }
  } catch {}
  return null
}
export const parseTime = (s) => { const m = String(s || '').trim().match(/^(?:(\d+):)?(\d+(?:\.\d+)?)$/); return m ? (+(m[1] || 0)) * 60 + +m[2] : null }
export const fmtTime = (t) => { t = Math.max(0, Math.floor(t || 0)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` }
// ranges from cues: [{track, from, to}] — a cue runs until the next cue page (SPEC §2.3)
export function rangesOf(cues, pageCount) {
  const sorted = [...cues].sort((a, b) => a.page - b.page)
  return sorted.map((c, i) => ({ ...c, from: c.page, to: (sorted[i + 1] ? sorted[i + 1].page - 1 : pageCount) }))
}
export const TRACK_COLORS = ['#ff7a1a', '#2fc4b2', '#b48cff', '#ffd166', '#ff6b8b', '#7fd1ff']
