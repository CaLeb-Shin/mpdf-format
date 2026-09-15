import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs'
import { createMpdf, readMpdf, parseYouTube, parseTime, fmtTime, rangesOf, TRACK_COLORS } from './mpdf-browser.js'
import { mountAds } from './ads.js'
import { t, offerKorean, mountLangButton } from './i18n.js'
const ROOT = new URL('.', import.meta.url).pathname.replace(/\/$/, '')
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs'
mountAds(); mountLangButton(); offerKorean()

const $ = (s) => document.querySelector(s)
const state = { name: '', bytes: null, pages: 0, thumbs: [], tracks: [], files: {}, cues: {}, seq: 0, existing: false }
const setStatus = (msg, err = false) => { const el = $('#status'); el.textContent = msg; el.classList.toggle('err', err) }
setStatus(t('status.idle'))
document.addEventListener('langchange', () => { setStatus(t('status.idle')); renderAll() })
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

// ---- 01 PDF -----------------------------------------------------------------
const drop = $('#drop'), pdfInput = $('#pdf-input')
drop.onclick = () => pdfInput.click()
drop.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pdfInput.click() } }
pdfInput.onchange = (e) => e.target.files[0] && loadPdf(e.target.files[0])
document.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over') })
document.addEventListener('dragleave', () => drop.classList.remove('over'))
document.addEventListener('drop', async (e) => {
  e.preventDefault(); drop.classList.remove('over')
  for (const f of e.dataTransfer.files) (/\.(pdf|mpdf)$/i.test(f.name) || f.type === 'application/pdf') ? await loadPdf(f) : await addAudioFile(f)
})
const param = new URLSearchParams(location.search).get('file')
if (param) fetch(param).then((r) => r.arrayBuffer()).then((b) => loadPdf(new File([b], param.split('/').pop()))).catch(() => setStatus(t('fetch.fail'), true))

async function loadPdf(file) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let doc
  try { doc = await pdfjsLib.getDocument({ data: bytes.slice() }).promise } catch { return setStatus(t('pdf.unreadable'), true) }
  state.bytes = bytes; state.name = file.name.replace(/\.(pdf|mpdf)$/i, ''); state.pages = doc.numPages
  state.thumbs = []; state.cues = {}; state.existing = false
  if (!$('#title').value) $('#title').value = state.name
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const vp0 = page.getViewport({ scale: 1 }); const vp = page.getViewport({ scale: 260 / vp0.width })
    const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height
    await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise
    state.thumbs.push(c)
  }
  const existing = await readMpdf(doc)
  if (existing) {
    state.existing = true; state.tracks = []; state.files = existing.files; state.seq = 0
    for (const t of existing.manifest.tracks) { state.seq++; state.tracks.push({ ...t, id: 't' + state.seq, color: TRACK_COLORS[(state.seq - 1) % TRACK_COLORS.length], _old: t.id }) }
    for (const c of existing.manifest.cues || []) { const t = state.tracks.find((x) => x._old === c.track); if (t) state.cues[c.page] = { track: t.id, at: c.at || 0 } }
    if (existing.manifest.title) $('#title').value = existing.manifest.title
    setStatus(t('pdf.existing'))
  } else if (state.tracks.length) { state.cues[1] = { track: state.tracks[0].id, at: 0 }; setStatus(t('pdf.loaded', { name: file.name, n: doc.numPages })) }
  else setStatus(t('pdf.loadedNext', { name: file.name, n: doc.numPages }))
  drop.classList.add('loaded')
  drop.innerHTML = `<div class="thumb"></div><strong>${esc(file.name)}</strong><small>${t('drop.change', { n: doc.numPages })}</small>`
  drop.querySelector('.thumb').appendChild(state.thumbs[0].cloneNode(true)).getContext('2d').drawImage(state.thumbs[0], 0, 0)
  renderAll()
}

// ---- 02 tracks --------------------------------------------------------------
function addTrack(t) {
  state.seq++
  state.tracks.push({ ...t, id: 't' + state.seq, color: TRACK_COLORS[(state.seq - 1) % TRACK_COLORS.length] })
  if (state.pages && !Object.keys(state.cues).length) state.cues[1] = { track: 't' + state.seq, at: 0 }
  renderAll()
}
function addYouTube() {
  const id = parseYouTube($('#yt-url').value)
  if (!id) return setStatus(t('yt.invalid'), true)
  addTrack({ title: `YouTube ${id}`, src: 'youtube:' + id }); $('#yt-url').value = ''; setStatus(t('yt.added'))
}
$('#yt-add').onclick = addYouTube
$('#yt-url').onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); addYouTube() } }
$('#audio-input').onchange = async (e) => { for (const f of e.target.files) await addAudioFile(f); e.target.value = '' }
async function addAudioFile(f) {
  if (!/^audio\//.test(f.type) && !/\.(m4a|mp3|wav|aac|ogg)$/i.test(f.name)) return setStatus(t('audio.notAudio', { name: f.name }), true)
  let name = f.name.replace(/[^\w.\-가-힣]/g, '_'), n = 1
  while (state.files[name]) name = name.replace(/(\.\w+)$/, `-${++n}$1`)
  state.files[name] = new Uint8Array(await f.arrayBuffer())
  addTrack({ title: f.name.replace(/\.[^.]+$/, ''), src: 'file:' + name })
  setStatus(t('audio.added', { name: f.name, mb: (f.size / 1048576).toFixed(1) }))
}
function removeTrack(id) {
  const t = state.tracks.find((x) => x.id === id); if (!t) return
  state.tracks = state.tracks.filter((x) => x.id !== id)
  if (t.src.startsWith('file:')) delete state.files[t.src.slice(5)]
  for (const p of Object.keys(state.cues)) if (state.cues[p].track === id) delete state.cues[p]
  renderAll()
}
const T = t
// "1–2,4" for a track, from its cues
function rangeText(id) { const rs = rangesOf(cueList(), state.pages).filter((r) => r.track === id); return rs.map((r) => (r.from === r.to ? r.from : r.from + '–' + r.to)).join(',') }
// Type "all", "3" or "3-5" next to a track: it starts on `from`; if `to` ends before the last page, the track that
// used to play there resumes on the next page, so the range really ends where the user said.
function assignPages(id, text) {
  if (!state.pages) return true
  const s = String(text).trim().toLowerCase().replace(/[–~]/g, '-')
  let from, to
  if (s === '' ) { for (const p of Object.keys(state.cues)) if (state.cues[p].track === id) delete state.cues[p]; renderAll(); return true }
  if (s === 'all' || s === '*' || s === '전체') { from = 1; to = state.pages }
  else { const mm = s.match(/^(\d+)\s*(?:-\s*(\d+))?$/); if (!mm) return false; from = +mm[1]; to = mm[2] ? +mm[2] : state.pages }
  if (from < 1 || to < from || from > state.pages) return false
  to = Math.min(to, state.pages)
  const before = trackForPage(from), after = trackForPage(Math.min(to + 1, state.pages))
  for (const p of Object.keys(state.cues)) { const n = +p; if (state.cues[p].track === id || (n > from && n <= to)) delete state.cues[p] }
  const keepAt = (state.cues[from] || {}).at || 0
  state.cues[from] = { track: id, at: keepAt }
  if (to < state.pages && !state.cues[to + 1]) { const back = after && after.id !== id ? after : (before && before.id !== id ? before : null); if (back) state.cues[to + 1] = { track: back.id, at: 0 } }
  renderAll(); return true
}
function renderTracks() {
  const box = $('#tracks'); box.innerHTML = ''
  if (!state.tracks.length) { box.innerHTML = `<div class="step-label" style="padding: 6px 0;">${t('tracks.none')}</div>`; return }
  for (const t of state.tracks) {
    const row = document.createElement('div'); row.className = 'track'
    const src = t.src.startsWith('youtube:') ? T('src.youtube', { id: t.src.slice(8) }) : t.src.startsWith('file:') ? T('src.file', { name: t.src.slice(5) }) : t.src
    row.innerHTML = `<span class="dot" style="background:${t.color}"></span><input value="${esc(t.title || '')}" placeholder="${T('track.title')}" aria-label="${T('track.title')}"><span class="src">${esc(src)}</span><input class="pg" value="${esc(rangeText(t.id))}" placeholder="${T('pages.placeholder')}" title="${T('pages.title')}" aria-label="${T('pages.title')}"><button class="x" aria-label="${T('track.remove')}">×</button>`
    row.querySelector('input').oninput = (e) => { t.title = e.target.value; renderRanges() }
    row.querySelector('.pg').onchange = (e) => { if (!assignPages(t.id, e.target.value)) { setStatus(T('pages.invalid'), true); e.target.value = rangeText(t.id) } }
    row.querySelector('.x').onclick = () => removeTrack(t.id)
    box.appendChild(row)
  }
}

// ---- 03 page assignment -----------------------------------------------------
const cueList = () => Object.entries(state.cues).map(([p, c]) => ({ page: +p, track: c.track, at: c.at || 0 }))
function trackForPage(page) { const r = rangesOf(cueList(), state.pages).find((r) => page >= r.from && page <= r.to); return r && state.tracks.find((t) => t.id === r.track) }
function renderPages() {
  const wrap = $('#assign'); const show = state.pages > 0
  wrap.classList.toggle('hidden', !show); if (!show) return
  wrap.querySelector('.assign-head p').style.opacity = state.tracks.length ? '' : '.7'
  const grid = $('#pages'); grid.innerHTML = ''
  for (let p = 1; p <= state.pages; p++) {
    const cue = state.cues[p]; const eff = trackForPage(p)
    const card = document.createElement('div'); card.className = 'pagecard'
    const opts = [`<option value="">${p === 1 ? t('page.none') : t('page.continues') + (eff ? ' · ' + esc(eff.title || eff.id) : '')}</option>`]
      .concat(state.tracks.map((t) => `<option value="${t.id}" ${cue && cue.track === t.id ? 'selected' : ''}>${esc(t.title || t.id)}</option>`)).join('')
    card.innerHTML = `<div class="pg" style="border-top-color:${eff ? eff.color : 'var(--line-2)'}${cue ? '' : ';border-top-style:dashed'}"><span class="n">${p}</span></div>
      <select aria-label="${t('page.aria', { p })}">${opts}</select>
      <div class="at ${cue ? '' : 'hidden'}"><span>${t('at.label')}</span><input value="${cue ? fmtTime(cue.at) : '0:00'}" inputmode="numeric" aria-label="${t('at.aria')}"></div>`
    const pg = card.querySelector('.pg'); const c = state.thumbs[p - 1].cloneNode(true); c.getContext('2d').drawImage(state.thumbs[p - 1], 0, 0); pg.prepend(c)
    card.querySelector('select').onchange = (e) => { if (e.target.value) state.cues[p] = { track: e.target.value, at: (state.cues[p] || {}).at || 0 }; else delete state.cues[p]; renderPages(); renderRanges() }
    card.querySelector('.at input').onchange = (e) => { const t = parseTime(e.target.value); if (t == null) { e.target.value = fmtTime(state.cues[p].at); return } state.cues[p].at = t; e.target.value = fmtTime(t); renderRanges() }
    grid.appendChild(card)
  }
}
function renderRanges() {
  const box = $('#ranges'); box.innerHTML = ''
  for (const r of rangesOf(cueList(), state.pages)) {
    const t = state.tracks.find((x) => x.id === r.track); if (!t) continue
    const s = document.createElement('span'); s.style.background = t.color
    s.textContent = `${r.from === r.to ? r.from : r.from + '–' + r.to} · ${t.title || t.id}${r.at ? ' · ' + T('range.from', { t: fmtTime(r.at) }) : ''}`
    box.appendChild(s)
  }
}
function renderAll() { renderTracks(); renderPages(); renderRanges() }
renderAll()

// ---- save -------------------------------------------------------------------
function manifest() {
  const cues = cueList().sort((a, b) => a.page - b.page).map((c) => (c.at ? c : { page: c.page, track: c.track }))
  return { mpdf: '1.0', title: $('#title').value.trim() || state.name, tracks: state.tracks.map(({ id, title, src }) => ({ id, title: title || undefined, src })), cues }
}
async function save(ext) {
  if (!state.bytes) return setStatus(t('save.noPdf'), true)
  if (!state.tracks.length) return setStatus(t('save.noTracks'), true)
  const used = {}; for (const t of state.tracks) if (t.src.startsWith('file:')) used[t.src.slice(5)] = state.files[t.src.slice(5)]
  try {
    setStatus(t('save.making'))
    const out = await createMpdf(state.bytes, manifest(), used, { replace: state.existing })
    const name = ($('#title').value.trim() || state.name).replace(/[\\/:*?"<>|]/g, '_') + '.' + ext
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([out], { type: 'application/pdf' })); a.download = name; a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 60000)
    setStatus(t('save.done', { name, mb: (out.length / 1048576).toFixed(1) }))
  } catch (e) { setStatus(e.message, true) }
}
$('#save-pdf').onclick = () => save('pdf')
$('#save-mpdf').onclick = () => save('mpdf')
$('#link').onclick = async () => {
  if (!state.bytes) return setStatus(t('save.noPdf'), true)
  if (!state.tracks.length) return setStatus(t('save.noTracks'), true)
  if (state.tracks.some((x) => x.src.startsWith('file:'))) return setStatus(t('link.audio'), true)
  try {
    setStatus(t('link.uploading')); $('#link').disabled = true
    const out = await createMpdf(state.bytes, manifest(), {}, { replace: state.existing })
    const res = await fetch(ROOT + '/api/upload', { method: 'POST', headers: { 'content-type': 'application/pdf' }, body: out })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(j.error && t('err.' + j.error) !== 'err.' + j.error ? t('err.' + j.error) : t('link.fail', { code: res.status }))
    $('#linkurl').value = j.url; $('#openlink').href = j.url; $('#linkbox').classList.remove('hidden')
    setStatus(t('link.done'))
  } catch (e) { setStatus(e.message, true) } finally { $('#link').disabled = false }
}
$('#copy').onclick = async () => { try { await navigator.clipboard.writeText($('#linkurl').value); setStatus(t('link.copied')) } catch { $('#linkurl').select(); setStatus(t('link.copyManual')) } }
$('#share').onclick = async () => { const url = $('#linkurl').value; if (navigator.share) { try { await navigator.share({ title: $('#title').value || 'MPDF', url }) } catch {} } else $('#copy').click() }
