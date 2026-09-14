import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { createMpdf, readMpdf, validate } from './mpdf.js'

const pdf = await PDFDocument.create()
const font = await pdf.embedFont(StandardFonts.Helvetica)
for (let i = 1; i <= 3; i++) pdf.addPage([400, 500]).drawText(`Page ${i}`, { x: 40, y: 440, size: 30, font })
const plain = await pdf.save()
assert.equal(await readMpdf(plain), null, 'plain PDF is not MPDF')

const audio = new Uint8Array(1000).map((_, i) => i % 251)
const manifest = { mpdf: '1.0', title: 'Test', tracks: [{ id: 't1', src: 'youtube:dQw4w9WgXcQ', title: 'A' }, { id: 't2', src: 'file:tone.wav' }],
  cues: [{ page: 1, track: 't1' }, { page: 3, track: 't2', at: 1.5 }] }
const out = await createMpdf(plain, manifest, { 'tone.wav': audio })
const back = await readMpdf(out)
assert.deepEqual(back.manifest, manifest)
assert.deepEqual(back.files['tone.wav'], audio)
assert.equal((await PDFDocument.load(out)).getPageCount(), 3, 'still a 3-page PDF')
await assert.rejects(createMpdf(out, manifest, { 'tone.wav': audio }), /already/)
assert.equal(validate({ mpdf: '1.0', tracks: [{ id: 'x', src: 'file:missing.m4a' }], cues: [{ page: 0, track: 'nope' }] }, []).length, 3)

// cross-language: read the sample produced by python/mpdf.py, and leave one for python to read
const py = new URL('../samples/mixed.mpdf', import.meta.url)
if (existsSync(py)) {
  const r = await readMpdf(readFileSync(py))
  assert.equal(r.manifest.mpdf, '1.0'); assert.ok(r.files['tone-c5.wav'].length > 1000)
  console.log('js reads python sample: ok')
}
const score = new URL('../samples/score.pdf', import.meta.url)
if (existsSync(score)) writeFileSync(new URL('../samples/js-made.mpdf', import.meta.url),
  await createMpdf(readFileSync(score), { mpdf: '1.0', title: 'Made with pdf-lib', tracks: [{ id: 't1', src: 'youtube:dQw4w9WgXcQ' }] }))
console.log('js: all ok')
