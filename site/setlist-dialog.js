import {parseSetlist, makeSetlistFile} from './setlist.js'
import {parseYouTube} from './mpdf-browser.js'
import {getLang} from './i18n.js'

export function mountSetlist({openFile, safeTitle, L}) {
  const el = id => document.getElementById(id)
  const dialog = el('setlist-dialog'), input = el('setlist-text'), rows = el('setlist-songs')
  const message = el('setlist-message'), submit = el('setlist-create')
  const analyze = el('setlist-analyze')
  let draft, controller, creating = false
  const show = text => { message.textContent = text }
  function clearReview() {
    controller?.abort()
    draft = null
    rows.replaceChildren()
    submit.hidden = true
    analyze.hidden = false
    show('')
  }
  function refresh() { submit.disabled = creating || !draft?.songs.every(song => song.video) }
  el('welcome-setlist').onclick = () => { dialog.showModal(); input.focus() }
  el('setlist-close').onclick = () => dialog.close()
  dialog.addEventListener('cancel', event => { if (creating) event.preventDefault() })
  dialog.addEventListener('close', clearReview)
  input.oninput = clearReview
  function anchor(url, label) {
    const a = document.createElement('a')
    a.href = url
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    a.textContent = label
    return a
  }
  function renderSong(song, index) {
    const row = document.createElement('li')
    const heading = document.createElement('strong')
    heading.textContent = song.name
    row.append(heading)
    if (song.note) {
      const note = document.createElement('small')
      note.textContent = song.note
      row.append(note)
    }
    const field = document.createElement('input')
    field.type = 'url'
    field.value = song.url
    field.placeholder = 'https://youtu.be/…'
    field.setAttribute('aria-label', song.name + ' · YouTube URL')
    const choices = document.createElement('div')
    const feedback = document.createElement('small')
    feedback.setAttribute('role','status')
    const direct = anchor('https://www.youtube.com/results?search_query=' + encodeURIComponent(song.name),
      L('YouTube에서 검색 ↗','Search on YouTube ↗','YouTubeで検索 ↗'))
    const listen = anchor('', L('선택한 영상 열기 ↗','Open selected video ↗','選択した動画を開く ↗'))
    function sync() {
      song.url = field.value.trim()
      song.video = parseYouTube(song.url)
      listen.hidden = !song.video
      if (song.video) listen.href = 'https://www.youtube.com/watch?v=' + song.video
      field.setAttribute('aria-invalid', String(!!song.url && !song.video))
      for (const button of choices.querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.value === song.video))
      refresh()
    }
    field.oninput = sync
    sync()
    const links = document.createElement('div')
    links.className = 'setlist-links'
    links.append(listen, direct)
    row.append(field, links, choices, feedback)
    rows.append(row)
    return {song, choices, feedback, choose(id) {
      field.value = 'https://youtu.be/' + id
      sync()
    }, index}
  }
  async function fetchChoices(row, signal, requests) {
    const {song, choices, feedback} = row
    feedback.textContent = L('레퍼런스 찾는 중…','Finding references…','参考動画を検索中…')
    try {
      if (!requests.has(song.name)) requests.set(song.name, (async () => {
        const query = new URLSearchParams({q:song.name, lang:getLang()})
        const response = await fetch('/api/references?' + query, {signal})
        if (!response.ok) throw new Error()
        return (await response.json()).videos
      })())
      const videos = await requests.get(song.name)
      if (signal.aborted) return
      const decode = value => value.replace(/&(?:amp|quot|lt|gt|#39|#x27);/g, entity =>
        ({'&amp;':'&','&quot;':'"','&lt;':'<','&gt;':'>','&#39;':"'",'&#x27;':"'"})[entity])
      for (const video of videos) {
        const option = document.createElement('div')
        option.className = 'setlist-option'
        const pick = document.createElement('button')
        pick.type = 'button'
        pick.value = video.id
        pick.textContent = decode(video.title) + ' · ' + decode(video.channel)
        pick.setAttribute('aria-pressed',String(video.id === song.video))
        pick.onclick = () => row.choose(video.id)
        option.append(pick, anchor('https://www.youtube.com/watch?v=' + video.id, L('듣기 ↗','Listen ↗','聴く ↗')))
        choices.append(option)
      }
      feedback.textContent = videos.length ? '' : L('검색 결과가 없습니다. 영상 링크를 붙여 넣어 주세요.','No matches. Paste a video link.','候補がありません。動画リンクを入力してください。')
    } catch {
      if (!signal.aborted) feedback.textContent = L('후보를 불러오지 못했어요. YouTube에서 검색한 뒤 링크를 붙여 넣어 주세요.','Search is unavailable. Find a video on YouTube and paste its link.','候補を取得できません。YouTubeで検索してリンクを入力してください。')
    }
  }
  analyze.onclick = async () => {
    clearReview()
    try { draft = parseSetlist(input.value) }
    catch (error) {
      show(error.message === 'ambiguous-link'
        ? L('각 영상 링크를 해당 곡명 옆이나 바로 다음 줄에 하나씩 적어 주세요.','Place one video link beside or below each song.','各曲名の横か次の行に動画リンクを1つ入力してください。')
        : L('곡을 1~60개 입력해 주세요. 제목과 곡명은 200자, 메모는 400자까지입니다.','Enter 1–60 songs. Titles allow 200 characters and notes 400.','1〜60曲を入力してください。タイトルと曲名は200文字、メモは400文字までです。'))
      return
    }
    analyze.hidden = true
    submit.hidden = false
    const pending = draft.songs.map(renderSong).filter(row => !row.song.video)
    if (!pending.length) { await create(); return }
    show(L('곡마다 들을 영상을 선택해 주세요.','Choose a reference for each song.','各曲の参考動画を選んでください。'))
    controller = new AbortController()
    const {signal} = controller, requests = new Map()
    async function worker() {
      while (pending.length && !signal.aborted) await fetchChoices(pending.shift(), signal, requests)
    }
    await Promise.all(Array.from({length:Math.min(3, pending.length)}, worker))
  }
  async function create() {
    if (creating || !draft?.songs.every(song => song.video)) return
    creating = true
    input.disabled = el('setlist-close').disabled = true
    rows.inert = true
    refresh()
    show(L('콘티 MPDF 만드는 중…','Creating your setlist MPDF…','セットリストMPDFを作成中…'))
    try {
      const title = draft.title || L('콘티','Setlist','セットリスト')
      const file = await makeSetlistFile(title, draft.songs, safeTitle(title))
      await openFile(file)
      dialog.close()
    } catch (e) { show(e.message || String(e)) }
    finally {
      creating = false
      rows.inert = input.disabled = el('setlist-close').disabled = false
      refresh()
    }
  }
  submit.onclick = create
}
