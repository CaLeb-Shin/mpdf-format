import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs'
import { readMpdf, fmtTime, TRACK_COLORS, mimeOf } from './mpdf-browser.js'
import { getLang, mountLangButton } from './i18n.js'
import { mountAds } from './ads.js'
import { loadFile } from './file-session.js'
import { PlaybackEngine, publicationOffset } from './playback-engine.js'

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs'
const $ = selector => document.querySelector(selector)
const say = (ko, en) => getLang() === 'ko' ? ko : en
const ROOT = new URL('.', import.meta.url)
const player = $('#player'), pages = $('#pages')
const state = {
  bytes: null, filename: '', pdf: null, loadingTask: null, manifest: null, publication: null, files: {}, tracks: [], choices: [],
  current: null, engine: null, follower: null, playing: false, wantsPlayback: false, ready: false, atEnd: false, page: 1, pageCount: 0,
  openGeneration: 0, selectionGeneration: 0, urls: new Map(), papers: [], rendered: new Set(), rendering: new Map(),
  loopA: null, loopB: null, loopEnabled: false, pitch: 0, pitchRequest: 0, hash: null, localMarkers: [], placing: null,
  markersVisible: true, yt: null, ytPromise: null, ytCancel: null, ytDeferred: null, ytReady: false, ytWantPlay: false, ytSeekUntil: 0,
  seeking: false, scrubPosition: null, lastPersist: 0, remoteAbort: null, pageFollowSuppressed: false,
}
const skipOptions = [3, 5, 10], skipStorageKey = 'mpdf:seekSeconds'
try {
  const saved = Number(localStorage.getItem(skipStorageKey))
  if (skipOptions.includes(saved)) $('#skip').value = String(saved)
} catch {}
function skipInterval() { const value = Number($('#skip').value); return skipOptions.includes(value) ? value : 5 }
const positive = value => Number.isFinite(value) && value >= 0
const startOf = track => positive(track?.start) ? track.start : 0
const isYouTube = () => state.current?.track.src.startsWith('youtube:')
const mediaTime = () => isYouTube() ? (state.ytReady ? state.yt.getCurrentTime() || 0 : startOf(state.current.track)) : state.engine?.currentTime || 0
const mediaDuration = () => isYouTube() ? (state.ytReady ? state.yt.getDuration() || 0 : 0) : state.engine?.duration || 0
const duration = () => {
  if (!state.current) return 0
  const media = mediaDuration(), end = state.current.track.end
  const stop = positive(end) ? (media ? Math.min(end, media) : end) : media
  return Math.max(0, stop - startOf(state.current.track))
}
const position = () => state.atEnd ? duration() : Math.max(0, mediaTime() - startOf(state.current?.track))
function notice(message = '', error = false) { $('#notice').textContent = message; $('#notice').classList.toggle('hidden', !message); $('#notice').classList.toggle('error', error) }
function message(text = '') { $('#player-message').textContent = text; $('#player-message').classList.toggle('hidden', !text) }

mountLangButton(); mountAds()
function applyLanguage() {
  for (const el of document.querySelectorAll('[data-en][data-ko]')) el.textContent = el.dataset[getLang() === 'ko' ? 'ko' : 'en']
  const aria = {
    openfile: ['파일 열기', 'Open file'], pageprev: ['이전 페이지', 'Previous page'], pagenext: ['다음 페이지', 'Next page'],
    pagenumber: ['현재 페이지', 'Current page'], collapse: ['재생창 접기', 'Collapse player'], expand: ['재생창 펼치기', 'Expand player'],
    prev: ['이전 음원', 'Previous track'], next: ['다음 음원', 'Next track'], back: ['뒤로 이동', 'Skip back'], forward: ['앞으로 이동', 'Skip forward'],
    'loop-clear': ['반복 구간 지우기', 'Clear loop'], 'pitch-down': ['반음 내리기', 'Lower one semitone'], 'pitch-up': ['반음 올리기', 'Raise one semitone'],
    pitch: ['키 조절, 반음 단위', 'Pitch, in semitones'], 'reset-position': ['재생창 위치 초기화', 'Reset player position'],
    'mini-seek': ['MPDF 재생 위치', 'MPDF playback position'], 'mini-close': ['재생을 멈추고 재생창 닫기', 'Stop playback and close player'],
  }
  for (const [id, texts] of Object.entries(aria)) $(`#${id}`).setAttribute('aria-label', say(...texts))
  $('#pages').setAttribute('aria-label', say('악보 페이지', 'Score pages'))
  $('#player').setAttribute('aria-label', say('음악 재생창', 'Music player'))
  if (state.pdf) updateMeta()
  if (state.current) $('#name').textContent = choiceLabel(state.current)
  renderList(); renderMarkers(); renderOverlays(); updatePitchUI(); setPlaying(state.playing); updateLoopUI(); updateSkipUI(); updateMarkerToggle()
}
document.addEventListener('langchange', applyLanguage)
applyLanguage()

$('#openfile').onclick = $('#empty-open').onclick = () => $('#file').click()
$('#file').onchange = event => { const file = event.target.files[0]; if (file) openFile(file); event.target.value = '' }
$('#sample').onclick = () => fetchFile(new URL('samples/practice.mpdf', ROOT).href, 'MPDF-practice.mpdf')
document.addEventListener('dragover', event => { event.preventDefault(); pages.classList.add('dragover') })
document.addEventListener('dragleave', event => { if (!event.relatedTarget) pages.classList.remove('dragover') })
document.addEventListener('drop', event => { event.preventDefault(); pages.classList.remove('dragover'); const file = event.dataTransfer.files[0]; if (file) openFile(file) })

async function fetchFile(url, filename = 'MPDF.mpdf') {
  state.remoteAbort?.abort()
  const controller = new AbortController(); state.remoteAbort = controller
  notice(say('파일을 여는 중…', 'Opening file…'))
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error(response.status === 404 ? 'expired' : 'fetch')
    if (Number(response.headers.get('content-length')) > 512 * 1024 * 1024) throw new Error('large')
    const blob = await response.blob()
    if (!controller.signal.aborted) await openFile(new File([blob], filename), true)
  } catch (error) {
    if (error.name !== 'AbortError') notice(error.message === 'expired' ? say('없는 링크이거나 보관 기간이 지났습니다.', 'This link does not exist or has expired.') : say('파일을 열지 못했습니다. 파일을 내려받아 직접 열어 주세요.', 'The file could not be opened. Download it and open the local file.'), true)
  }
}
async function resetDocument() {
  persistPractice(); pause(); state.selectionGeneration++
  state.ytCancel?.(); state.ytDeferred = null
  state.engine?.destroy(); state.engine = null
  state.follower?.destroy(); state.follower = null
  if (state.ytReady) { try { state.yt.stopVideo() } catch {} }
  state.ytWantPlay = false; state.ytSeekUntil = 0
  for (const job of state.rendering.values()) job.cancel()
  state.rendering.clear(); state.rendered.clear(); state.papers = []
  const previous = state.pdf; state.pdf = null
  const previousLoading = state.loadingTask; state.loadingTask = null
  for (const url of state.urls.values()) URL.revokeObjectURL(url)
  state.urls.clear()
  Object.assign(state, { bytes: null, filename: '', manifest: null, publication: null, files: {}, tracks: [], choices: [], current: null, page: 1, pageCount: 0, ready: false, hash: null, localMarkers: [], placing: null, pitch: 0, seeking: false, scrubPosition: null })
  clearLoop(); cancelPlacement(); player.classList.add('hidden'); $('#yt').classList.add('hidden'); $('#toolbar').classList.add('hidden'); $('#dl').classList.add('hidden')
  pages.replaceChildren(); notice(); message()
  if (previous) await previous.destroy().catch(() => {})
  else if (previousLoading) await previousLoading.destroy().catch(() => {})
}
async function openFile(file, fetched = false) {
  if (!fetched) state.remoteAbort?.abort()
  const generation = ++state.openGeneration
  await resetDocument()
  if (generation !== state.openGeneration) return
  notice(say('악보를 준비하는 중…', 'Preparing your score…'))
  try {
    if (!file.size || file.size > 512 * 1024 * 1024) throw new Error('size')
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (generation !== state.openGeneration) return
    const task = pdfjsLib.getDocument({ data: bytes.slice(), isEvalSupported: false })
    state.loadingTask = task
    const pdf = await task.promise
    if (generation !== state.openGeneration) { await pdf.destroy(); return }
    if (pdf.numPages > 5000) throw new Error('pages')
    state.pdf = pdf; state.bytes = bytes; state.filename = file.name; state.pageCount = pdf.numPages
    let read = null, metadataError = false
    try { read = await readMpdf(pdf) } catch { metadataError = true }
    if (generation !== state.openGeneration) return
    if (read?.validationErrors?.length) metadataError = true
    state.manifest = metadataError ? null : read?.manifest || null; state.files = read?.files || {}; state.publication = metadataError ? null : read?.publication || null
    state.tracks = (Array.isArray(state.manifest?.tracks) ? state.manifest.tracks : []).filter(track => typeof track?.src === 'string' && /^(file:|https:|youtube:)/.test(track.src)).map((track, index) => ({ ...track, color: TRACK_COLORS[index % TRACK_COLORS.length] }))
    buildChoices()
    $('#title').removeAttribute('data-en'); $('#title').removeAttribute('data-ko')
    $('#title').textContent = state.manifest?.title || file.name.replace(/\.(pdf|mpdf)$/i, '')
    $('#meta').removeAttribute('data-en'); $('#meta').removeAttribute('data-ko')
    updateMeta()
    document.title = `${$('#title').textContent} · MPDF`
    $('#dl').classList.remove('hidden'); $('#toolbar').classList.remove('hidden')
    $('#follow').checked = state.manifest?.options?.followPage !== false
    $('#follow').disabled = !state.manifest
    $('#show-player').disabled = !state.choices.length
    $('#pagenumber').max = pdf.numPages; $('#pagecount').textContent = `/ ${pdf.numPages}`
    await createPages(pdf, generation)
    if (generation !== state.openGeneration) return
    if (crypto.subtle) {
      try {
        const digest = await crypto.subtle.digest('SHA-256', bytes)
        if (generation !== state.openGeneration) return
        state.hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
        restoreMarkers()
      } catch {}
    }
    renderList(); renderMarkers(); renderOverlays()
    if (state.choices.length) {
      player.classList.remove('hidden'); setOpen(!matchMedia('(max-width: 720px)').matches)
      let saved = null
      try { saved = JSON.parse(localStorage.getItem(`mpdf:practice:${state.hash}`) || 'null') } catch {}
      const first = firstCue(1)
      const choice = state.choices.find(c => c.id === saved?.choice) || (first && choiceForTrack(first.track)) || state.choices[0]
      let at = positive(saved?.position) ? saved.position : null
      if (at === null) { const cue = firstCue(1); at = cue?.track === choice.track.id ? Math.max(0, (cue.at || 0) - startOf(choice.track)) : 0 }
      await selectChoice(choice.id, at, false)
      if (generation !== state.openGeneration) return
      if (Number.isInteger(saved?.page) && saved.page > 1 && saved.page <= pdf.numPages) goPage(saved.page, false)
    }
    const unsupported = (state.manifest?.tracks?.length || 0) - state.tracks.length
    const warnings = read?.errors || read?.warnings || []
    notice(metadataError ? say('음원 정보를 읽지 못해 악보만 열었습니다. 원본은 그대로 저장할 수 있습니다.', 'The audio metadata could not be read, so only the score is shown. You can save the original unchanged.') : unsupported ? say(`${unsupported}개 음원 형식은 이 브라우저에서 지원하지 않습니다.`, `${unsupported} audio source(s) are not supported in this browser.`) : warnings.length ? say('일부 부가 정보는 읽지 못했습니다. 원본 파일은 그대로 저장할 수 있습니다.', 'Some additional information could not be read. You can still save the original file.') : '')
  } catch (error) {
    if (generation !== state.openGeneration) return
    const reason = error.name === 'PasswordException' ? say('암호가 있는 PDF입니다. 암호를 해제한 복사본을 열어 주세요.', 'This PDF is password protected. Open an unlocked copy.') : error.message === 'size' ? say('512MB 이하의 PDF 또는 MPDF 파일을 열어 주세요.', 'Open a PDF or MPDF file up to 512 MB.') : error.message === 'pages' ? say('페이지가 너무 많습니다. 5,000쪽 이하로 나누어 열어 주세요.', 'Split this file into documents of up to 5,000 pages.') : say('파일을 읽지 못했습니다. 올바른 PDF·MPDF인지 확인해 주세요.', 'This file could not be read. Check that it is a valid PDF or MPDF.')
    notice(reason, true)
    $('#title').textContent = say('파일을 다시 열어 주세요', 'Try another file')
  }
}
function updateMeta() {
  $('#meta').textContent = say(`${state.pageCount}쪽 · ${state.tracks.length ? `${state.tracks.length}개 음원` : '일반 PDF'}`, `${state.pageCount} pages · ${state.tracks.length ? `${state.tracks.length} audio tracks` : 'plain PDF'}`)
}
$('#dl').onclick = () => {
  if (!state.bytes) return
  const url = URL.createObjectURL(new Blob([state.bytes], { type: 'application/pdf' })), link = document.createElement('a')
  link.href = url; link.download = state.filename || 'MPDF.mpdf'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 10000)
}

// Only five page canvases are retained. Paper placeholders keep stable scrolling.
async function createPages(pdf, generation) {
  const first = await pdf.getPage(1), viewport = first.getViewport({ scale: 1 })
  if (generation !== state.openGeneration) return
  const fragment = document.createDocumentFragment()
  for (let page = 1; page <= pdf.numPages; page++) {
    const paper = document.createElement('article'); paper.className = 'practice-paper'; paper.dataset.page = page
    paper.style.aspectRatio = `${viewport.width} / ${viewport.height}`
    paper.setAttribute('aria-label', say(`${page}페이지`, `Page ${page}`))
    paper.addEventListener('click', event => placeMarker(event, page))
    state.papers.push(paper); fragment.append(paper)
  }
  pages.append(fragment); pages.scrollTop = 0; state.page = 1; $('#pagenumber').value = 1
  refreshPages()
}
async function renderPage(number) {
  if (!state.pdf || state.rendered.has(number) || state.rendering.has(number)) return
  const generation = state.openGeneration, paper = state.papers[number - 1], pdf = state.pdf
  if (!paper) return
  state.rendering.set(number, { cancel() {} })
  try {
    const page = await pdf.getPage(number)
    if (generation !== state.openGeneration || !paper.isConnected || Math.abs(number - state.page) > 2) return
    const base = page.getViewport({ scale: 1 }), width = Math.max(100, paper.clientWidth)
    paper.style.aspectRatio = `${base.width} / ${base.height}`
    const pixelRatio = Math.min(devicePixelRatio || 1, 1.7, Math.sqrt(2400000 / (width * width * base.height / base.width)))
    const viewport = page.getViewport({ scale: width / base.width * pixelRatio })
    const canvas = document.createElement('canvas'); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height); canvas.setAttribute('aria-hidden', 'true')
    const job = page.render({ canvasContext: canvas.getContext('2d', { alpha: false }), viewport })
    state.rendering.set(number, job)
    await job.promise
    if (generation !== state.openGeneration || !paper.isConnected || Math.abs(number - state.page) > 2) { canvas.width = 0; return }
    paper.querySelector('canvas')?.remove(); paper.prepend(canvas)
    paper.querySelector('.page-status')?.remove(); state.rendered.add(number); renderPageOverlays(number)
  } catch (error) {
    if (generation === state.openGeneration && error.name !== 'RenderingCancelledException') {
      let label = paper.querySelector('.page-status')
      if (!label) { label = document.createElement('span'); label.className = 'page-status'; paper.append(label) }
      label.textContent = say('이 페이지를 표시하지 못했습니다.', 'This page could not be displayed.')
    }
  } finally { if (generation === state.openGeneration) state.rendering.delete(number) }
}
function refreshPages() {
  if (!state.pdf) return
  for (const number of [...state.rendered]) {
    if (Math.abs(number - state.page) > 2) { const canvas = state.papers[number - 1]?.querySelector('canvas'); if (canvas) { canvas.width = 0; canvas.remove() }; state.rendered.delete(number) }
  }
  for (const [number, job] of state.rendering) if (Math.abs(number - state.page) > 2) job.cancel()
  const wanted = [state.page, state.page - 1, state.page + 1, state.page - 2, state.page + 2].filter(n => n > 0 && n <= state.pageCount)
  // Sequential page work bounds simultaneous PDF decoding and canvas allocation.
  ;(async () => { for (const number of wanted) { if (Math.abs(number - state.page) <= 2) await renderPage(number) } })()
}
let scrollFrame = 0
pages.addEventListener('scroll', () => {
  if (scrollFrame) return
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = 0
    if (!state.papers.length) return
    const center = pages.getBoundingClientRect().top + pages.clientHeight * .38
    let lo = 0, hi = state.papers.length - 1
    while (lo < hi) { const mid = (lo + hi) >> 1; if (state.papers[mid].getBoundingClientRect().bottom < center) lo = mid + 1; else hi = mid }
    const page = lo + 1
    if (page !== state.page) { state.page = page; $('#pagenumber').value = page; refreshPages(); onPageChange(page) }
  })
}, { passive: true })
function goPage(page, followCue = true) {
  page = Math.max(1, Math.min(state.pageCount, Math.round(page)))
  if (!page || !state.papers[page - 1]) return
  state.pageFollowSuppressed = !followCue
  state.papers[page - 1].scrollIntoView({ behavior: 'instant', block: 'start' })
  state.page = page; $('#pagenumber').value = page; refreshPages()
  if (followCue) onPageChange(page)
  requestAnimationFrame(() => { state.pageFollowSuppressed = false })
}
$('#pageprev').onclick = () => goPage(state.page - 1)
$('#pagenext').onclick = () => goPage(state.page + 1)
$('#pagenumber').onchange = event => goPage(Number(event.target.value) || 1)
const firstCue = page => (state.manifest?.cues || []).find(cue => cue.page === page && state.tracks.some(track => track.id === cue.track))
function onPageChange(page) {
  if (!$('#follow').checked || state.pageFollowSuppressed || !state.ready) return
  const cue = firstCue(page)
  if (!cue) return
  const choice = choiceForTrack(cue.track)
  if (choice) selectChoice(choice.id, Math.max(0, (cue.at || 0) - startOf(choice.track)), state.playing)
}
let resizeTimer
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => {
    for (const job of state.rendering.values()) job.cancel()
    for (const number of state.rendered) { const canvas = state.papers[number - 1]?.querySelector('canvas'); if (canvas) { canvas.width = 0; canvas.remove() } }
    state.rendered.clear(); setTimeout(refreshPages, 30); constrainPlayer()
  }, 200)
})

function buildChoices() {
  const publication = state.publication, claimed = new Set(); state.choices = []
  const add = (id, trackID, ko, en) => {
    const track = state.tracks.find(t => t.id === trackID)
    if (!track) return
    state.choices.push({ id, track, ko, en }); claimed.add(trackID)
  }
  if (publication) {
    add('score', publication.scoreTrackID, '악보', 'Score')
    add('chords', publication.chordTrackID, '코드', 'Chords')
    add('source', publication.sourceTrackID, '음원', 'Source')
    const source = state.tracks.find(t => t.id === publication.sourceTrackID), chord = state.tracks.find(t => t.id === publication.chordTrackID)
    if (source && chord?.src.startsWith('file:') && attachment(chord.src.slice(5))) state.choices.push({ id: 'mix', track: source, follower: chord, ko: '음원 + 코드', en: 'Source + chords' })
  }
  for (const track of state.tracks) if (!claimed.has(track.id)) state.choices.push({ id: `track-${track.id}`, track })
}
const choiceLabel = choice => choice.ko ? say(choice.ko, choice.en) : choice.track.title || choice.track.id
const choiceForTrack = (trackID, choiceID) => state.choices.find(choice => choice.id === choiceID && choice.track.id === trackID) || state.choices.find(choice => choice.track.id === trackID)
function renderList() {
  const list = $('#list'); list.replaceChildren()
  $('#track-count').textContent = state.choices.length
  for (const choice of state.choices) {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.id = choice.id; button.setAttribute('aria-pressed', String(state.current?.id === choice.id))
    const dot = document.createElement('span'); dot.className = 'track-dot'; dot.style.background = choice.track.color
    const name = document.createElement('span'); name.className = 'choice-name'; name.textContent = choiceLabel(choice)
    const type = document.createElement('small'); type.textContent = choice.track.src.startsWith('youtube:') ? 'YouTube' : choice.track.src.startsWith('file:') ? say('파일', 'File') : say('온라인', 'Online')
    button.append(dot, name, type); button.onclick = () => selectChoice(choice.id, null, state.playing); list.append(button)
  }
}
function attachment(name) {
  if (state.files[name]) return state.files[name]
  const key = Object.keys(state.files).find(k => k.normalize('NFC') === name.normalize('NFC'))
  return key ? state.files[key] : null
}
function trackURL(track) {
  if (!track.src.startsWith('file:')) return track.src
  const key = track.src.slice(5), bytes = attachment(key)
  if (!bytes) throw new Error('missing-audio')
  if (!state.urls.has(key)) state.urls.set(key, URL.createObjectURL(new Blob([bytes], { type: mimeOf(key) })))
  return state.urls.get(key)
}
async function selectChoice(id, requestedPosition = null, autoplay = false) {
  const choice = state.choices.find(c => c.id === id)
  if (!choice) return
  const previous = state.current, previousAbsolute = mediaTime(), generation = ++state.selectionGeneration
  state.ytCancel?.(); state.ytDeferred = null
  pause(); state.engine?.destroy(); state.engine = null; state.follower?.destroy(); state.follower = null
  state.ready = false; state.atEnd = false; state.current = choice; state.pitch = 0; state.pitchRequest++; state.seeking = false; state.scrubPosition = null; clearLoop(); cancelPlacement(); message()
  $('#name').textContent = choiceLabel(choice); $('#dot').style.background = choice.track.color
  $('#yt').classList.toggle('hidden', !isYouTube())
  $('#network-label').textContent = isYouTube() ? say('YouTube · 인터넷 필요', 'YouTube · online') : choice.track.src.startsWith('file:') ? say('파일에 포함된 음원', 'Embedded audio') : say('외부 음원 · 인터넷 필요', 'Linked audio · online')
  renderList(); updatePitchUI(); paintProgress(); player.classList.remove('hidden')
  let target = requestedPosition
  if (target === null) {
    const roleIDs = [state.publication?.scoreTrackID, state.publication?.chordTrackID, state.publication?.sourceTrackID].filter(Boolean)
    if (previous && roleIDs.includes(previous.track.id) && roleIDs.includes(choice.track.id)) {
      const offset = publicationOffset(state.publication)
      const scoreTime = previousAbsolute - (previous.track.id === state.publication.sourceTrackID ? offset : 0)
      target = Math.max(0, scoreTime + (choice.track.id === state.publication.sourceTrackID ? offset : 0) - startOf(choice.track))
    } else target = 0
  }
  try {
    if (isYouTube()) {
      if (document.hidden) { deferYouTubeChoice(choice.id, target); return }
      await ensureYouTube(choice.track.src.slice(8), startOf(choice.track) + target)
      if (generation !== state.selectionGeneration) return
      state.ytWantPlay = false
      state.yt.cueVideoById({ videoId: choice.track.src.slice(8), startSeconds: startOf(choice.track) + target })
      state.ytSeekUntil = performance.now() + 700
      if (choice.follower) {
        const follower = new PlaybackEngine({ onError: () => message(say('코드 반주를 재생하지 못했습니다. 브라우저의 소리 재생 허용을 확인하세요.', 'The chord accompaniment could not play. Check your browser audio permissions.')) })
        state.follower = follower
        await follower.load(trackURL(choice.follower), { local: true })
        if (generation !== state.selectionGeneration) return
      }
    } else {
      const engine = new PlaybackEngine({
        onState: playing => { if (generation === state.selectionGeneration) { setPlaying(playing); if (!playing) engine.follower?.pause() } },
        onError: () => { if (generation === state.selectionGeneration) message(say('음원을 재생하지 못했습니다. 파일 형식이나 연결 상태를 확인해 주세요.', 'The audio could not play. Check the file format and connection.')) },
      })
      state.engine = engine
      await engine.load(trackURL(choice.track), { local: choice.track.src.startsWith('file:'), followerURL: choice.follower ? trackURL(choice.follower) : null, firstBar: publicationOffset(state.publication) })
      if (generation !== state.selectionGeneration) return
      if (engine.duration <= startOf(choice.track)) throw new Error('range')
      engine.seek(startOf(choice.track) + Math.min(target, Math.max(0, duration() - .05)))
    }
    if (generation !== state.selectionGeneration) return
    state.ready = true; paintProgress(); updatePitchUI()
    if (autoplay && !document.hidden) await play()
  } catch (error) {
    if (generation !== state.selectionGeneration) return
    state.ready = false; pause()
    if (error.message === 'youtube-background') { deferYouTubeChoice(choice.id, target); return }
    message(error.message === 'missing-audio' ? say('이 음원의 첨부 파일이 없습니다. 원본 MPDF를 다시 받아 주세요.', 'This audio attachment is missing. Ask for the original MPDF file.') : error.message === 'range' ? say('지정한 시작 시간이 음원 길이를 넘습니다.', 'The start time is beyond the audio duration.') : say('음원을 준비하지 못했습니다. 다른 음원을 선택하거나 연결 상태를 확인해 주세요.', 'The audio could not be prepared. Choose another track or check your connection.'))
    if (isYouTube()) {
      const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'text-action'
      retry.textContent = say('YouTube 다시 시도', 'Retry YouTube')
      retry.onclick = () => { if (generation === state.selectionGeneration) selectChoice(choice.id, target, false) }
      $('#player-message').append(' ', retry)
    }
  }
}
function setPlaying(playing) {
  state.playing = playing
  for (const id of ['play', 'miniplay']) { $(`#${id}`).textContent = playing ? 'Ⅱ' : '▶'; $(`#${id}`).setAttribute('aria-label', playing ? say('일시정지', 'Pause') : say('재생', 'Play')) }
}
async function play() {
  if (!state.current || !state.ready || player.classList.contains('hidden')) return
  message(); state.wantsPlayback = true
  if (duration() && position() >= duration() - .03) seek(state.loopEnabled ? state.loopA : 0)
  if (isYouTube()) {
    state.ytWantPlay = true; state.yt.playVideo()
    // Unlock the local follower under this click, then immediately hold it until
    // the visible official player reports that playback has really started.
    if (state.follower) { try { await state.follower.play(); state.follower.pause() } catch {} }
  } else {
    try { await state.engine.play() } catch { state.wantsPlayback = false; message(say('재생 버튼을 다시 눌러 주세요. 브라우저가 소리 재생을 막았을 수 있습니다.', 'Press Play again. Your browser may have blocked audio playback.')) }
  }
}
function pause() {
  state.wantsPlayback = false; state.ytWantPlay = false
  state.engine?.pause(); state.follower?.pause()
  if (state.ytReady) { try { state.yt.pauseVideo() } catch {} }
  setPlaying(false)
}
async function toggle() { if (state.playing) pause(); else await play() }
function seek(relative) {
  if (!state.current || !state.ready || !Number.isFinite(relative)) return
  state.atEnd = false
  const target = Math.max(0, Math.min(duration() || relative, relative)), absolute = startOf(state.current.track) + target
  if (isYouTube()) { state.yt.seekTo(absolute, true); state.ytSeekUntil = performance.now() + 450; syncYouTubeFollower(absolute) }
  else state.engine.seek(absolute)
  paintProgress(target)
}
function paintProgress(override) {
  const length = duration(), current = state.seeking && state.scrubPosition !== null ? state.scrubPosition : typeof override === 'number' ? override : Math.min(length || Infinity, position())
  const time = `${fmtTime(current)} / ${fmtTime(length)}`
  $('#time').textContent = $('#mini-time').textContent = time
  for (const id of ['seek', 'mini-seek']) {
    const slider = $(`#${id}`)
    slider.max = Math.max(1, length); slider.value = current
    slider.disabled = !state.ready || !length
    slider.setAttribute('aria-valuetext', time)
  }
  $('#mark-add').disabled = !state.ready || !length
  $('#play').disabled = $('#miniplay').disabled = !state.ready
  for (const id of ['back', 'forward', 'mini-back', 'mini-forward']) $(`#${id}`).disabled = !state.ready || !length
  $('#mini-loop-set').disabled = !state.ready || length < .5
  $('#mini-loop-toggle').disabled = !state.ready || state.loopA === null || state.loopB === null
}
$('#play').onclick = $('#miniplay').onclick = toggle
$('#prev').onclick = () => step(-1); $('#next').onclick = () => step(1)
function step(delta) { if (!state.choices.length) return; const index = state.choices.indexOf(state.current); selectChoice(state.choices[(index + delta + state.choices.length) % state.choices.length].id, 0, state.playing) }
function updateSkipUI() {
  const seconds = skipInterval()
  $('#back-label').textContent = `−${seconds}`; $('#forward-label').textContent = `+${seconds}`
  $('#mini-back-label').textContent = $('#mini-forward-label').textContent = say(`${seconds}초`, `${seconds}s`)
  for (const id of ['back', 'mini-back']) $(`#${id}`).setAttribute('aria-label', say(`${seconds}초 뒤로`, `Back ${seconds} seconds`))
  for (const id of ['forward', 'mini-forward']) $(`#${id}`).setAttribute('aria-label', say(`${seconds}초 앞으로`, `Forward ${seconds} seconds`))
}
$('#skip').onchange = () => {
  $('#skip').value = String(skipInterval()); updateSkipUI()
  try { localStorage.setItem(skipStorageKey, $('#skip').value) } catch {}
}
$('#back').onclick = $('#mini-back').onclick = () => seek(position() - skipInterval())
$('#forward').onclick = $('#mini-forward').onclick = () => seek(position() + skipInterval())
for (const id of ['seek', 'mini-seek']) {
  const slider = $(`#${id}`)
  slider.oninput = event => { state.seeking = true; state.scrubPosition = Number(event.target.value); paintProgress() }
  slider.onchange = event => { const target = Number(event.target.value); state.seeking = false; state.scrubPosition = null; seek(target) }
  slider.onblur = () => { state.seeking = false; state.scrubPosition = null; paintProgress() }
}
function clearLoop() { state.loopA = null; state.loopB = null; state.loopEnabled = false; updateLoopUI() }
function updateLoopUI() {
  $('#loop-a span').textContent = state.loopA === null ? '—' : fmtTime(state.loopA)
  $('#loop-b span').textContent = state.loopB === null ? '—' : fmtTime(state.loopB)
  $('#loop-toggle').disabled = state.loopA === null || state.loopB === null
  $('#loop-toggle').setAttribute('aria-pressed', String(state.loopEnabled))
  $('#loop-a').setAttribute('aria-label', say('반복 시작 A를 현재 시간으로', 'Set loop start A to current time'))
  $('#loop-b').setAttribute('aria-label', say('반복 끝 B를 현재 시간으로', 'Set loop end B to current time'))
  const waitingForB = state.loopA !== null && state.loopB === null
  $('#mini-loop-set').textContent = waitingForB ? say('B 지정', 'Set B') : 'A–B'
  $('#mini-loop-set').setAttribute('aria-label', waitingForB ? say('현재 위치를 B 끝으로 설정', 'Set current position as loop end B') : say('현재 위치를 새 A 시작으로 설정', 'Set current position as a new loop start A'))
  $('#mini-loop-set').setAttribute('title', say('한 번 누르면 A, 다음에 누르면 B를 지정합니다.', 'Press once to set A, then again to set B.'))
  $('#mini-loop-set').disabled = !state.ready || duration() < .5
  $('#mini-loop-toggle').textContent = state.loopEnabled ? 'ON' : 'OFF'
  $('#mini-loop-toggle').setAttribute('aria-label', state.loopEnabled ? say('구간 반복 끄기', 'Turn loop off') : say('구간 반복 켜기', 'Turn loop on'))
  $('#mini-loop-toggle').setAttribute('aria-pressed', String(state.loopEnabled))
  $('#mini-loop-toggle').disabled = !state.ready || state.loopA === null || state.loopB === null
}
$('#loop-a').onclick = () => { if (!state.ready) return; state.loopA = position(); if (state.loopB !== null && state.loopB <= state.loopA + .2) { state.loopB = null; state.loopEnabled = false }; updateLoopUI() }
$('#loop-b').onclick = () => {
  if (!state.ready) return
  const current = position()
  if (state.loopA === null) state.loopA = 0
  if (current <= state.loopA + .2) { message(say('A보다 뒤에서 B를 지정하세요.', 'Set B at least a moment after A.')); return }
  state.loopB = current; state.loopEnabled = true; updateLoopUI(); message()
}
$('#mini-loop-set').onclick = () => {
  if (!state.ready || duration() < .5) return
  const current = position()
  if (state.loopA !== null && state.loopB === null) {
    if (current - state.loopA < .5) { message(say('B는 A보다 0.5초 뒤부터 지정할 수 있어요.', 'Set B at least 0.5 seconds after A.')); return }
    state.loopB = current
    message(say(`B ${fmtTime(current)} 설정 · ON을 누르면 반복해요.`, `B set at ${fmtTime(current)} · Press ON to repeat.`))
  } else {
    if (current > duration() - .5) { message(say('곡 끝보다 앞에서 A를 지정해 주세요.', 'Set A before the end of the track.')); return }
    state.loopA = current; state.loopB = null; state.loopEnabled = false
    message(say(`A ${fmtTime(current)} 설정 · 한 번 더 누르면 B예요.`, `A set at ${fmtTime(current)} · Press again to set B.`))
  }
  updateLoopUI()
}
$('#loop-toggle').onclick = $('#mini-loop-toggle').onclick = () => {
  if (!state.ready || state.loopA === null || state.loopB === null) return
  state.loopEnabled = !state.loopEnabled
  if (state.loopEnabled && (position() < state.loopA || position() >= state.loopB)) seek(state.loopA)
  updateLoopUI(); message()
}
$('#loop-clear').onclick = clearLoop

function updatePitchUI() {
  const enabled = Boolean(state.ready && state.current?.track.src.startsWith('file:'))
  for (const id of ['pitch', 'pitch-down', 'pitch-up', 'pitch-reset']) $(`#${id}`).disabled = !enabled
  $('#pitch').value = state.pitch; $('#pitch-value').textContent = state.pitch > 0 ? `+${state.pitch}` : String(state.pitch)
  $('#pitch-note').textContent = enabled ? say('파일 음원 · 속도 그대로, 반음 ±12', 'File audio · ±12 semitones, original speed') : say('키 조절은 파일에 포함된 음원에서 사용할 수 있어요.', 'Key changes are available for embedded file audio.')
}
async function setPitch(value) {
  if (!state.engine || !state.current?.track.src.startsWith('file:')) return
  const request = ++state.pitchRequest, engine = state.engine, pitch = Math.max(-12, Math.min(12, Math.round(value)))
  try { await engine.setPitch(pitch); if (request !== state.pitchRequest || engine !== state.engine) return; state.pitch = pitch; updatePitchUI(); message() }
  catch { if (request === state.pitchRequest) { state.pitch = 0; updatePitchUI(); message(say('이 브라우저에서는 키 조절을 시작하지 못했습니다. 원래 키로 재생됩니다.', 'Key adjustment could not start in this browser. Audio plays in its original key.')) } }
}
$('#pitch').onchange = event => setPitch(Number(event.target.value))
$('#pitch-down').onclick = () => setPitch(state.pitch - 1)
$('#pitch-up').onclick = () => setPitch(state.pitch + 1)
$('#pitch-reset').onclick = () => setPitch(0)

function allMarkers() { return [...(Array.isArray(state.manifest?.timeMarkers) ? state.manifest.timeMarkers : []).filter(validMarker), ...state.localMarkers] }
function validMarker(mark) { return mark && positive(mark.seconds) && Number.isInteger(mark.page) && mark.page > 0 && mark.page <= state.pageCount && positive(mark.x) && mark.x <= 1 && positive(mark.y) && mark.y <= 1 && state.tracks.some(t => t.id === mark.track) }
function restoreMarkers() {
  state.localMarkers = []
  if (!state.hash) return
  try { const data = JSON.parse(localStorage.getItem(`mpdf:marks:${state.hash}`) || 'null'); if (data?.version === 1 && Array.isArray(data.markers)) state.localMarkers = data.markers.filter(validMarker).slice(0, 2048).map(marker => ({ ...marker, local: true })) } catch { message(say('저장된 내 시간 표시를 읽지 못했습니다.', 'Your saved time marks could not be read.')) }
}
function saveMarkers() {
  if (!state.hash) { message(say('내 표시는 이번에 연 창에서만 유지됩니다.', 'These marks will stay only in this open session.')); return }
  try { localStorage.setItem(`mpdf:marks:${state.hash}`, JSON.stringify({ version: 1, markers: state.localMarkers })) }
  catch { message(say('브라우저 저장 공간이 없어 내 표시를 저장하지 못했습니다. 창을 닫으면 사라집니다.', 'Your marks could not be saved in browser storage. They will disappear when this page closes.')) }
}
function renderPageOverlays(number) {
  const paper = state.papers[number - 1]
  if (!paper) return
  paper.querySelector('.practice-page-controls')?.remove()
  const overlay = document.createElement('div'); overlay.className = 'practice-page-controls'
  const baked = state.manifest?.web?.buttonRendering === 'baked' || (state.publication && state.manifest?.web?.buttonRendering !== 'overlay')
  for (const control of (state.manifest?.buttons || []).filter(button => button.page === number && positive(button.x) && button.x <= 1 && positive(button.y) && button.y <= 1)) {
    const choice = choiceForTrack(control.track)
    if (!choice) continue
    const button = document.createElement('button'); button.className = `page-mpdf${baked ? ' baked' : ''}`; button.textContent = '▶ MPDF'
    button.style.left = `${control.x * 100}%`; button.style.top = `${control.y * 100}%`
    if (baked) { button.style.width = '6.5%'; button.style.height = `${paper.clientWidth * .065 * 1.38}px` }
    button.setAttribute('aria-label', say(`${number}쪽 ${choiceLabel(choice)} 재생창 열기`, `Open ${choiceLabel(choice)} player on page ${number}`))
    button.onclick = event => { event.stopPropagation(); if (state.current?.id === choice.id) setOpen(player.classList.contains('collapsed')); else { selectChoice(choice.id, 0, false); setOpen(true) } }
    overlay.append(button)
  }
  for (const mark of allMarkers().filter(marker => marker.page === number)) {
    const button = document.createElement('button'); button.className = `time-marker${mark.local ? ' local-marker' : ''}`; button.textContent = `▶ ${fmtTime(mark.seconds)}`
    button.style.left = `clamp(28px, ${mark.x * 100}%, calc(100% - 28px))`; button.style.top = `clamp(22px, ${mark.y * 100}%, calc(100% - 22px))`
    button.setAttribute('aria-label', say(`${fmtTime(mark.seconds)}부터 재생${mark.local ? ', 내 표시' : ''}`, `Play from ${fmtTime(mark.seconds)}${mark.local ? ', your mark' : ''}`))
    button.onclick = event => { event.stopPropagation(); playMarker(mark) }; overlay.append(button)
  }
  paper.append(overlay)
}
function renderOverlays() { for (const page of state.rendered) renderPageOverlays(page) }
function renderMarkers() {
  const markers = allMarkers(), list = $('#marker-list'); list.replaceChildren(); $('#marker-count').textContent = markers.length
  // The complete marker set remains interactive on pages; keep the menu bounded.
  for (const mark of markers.slice(0, 200)) {
    const row = document.createElement('div'); row.className = 'practice-marker-row'
    const button = document.createElement('button'); button.textContent = `${mark.page}${say('쪽', 'p')} · ${fmtTime(mark.seconds)} · ${choiceLabel(choiceForTrack(mark.track, mark.choice) || { track: { id: mark.track } })}${mark.local ? say(' · 내 표시', ' · yours') : ''}`
    button.onclick = () => { goPage(mark.page, false); playMarker(mark) }; row.append(button)
    if (mark.local) { const remove = document.createElement('button'); remove.textContent = '×'; remove.setAttribute('aria-label', say('내 시간 표시 삭제', 'Remove your time mark')); remove.onclick = () => { state.localMarkers = state.localMarkers.filter(m => m.id !== mark.id); saveMarkers(); renderMarkers(); renderOverlays() }; row.append(remove) }
    list.append(row)
  }
}
function playMarker(mark) { const choice = choiceForTrack(mark.track, mark.choice); if (choice) { clearLoop(); selectChoice(choice.id, mark.seconds, true) } }
$('#mark-add').onclick = () => {
  if (!state.ready || !duration()) return
  state.placing = { id: crypto.randomUUID(), track: state.current.track.id, choice: state.current.id, seconds: Math.round(position() * 10) / 10, local: true }
  pages.classList.add('placing'); $('#mark-cancel').classList.remove('hidden')
  notice(say(`${fmtTime(state.placing.seconds)} · 악보의 원하는 위치를 눌러 주세요.`, `${fmtTime(state.placing.seconds)} · Tap a spot on your score.`))
  if (matchMedia('(max-width: 720px)').matches) setOpen(false)
}
function placeMarker(event, page) {
  if (!state.placing || event.target.closest('button')) return
  if (state.localMarkers.length >= 2048) { message(say('내 표시는 최대 2,048개까지 저장할 수 있어요.', 'You can save up to 2,048 personal time marks.')); cancelPlacement(); return }
  const bounds = event.currentTarget.getBoundingClientRect()
  state.localMarkers.push({ ...state.placing, page, x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)), y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)) })
  cancelPlacement(); saveMarkers(); renderMarkers(); renderOverlays(); notice(say('내 시간 표시를 추가했습니다. 원본 저장에는 포함되지 않습니다.', 'Your time mark was added. It is separate from the original download.'))
}
function cancelPlacement() { state.placing = null; pages.classList.remove('placing'); $('#mark-cancel').classList.add('hidden') }
$('#mark-cancel').onclick = () => { cancelPlacement(); notice() }
function updateMarkerToggle() { $('#marker-toggle').textContent = state.markersVisible ? say('시간 표시 켜짐', 'Time marks on') : say('시간 표시 꺼짐', 'Time marks off'); $('#marker-toggle').setAttribute('aria-pressed', String(state.markersVisible)); pages.classList.toggle('markers-off', !state.markersVisible) }
$('#marker-toggle').onclick = () => { state.markersVisible = !state.markersVisible; updateMarkerToggle() }

function setOpen(open) {
  player.classList.toggle('collapsed', !open)
  $('#expand').setAttribute('aria-expanded', String(open)); $('#show-player').setAttribute('aria-expanded', String(open)); constrainPlayer()
}
$('#collapse').onclick = () => setOpen(false); $('#expand').onclick = () => setOpen(true)
$('#mini-close').onclick = () => { pause(); player.classList.add('hidden'); $('#show-player').setAttribute('aria-expanded', 'false') }
$('#show-player').onclick = () => { player.classList.remove('hidden'); setOpen(player.classList.contains('collapsed')) }
function resetPlayerPosition() { player.style.left = ''; player.style.top = ''; player.style.right = ''; player.style.bottom = '' }
$('#reset-position').onclick = resetPlayerPosition
function constrainPlayer() {
  if (!player.style.left || matchMedia('(max-width: 720px)').matches) return
  player.style.left = `${Math.max(8, Math.min(innerWidth - player.offsetWidth - 8, parseFloat(player.style.left)))}px`
  player.style.top = `${Math.max(8, Math.min(innerHeight - player.offsetHeight - 8, parseFloat(player.style.top)))}px`
}
let drag = null
$('#phead').addEventListener('pointerdown', event => {
  if (event.target.closest('button') || matchMedia('(max-width: 720px)').matches) return
  const rect = player.getBoundingClientRect(); drag = { x: event.clientX - rect.left, y: event.clientY - rect.top }
  player.style.left = `${rect.left}px`; player.style.top = `${rect.top}px`; player.style.right = 'auto'; player.style.bottom = 'auto'
  event.currentTarget.setPointerCapture(event.pointerId)
})
$('#phead').addEventListener('pointermove', event => { if (!drag) return; player.style.left = `${event.clientX - drag.x}px`; player.style.top = `${event.clientY - drag.y}px`; constrainPlayer() })
$('#phead').addEventListener('pointerup', () => { drag = null })
$('#phead').addEventListener('pointercancel', () => { drag = null })
document.addEventListener('keydown', event => {
  if (/^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable) return
  if (event.code === 'Space') { event.preventDefault(); toggle() }
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); seek(position() + skipInterval() * (event.key === 'ArrowLeft' ? -1 : 1)) }
  if (event.key === 'Escape') { cancelPlacement(); notice(); setOpen(false) }
})

function deferYouTubeChoice(id, target) {
  state.ytDeferred = { id, target }
  message(say('이 탭을 열면 YouTube 영상을 준비합니다.', 'The YouTube video will prepare when this tab is visible.'))
  if (!document.hidden) resumeYouTubeChoice()
}
function resumeYouTubeChoice() {
  const deferred = state.ytDeferred
  state.ytDeferred = null
  if (deferred && isYouTube() && !state.ready && state.current.id === deferred.id) selectChoice(deferred.id, deferred.target, false)
}
function ensureYouTube(videoId, startSeconds) {
  if (state.ytReady) return Promise.resolve()
  if (state.ytPromise) return state.ytPromise
  let begin
  const promise = new Promise((resolve, reject) => {
    let timeout, active = true, settled = false
    const clearInitialization = () => {
      clearTimeout(timeout); state.ytPromise = null; state.ytCancel = null
      if (window.onYouTubeIframeAPIReady === install) delete window.onYouTubeIframeAPIReady
    }
    const fail = (reason = 'youtube-cancelled') => {
      if (!active || settled) return
      active = false; clearInitialization()
      const stale = state.yt; state.yt = null; state.ytReady = false
      try { stale?.destroy() } catch {}
      // The API replaces the div with an iframe. A retry needs a fresh target.
      const container = document.createElement('div'); container.id = 'ytplayer'; $('#yt').replaceChildren(container)
      if (!window.YT?.Player) document.querySelector('script[data-youtube-api]')?.remove()
      reject(new Error(reason))
    }
    state.ytCancel = fail
    const current = event => active && event.target === state.yt
    const install = () => {
      if (!active || settled || state.yt) return
      if (document.hidden) { fail('youtube-background'); return }
      try { state.yt = new window.YT.Player('ytplayer', {
        videoId, width: '100%', height: '100%', playerVars: { autoplay: 0, start: Math.floor(startSeconds), playsinline: 1, rel: 0, origin: location.origin },
        events: {
          onReady: event => { if (!current(event) || settled) return; settled = true; clearInitialization(); state.ytReady = true; resolve() },
          onStateChange: event => {
            if (!current(event)) return
            if (!isYouTube()) { if (event.data === 1) state.yt.pauseVideo(); return }
            if (event.data === 1 && (document.hidden || player.classList.contains('hidden'))) { state.yt.pauseVideo(); return }
            if (event.data === 1) { state.ytWantPlay = true; setPlaying(true) }
            else if (event.data === 2 || event.data === 0 || event.data === 5) { setPlaying(false); state.follower?.pause() }
            if (event.data === 3) state.follower?.pause()
            if (event.data === 0 && state.ytWantPlay) finishPlayback()
          },
          onAutoplayBlocked: event => { if (current(event) && isYouTube()) { state.wantsPlayback = false; state.ytWantPlay = false; setPlaying(false); message(say('영상 안의 재생 버튼을 한 번 눌러 주세요. 브라우저가 외부 재생을 제한했습니다.', 'Press Play inside the video once. Your browser restricted playback from an external control.')) } },
          onError: event => {
            if (!current(event)) return
            if (!settled) { fail('youtube-player'); return }
            if (isYouTube()) { pause(); message(say('이 YouTube 영상을 재생할 수 없습니다. 영상이 비공개이거나 외부 재생이 제한되었을 수 있습니다.', 'This YouTube video is unavailable or does not allow embedded playback.')) }
          },
        },
      }) } catch { fail('youtube-player') }
    }
    begin = () => {
      if (document.hidden) { fail('youtube-background'); return }
      timeout = setTimeout(() => fail('youtube-timeout'), 60000)
      if (window.YT?.Player) install()
      else {
        window.onYouTubeIframeAPIReady = install
        let script = document.querySelector('script[data-youtube-api]')
        if (!script) { script = document.createElement('script'); script.src = 'https://www.youtube.com/iframe_api'; script.dataset.youtubeApi = 'true'; document.head.append(script) }
        script.onerror = () => fail('youtube-network')
      }
    }
  })
  state.ytPromise = promise; begin()
  return promise
}
function syncYouTubeFollower(absolute = mediaTime()) {
  const follower = state.follower
  if (!follower) return
  const target = absolute - publicationOffset(state.publication)
  if (!state.playing || state.yt.getPlayerState() !== 1 || target < 0 || target >= follower.duration) { follower.pause(); return }
  if (Math.abs(follower.currentTime - target) > .12) follower.seek(target)
  if (!follower.playing) follower.play().catch(() => {})
}
function finishPlayback() {
  if (state.loopEnabled && state.loopA !== null) { seek(state.loopA); play() }
  else if (state.manifest?.options?.loop) { seek(0); play() }
  else { pause(); state.atEnd = true; paintProgress(duration()) }
}
function persistPractice() {
  if (!state.hash || !state.current) return
  try { localStorage.setItem(`mpdf:practice:${state.hash}`, JSON.stringify({ choice: state.current.id, position: Math.min(duration() || Infinity, position()), page: state.page })) } catch {}
}
setInterval(() => {
  if (!state.current || !state.ready) return
  if (isYouTube() && state.ytReady) {
    const actual = state.yt.getPlayerState()
    if (actual === 1 && (document.hidden || player.classList.contains('hidden'))) pause()
    else if (actual === 1 && !state.playing) setPlaying(true)
    else if ([0, 2, 5].includes(actual) && state.playing) { setPlaying(false); state.follower?.pause() }
  }
  const length = duration(), current = position(), playing = state.playing
  if (playing && !(isYouTube() && performance.now() < state.ytSeekUntil)) {
    if (state.loopEnabled && state.loopB !== null && current >= state.loopB) seek(state.loopA)
    else if (length > 0 && current >= length - .025) finishPlayback()
    else if (isYouTube()) syncYouTubeFollower()
    else state.engine?.synchronize(true)
  }
  // A media element can end before a timer reaches the exact boundary.
  if (!isYouTube() && state.engine?.audio.ended) { if (state.wantsPlayback) finishPlayback(); else state.atEnd = true }
  paintProgress()
  if (performance.now() - state.lastPersist > 2500) { persistPractice(); state.lastPersist = performance.now() }
}, 100)
window.addEventListener('pagehide', () => { persistPractice(); pause() })
document.addEventListener('visibilitychange', () => {
  if (document.hidden && isYouTube()) { pause(); state.ytCancel?.('youtube-background') }
  else if (!document.hidden) resumeYouTubeChoice()
})

const idMatch = location.pathname.match(/\/v\/([A-Za-z0-9]{8,16})\/?$/)
const params = new URLSearchParams(location.search)
if (idMatch) {
  $('#sharebtn').classList.remove('hidden')
  $('#sharebtn').onclick = async () => { try { await navigator.clipboard.writeText(location.href); notice(say('링크를 복사했습니다.', 'Link copied.')) } catch { notice(say('주소창의 링크를 복사해 주세요.', 'Copy the link from your address bar.')) } }
  fetchFile(new URL(`f/${idMatch[1]}`, ROOT).href)
} else if (params.has('session')) {
  loadFile(params.get('session')).then(file => file ? openFile(file) : notice(say('미리보기 보관 시간이 지났습니다. 제작 화면에서 다시 미리보기를 열어 주세요.', 'This preview has expired. Open a new preview from the maker.'), true)).catch(() => notice(say('미리보기를 열지 못했습니다. 파일을 저장해 직접 열어 주세요.', 'The preview could not open. Save the file and open it directly.'), true))
} else if (params.has('file')) {
  try { const url = new URL(params.get('file'), location.href); if (url.protocol === 'https:' || url.origin === location.origin) fetchFile(url.href, decodeURIComponent(url.pathname.split('/').pop()) || 'MPDF.mpdf'); else notice(say('안전한 HTTPS 파일 주소를 사용해 주세요.', 'Use an HTTPS file URL.'), true) } catch { notice(say('파일 주소가 올바르지 않습니다.', 'The file URL is not valid.'), true) }
}
