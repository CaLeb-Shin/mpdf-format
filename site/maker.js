import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs'
import { createMpdf, readMpdf, parseYouTube, parseTime, fmtTime, rangesOf, TRACK_COLORS } from './mpdf-browser.js'
import { mountAds } from './ads.js'
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs'
mountAds()

const $ = (s) => document.querySelector(s)
const state = { name: '', bytes: null, pages: 0, thumbs: [], tracks: [], files: {}, cues: {}, seq: 0, existing: false }
const setStatus = (msg, err = false) => { const el = $('#status'); el.textContent = msg; el.classList.toggle('err', err) }
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
if (param) fetch(param).then((r) => r.arrayBuffer()).then((b) => loadPdf(new File([b], param.split('/').pop()))).catch(() => setStatus('파일을 불러오지 못했습니다', true))

async function loadPdf(file) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let doc
  try { doc = await pdfjsLib.getDocument({ data: bytes.slice() }).promise } catch { return setStatus('PDF를 읽을 수 없습니다', true) }
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
    setStatus('이미 음악이 붙은 파일입니다. 기존 트랙과 페이지 지정을 불러왔습니다.')
  } else if (state.tracks.length) { state.cues[1] = { track: state.tracks[0].id, at: 0 }; setStatus(`${file.name} · ${doc.numPages}쪽`) }
  else setStatus(`${file.name} · ${doc.numPages}쪽 · 이제 유튜브 링크나 음원을 넣으세요`)
  drop.classList.add('loaded')
  drop.innerHTML = `<div class="thumb"></div><strong>${esc(file.name)}</strong><small>${doc.numPages}쪽 · 클릭해서 바꾸기</small>`
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
  if (!id) return setStatus('유튜브 링크가 아닙니다. 예: https://youtu.be/dQw4w9WgXcQ', true)
  addTrack({ title: `유튜브 ${id}`, src: 'youtube:' + id }); $('#yt-url').value = ''; setStatus('트랙을 넣었습니다. 제목을 눌러 곡 이름으로 바꿔 두세요.')
}
$('#yt-add').onclick = addYouTube
$('#yt-url').onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); addYouTube() } }
$('#audio-input').onchange = async (e) => { for (const f of e.target.files) await addAudioFile(f); e.target.value = '' }
async function addAudioFile(f) {
  if (!/^audio\//.test(f.type) && !/\.(m4a|mp3|wav|aac|ogg)$/i.test(f.name)) return setStatus(`${f.name}: 음원 파일이 아닙니다`, true)
  let name = f.name.replace(/[^\w.\-가-힣]/g, '_'), n = 1
  while (state.files[name]) name = name.replace(/(\.\w+)$/, `-${++n}$1`)
  state.files[name] = new Uint8Array(await f.arrayBuffer())
  addTrack({ title: f.name.replace(/\.[^.]+$/, ''), src: 'file:' + name })
  setStatus(`${f.name} · ${(f.size / 1048576).toFixed(1)} MB를 파일에 넣습니다`)
}
function removeTrack(id) {
  const t = state.tracks.find((x) => x.id === id); if (!t) return
  state.tracks = state.tracks.filter((x) => x.id !== id)
  if (t.src.startsWith('file:')) delete state.files[t.src.slice(5)]
  for (const p of Object.keys(state.cues)) if (state.cues[p].track === id) delete state.cues[p]
  renderAll()
}
function renderTracks() {
  const box = $('#tracks'); box.innerHTML = ''
  if (!state.tracks.length) { box.innerHTML = '<div class="step-label" style="padding: 6px 0;">아직 트랙이 없습니다</div>'; return }
  for (const t of state.tracks) {
    const row = document.createElement('div'); row.className = 'track'
    const src = t.src.startsWith('youtube:') ? '유튜브 · ' + t.src.slice(8) : t.src.startsWith('file:') ? '음원 · ' + t.src.slice(5) : t.src
    row.innerHTML = `<span class="dot" style="background:${t.color}"></span><input value="${esc(t.title || '')}" placeholder="곡 제목" aria-label="곡 제목"><span class="src">${esc(src)}</span><button class="x" aria-label="삭제">×</button>`
    row.querySelector('input').oninput = (e) => { t.title = e.target.value; renderRanges() }
    row.querySelector('.x').onclick = () => removeTrack(t.id)
    box.appendChild(row)
  }
}

// ---- 03 page assignment -----------------------------------------------------
const cueList = () => Object.entries(state.cues).map(([p, c]) => ({ page: +p, track: c.track, at: c.at || 0 }))
function trackForPage(page) { const r = rangesOf(cueList(), state.pages).find((r) => page >= r.from && page <= r.to); return r && state.tracks.find((t) => t.id === r.track) }
function renderPages() {
  const wrap = $('#assign'); const show = state.pages && state.tracks.length
  wrap.classList.toggle('hidden', !show); if (!show) return
  const grid = $('#pages'); grid.innerHTML = ''
  for (let p = 1; p <= state.pages; p++) {
    const cue = state.cues[p]; const eff = trackForPage(p)
    const card = document.createElement('div'); card.className = 'pagecard'
    const opts = [`<option value="">${p === 1 ? '곡 없음' : '이어짐' + (eff ? ' · ' + esc(eff.title || eff.id) : '')}</option>`]
      .concat(state.tracks.map((t) => `<option value="${t.id}" ${cue && cue.track === t.id ? 'selected' : ''}>${esc(t.title || t.id)}</option>`)).join('')
    card.innerHTML = `<div class="pg" style="border-top-color:${eff ? eff.color : 'var(--line-2)'}${cue ? '' : ';border-top-style:dashed'}"><span class="n">${p}</span></div>
      <select aria-label="${p}페이지 곡">${opts}</select>
      <div class="at ${cue ? '' : 'hidden'}"><span>시작</span><input value="${cue ? fmtTime(cue.at) : '0:00'}" inputmode="numeric" aria-label="시작 위치"></div>`
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
    s.textContent = `${r.from === r.to ? r.from : r.from + '–' + r.to} · ${t.title || t.id}${r.at ? ' · ' + fmtTime(r.at) + '부터' : ''}`
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
  if (!state.bytes) return setStatus('PDF를 먼저 넣어 주세요', true)
  if (!state.tracks.length) return setStatus('트랙을 하나 이상 넣어 주세요', true)
  const used = {}; for (const t of state.tracks) if (t.src.startsWith('file:')) used[t.src.slice(5)] = state.files[t.src.slice(5)]
  try {
    setStatus('만드는 중…')
    const out = await createMpdf(state.bytes, manifest(), used, { replace: state.existing })
    const name = ($('#title').value.trim() || state.name).replace(/[\\/:*?"<>|]/g, '_') + '.' + ext
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([out], { type: 'application/pdf' })); a.download = name; a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 60000)
    setStatus(`${name} · ${(out.length / 1048576).toFixed(1)} MB 저장했습니다. 카톡·메일로 파일 그대로 보내면 됩니다.`)
  } catch (e) { setStatus(e.message, true) }
}
$('#save-pdf').onclick = () => save('pdf')
$('#save-mpdf').onclick = () => save('mpdf')
const BASE = location.pathname.replace(/\/(index\.html)?$/, '')
const ERR = { link_disabled: '링크 기능이 아직 켜지지 않았습니다. 지금은 PDF로 저장해 보내 주세요', too_large: '파일이 너무 큽니다 (최대 20MB)', not_pdf: 'PDF가 아닙니다', unreadable: 'PDF를 읽을 수 없습니다', not_mpdf: '트랙 정보가 없습니다', embedded_audio: '음원 파일이 들어 있는 파일은 링크로 공유할 수 없습니다' }
$('#link').onclick = async () => {
  if (!state.bytes) return setStatus('PDF를 먼저 넣어 주세요', true)
  if (!state.tracks.length) return setStatus('트랙을 하나 이상 넣어 주세요', true)
  if (state.tracks.some((t) => t.src.startsWith('file:'))) return setStatus('음원 파일이 들어 있으면 링크로 공유할 수 없습니다(음원을 서버에 두지 않습니다). 유튜브 트랙만 링크가 되고, 이 파일은 PDF로 저장해 보내 주세요.', true)
  try {
    setStatus('올리는 중…'); $('#link').disabled = true
    const out = await createMpdf(state.bytes, manifest(), {}, { replace: state.existing })
    const res = await fetch(BASE + '/api/upload', { method: 'POST', headers: { 'content-type': 'application/pdf' }, body: out })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(ERR[j.error] || '링크를 만들지 못했습니다 (' + res.status + ')')
    $('#linkurl').value = j.url; $('#openlink').href = j.url; $('#linkbox').classList.remove('hidden')
    setStatus('링크를 만들었습니다. 카톡에 붙여 넣으면 미리보기와 함께 열립니다.')
  } catch (e) { setStatus(e.message, true) } finally { $('#link').disabled = false }
}
$('#copy').onclick = async () => { try { await navigator.clipboard.writeText($('#linkurl').value); setStatus('링크를 복사했습니다') } catch { $('#linkurl').select(); setStatus('길게 눌러 복사하세요') } }
$('#share').onclick = async () => { const url = $('#linkurl').value; if (navigator.share) { try { await navigator.share({ title: $('#title').value || 'MPDF', url }) } catch {} } else $('#copy').click() }
