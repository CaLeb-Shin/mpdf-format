// Runs the three functions against a fake R2 + ASSETS. `npm test` in site/.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { onRequestPost as upload } from './api/upload.js'
import { onRequestGet as file } from './f/[id].js'
import { onRequestGet as view } from './v/[id].js'

const store = new Map()
const env = {
  MPDF_FILES: {
    put: async (k, v, o) => { store.set(k, { body: v, ...o }) },
    get: async (k) => { const o = store.get(k); return o && { body: o.body, customMetadata: o.customMetadata, httpEtag: '"x"' } },
    head: async (k) => { const o = store.get(k); return o && { customMetadata: o.customMetadata } },
  },
  ASSETS: { fetch: async () => new Response(readFileSync(new URL('../v/index.html', import.meta.url), 'utf8')) },
}
const post = (bytes) => upload({ env, request: new Request('https://mpdf.example/api/upload', { method: 'POST', body: bytes, headers: { 'content-type': 'application/pdf' } }) })
const sample = (n) => readFileSync(new URL('../../samples/' + n, import.meta.url))

let r = await post(sample('score.pdf')); assert.equal(r.status, 400); assert.equal((await r.json()).error, 'not_mpdf')
r = await post(sample('mixed.mpdf')); assert.equal(r.status, 400); assert.equal((await r.json()).error, 'embedded_audio')
r = await post(new TextEncoder().encode('hello')); assert.equal((await r.json()).error, 'not_pdf')
r = await post(sample('youtube-only.mpdf')); assert.equal(r.status, 200)
const { id, url } = await r.json(); assert.match(id, /^[A-Za-z0-9]{10}$/); assert.equal(url, 'https://mpdf.example/v/' + id)

r = await file({ env, params: { id }, request: new Request('https://mpdf.example/f/' + id) })
assert.equal(r.headers.get('content-type'), 'application/pdf'); assert.match(r.headers.get('content-disposition'), /^inline; filename\*=UTF-8''/)
assert.equal((await r.arrayBuffer()).byteLength, sample('youtube-only.mpdf').length)
r = await file({ env, params: { id }, request: new Request('https://mpdf.example/f/' + id + '?download') }); assert.match(r.headers.get('content-disposition'), /^attachment/)
r = await file({ env, params: { id: 'nope' }, request: new Request('https://mpdf.example/f/nope') }); assert.equal(r.status, 404)

r = await view({ env, params: { id }, request: new Request('https://mpdf.example/v/' + id) })
const html = await r.text()
assert.match(html, /<meta property="og:title" content="Sample: YouTube links only">/)
assert.match(html, /4 pages · 2 tracks/); assert.match(html, /og:image" content="https:\/\/mpdf.example\/og.png"/)
const kr = await (await view({ env, params: { id }, request: new Request('https://mpdf.example/v/' + id, { headers: { 'accept-language': 'ko-KR,ko;q=0.9' } }) })).text()
assert.match(kr, /4쪽 · 2곡/); assert.match(kr, /og-ko.png/)
assert.match(html, /<title>Sample: YouTube links only · MPDF<\/title>/)
r = await view({ env, params: { id: 'zzzzzzzzzz' }, request: new Request('https://mpdf.example/v/zzzzzzzzzz') }); assert.equal(r.status, 404)
console.log('functions: all ok (' + id + ')')
