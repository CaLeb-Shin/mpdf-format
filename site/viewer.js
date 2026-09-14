import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs'
import { readMpdf, fmtTime, rangesOf, TRACK_COLORS, mimeOf } from './mpdf-browser.js'
import { mountAds } from './ads.js'
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs'
mountAds()

const $ = (s) => document.querySelector(s)
const audio = $('#audio'), player = $('#player'), pagesEl = $('#pages')
const state = { bytes: null, name: '', manifest: null, files: {}, tracks: [], ranges: [], current: null, playing: false, page: 0, pageCount: 0, yt: null, ytReady: false, pendingYt: null, ytTimer: null }
const blobUrls = {}
const isMobile = () => matchMedia('(max-width: 720px)').matches
const PLAY = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8z"/></svg>'
const PAUSE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>'

// ---- open -------------------------------------------------------------------
$('#file').onchange = (e) => e.target.files[0] && open(e.target.files[0])
document.addEventListener('dragover', (e) => e.preventDefault())
document.addEventListener('drop', (e) => { e.preventDefault(); e.dataTransfer.files[0] && open(e.dataTransfer.files[0]) })
const idMatch = location.pathname.match(/\/v\/([A-Za-z0-9]{8,16})$/)
const base = location.pathname.slice(0, location.pathname.lastIndexOf('/v/'))
const src = idMatch ? `${base}/f/${idMatch[1]}` : new URLSearchParams(location.search).get('file')
if (src) fetch(src).then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer() }).then((b) => open(new File([b], (document.title.replace(/ · MPDF$/, '') || 'mpdf') + '.pdf')))
  .catch((e) => { $('#title').textContent = String(e.message) === '404' ? '없는 링크이거나 보관 기간이 지났습니다' : '파일을 불러오지 못했습니다'; $('#drop').classList.add('hidden') })
if (idMatch) { const b = $('#sharebtn'); b.classList.remove('hidden'); b.onclick = async () => { try { await navigator.clipboard.writeText(location.href); b.textContent = '복사됨' } catch { prompt('링크', location.href) } } }

async function open(file) {
  state.bytes = new Uint8Array(await file.arrayBuffer()); state.name = file.name.replace(/\.(pdf|mpdf)$/i, '')
  let pdf
  try { pdf = await pdfjsLib.getDocument({ data: state.bytes.slice() }).promise } catch { $('#title').textContent = 'PDF를 읽을 수 없습니다'; return }
  state.pageCount = pdf.numPages
  $('#dl').classList.remove('hidden')
  const r = await readMpdf(pdf)                       // show the player first, render pages after
  if (!r) { $('#title').textContent = state.name; $('#meta').textContent = `${pdf.numPages}쪽 · 음악 없음`; player.classList.add('hidden'); await renderPages(pdf); state.page = 1; return }
  state.manifest = r.manifest; state.files = r.files
  state.tracks = r.manifest.tracks.filter((t) => /^(youtube:|file:|https:)/.test(t.src || '')).map((t, i) => ({ ...t, color: TRACK_COLORS[i % TRACK_COLORS.length] }))
  state.ranges = rangesOf((r.manifest.cues || []).filter((c) => state.tracks.some((t) => t.id === c.track)), pdf.numPages)
  $('#title').textContent = r.manifest.title || state.name
  $('#meta').textContent = `${pdf.numPages}쪽 · ${state.tracks.length}곡`
  renderList(); player.classList.remove('hidden')
  state.page = 1
  const first = state.ranges.find((x) => x.from === 1) || { track: state.tracks[0] && state.tracks[0].id, at: 0 }
  const t = state.tracks.find((x) => x.id === first.track); if (t) select(t, first.at || 0, false)   // cue up only; no autoplay
  await renderPages(pdf); state.page = 1
}
$('#dl').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([state.bytes], { type: 'application/pdf' })); a.download = state.name + '.pdf'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 60000) }

async function renderPages(pdf) {
  pagesEl.innerHTML = ''; state.page = 0
  const width = Math.min(pagesEl.clientWidth - 24, 900) * (devicePixelRatio > 1 ? 1 : 1)
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const vp0 = page.getViewport({ scale: 1 }); const scale = (width / vp0.width) * Math.min(devicePixelRatio || 1, 2)
    const vp = page.getViewport({ scale })
    const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height; c.style.width = width + 'px'; c.dataset.page = i
    pagesEl.appendChild(c)
    await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise
  }
  pagesEl.onscroll = updateCurrentPage
}
function updateCurrentPage() {
  const mid = pagesEl.scrollTop + pagesEl.clientHeight / 2
  let best = 1, bestD = Infinity
  for (const c of pagesEl.querySelectorAll('canvas')) { const d = Math.abs(c.offsetTop + c.offsetHeight / 2 - mid); if (d < bestD) { bestD = d; best = +c.dataset.page } }
  if (best !== state.page) { state.page = best; onPageChange(best) }
}
function onPageChange(page) {
  if (!state.manifest || (state.manifest.options || {}).followPage === false) return
  const cue = state.ranges.find((r) => r.page === page); if (!cue) return          // no cue here: keep playing (SPEC §2.3)
  const t = state.tracks.find((x) => x.id === cue.track); if (t && (t !== state.current || cue.at)) select(t, cue.at || 0, state.playing)
}

// ---- player ------------------------------------------------------------------
const rangeLabel = (t) => { const rs = state.ranges.filter((r) => r.track === t.id); return rs.length ? rs.map((r) => (r.from === r.to ? r.from : r.from + '–' + r.to)).join(',') : '—' }
function renderList() {
  const list = $('#list'); list.innerHTML = ''
  for (const t of state.tracks) {
    const b = document.createElement('button'); b.dataset.id = t.id
    const at = state.ranges.find((r) => r.track === t.id && r.at)
    b.innerHTML = `<span class="dot" style="width:10px;height:10px;border-radius:999px;background:${t.color}"></span><span class="rng">${rangeLabel(t)}</span><span class="nm">${esc(t.title || t.id)} ${at ? `<small>${fmtTime(at.at)}부터</small>` : ''}</span><span class="dur" data-dur="${t.id}"></span>`
    b.onclick = () => select(t, (state.ranges.find((r) => r.track === t.id) || {}).at || t.start || 0, state.playing)
    list.appendChild(b)
  }
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
function select(track, at, play) {
  state.current = track
  for (const b of $('#list').children) b.classList.toggle('active', b.dataset.id === track.id)
  $('#dot').style.background = track.color; $('#name').textContent = track.title || track.id; setProgress(at, 0)
  const isYt = track.src.startsWith('youtube:')
  $('#yt').classList.toggle('on', isYt)
  if (isYt) { audio.pause(); audio.removeAttribute('src'); ytLoad(track.src.slice(8), at, play); return }
  if (state.yt && state.ytReady) { try { state.yt.pauseVideo() } catch {} }
  const url = track.src.startsWith('file:') ? blobUrl(track.src.slice(5)) : track.src
  if (!url) return
  if (audio.src === url) { audio.currentTime = at; play ? audio.play() : audio.pause(); return }
  audio.onloadedmetadata = () => { audio.currentTime = at; setDur(track.id, audio.duration); if (play) audio.play() }
  audio.src = url
}
function blobUrl(name) { const f = state.files[name]; if (!f) return ''; return blobUrls[name] || (blobUrls[name] = URL.createObjectURL(new Blob([f], { type: mimeOf(name) }))) }
function setDur(id, d) { const el = document.querySelector(`[data-dur="${id}"]`); if (el && isFinite(d)) el.textContent = fmtTime(d) }
function setProgress(t, d) { $('#time').textContent = d ? `${fmtTime(t)} / ${fmtTime(d)}` : fmtTime(t); $('#fill').style.width = d ? (100 * t / d) + '%' : '0%' }
function showPlaying(p) { state.playing = p; $('#play').innerHTML = p ? PAUSE : PLAY; $('#miniplay').innerHTML = p ? PAUSE : PLAY; $('#play').setAttribute('aria-label', p ? '일시정지' : '재생') }
audio.onplay = () => showPlaying(true); audio.onpause = () => showPlaying(false)
audio.ontimeupdate = () => setProgress(audio.currentTime, audio.duration)
audio.onended = () => { if ((state.manifest.options || {}).loop) { audio.currentTime = 0; audio.play() } }
function toggle() {
  const t = state.current; if (!t) return
  if (t.src.startsWith('youtube:')) { if (state.ytReady) state.playing ? state.yt.pauseVideo() : state.yt.playVideo(); return }
  audio.paused ? audio.play() : audio.pause()
}
$('#play').onclick = toggle; $('#miniplay').onclick = (e) => { e.stopPropagation(); toggle() }
$('#prev').onclick = () => step(-1); $('#next').onclick = () => step(1)
function step(d) { const i = state.tracks.indexOf(state.current); const t = state.tracks[(i + d + state.tracks.length) % state.tracks.length]; if (t) select(t, (state.ranges.find((r) => r.track === t.id) || {}).at || 0, state.playing) }
$('#bar').onclick = (e) => {
  const f = (e.clientX - e.currentTarget.getBoundingClientRect().left) / e.currentTarget.clientWidth; const t = state.current; if (!t) return
  if (t.src.startsWith('youtube:')) { if (state.ytReady) state.yt.seekTo(f * state.yt.getDuration(), true) } else if (isFinite(audio.duration)) audio.currentTime = f * audio.duration
}
document.addEventListener('keydown', (e) => { if (e.key === ' ' && !/INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement.tagName)) { e.preventDefault(); toggle() } })

// collapse / expand / drag
const setOpen = (open) => { player.classList.toggle('collapsed', !open); $('#scrim').classList.toggle('hidden', !open || !isMobile()) }
$('#collapse').onclick = () => setOpen(false); $('#expand').onclick = () => setOpen(true); $('#scrim').onclick = () => setOpen(false)
player.addEventListener('click', (e) => { if (player.classList.contains('collapsed') && !e.target.closest('button')) setOpen(true) })
let drag = null
$('#phead').addEventListener('pointerdown', (e) => {
  if (isMobile() || e.target.closest('button')) return
  const r = player.getBoundingClientRect(); drag = { dx: e.clientX - r.left, dy: e.clientY - r.top }
  player.style.right = 'auto'; player.style.bottom = 'auto'; player.style.left = r.left + 'px'; player.style.top = r.top + 'px'
  e.currentTarget.setPointerCapture(e.pointerId)
})
$('#phead').addEventListener('pointermove', (e) => { if (!drag) return; player.style.left = Math.max(0, Math.min(innerWidth - player.offsetWidth, e.clientX - drag.dx)) + 'px'; player.style.top = Math.max(0, Math.min(innerHeight - 60, e.clientY - drag.dy)) + 'px' })
$('#phead').addEventListener('pointerup', () => { drag = null })

// ---- YouTube: official IFrame player, always visible while a YouTube track is active ----
function ytLoad(id, at, play) { state.pendingYt = { id, at, play }; if (state.ytReady) flushYt() }
function flushYt() {
  if (!state.pendingYt) return
  const { id, at, play } = state.pendingYt; state.pendingYt = null
  play ? state.yt.loadVideoById({ videoId: id, startSeconds: at }) : state.yt.cueVideoById({ videoId: id, startSeconds: at })
}
window.onYouTubeIframeAPIReady = () => {
  state.yt = new YT.Player('ytplayer', { width: '100%', height: '100%', playerVars: { playsinline: 1, rel: 0 }, events: {
    onReady: () => { state.ytReady = true; flushYt() },
    onStateChange: (e) => {
      const playing = e.data === YT.PlayerState.PLAYING; showPlaying(playing)
      clearInterval(state.ytTimer)
      if (playing) state.ytTimer = setInterval(() => { setProgress(state.yt.getCurrentTime(), state.yt.getDuration()); if (state.current) setDur(state.current.id, state.yt.getDuration()) }, 500)
      if (e.data === YT.PlayerState.CUED && state.current) setDur(state.current.id, state.yt.getDuration())
    } } })
}
if (window.YT && window.YT.Player) window.onYouTubeIframeAPIReady()
