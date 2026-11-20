import {parseSetlist, makeSetlistFile} from './setlist.js'
import {parseYouTube} from './mpdf-browser.js'
import {getLang} from './i18n.js'

import {findPositions} from './score-titles.js'
import {pickScorePosition} from './score-position-dialog.js'
import {isScorePDF, mountScoreDrop} from './score-drop.js'

export function mountSetlist({openFile, currentScore, applyScore, account, safeTitle, L}) {
  const el = id => document.getElementById(id)
  const dialog = el('setlist-dialog'), input = el('setlist-text'), rows = el('setlist-songs')
  const message = el('setlist-message'), submit = el('setlist-create')
  const analyze = el('setlist-analyze')
  const upload = el('setlist-pdf'), skip = el('setlist-skip')
  const supplied = el('supplied-references'), suppliedRows = supplied.querySelector('ol')
  const fields = el('setlist-fields'), progress = el('setlist-progress'), meter = progress.querySelector('progress')
  let draft, controller, operation, loadedFile, selectedFile, sourceDocument, creating = false
  const reviewToggle=el('edit-setlist-input')
  reviewToggle.onclick=()=>reviewToggle.setAttribute('aria-expanded',String(reviewToggle.getAttribute('aria-expanded')!=='true'))
  const register = el('setlist-register')
  function offerSignIn() {
    if (register.checked && !account.user) document.querySelector('#account-host .account-trigger').click()
  }
  register.onchange = offerSignIn
  function fitKeyboard() {
    const viewport=window.visualViewport
    if (!dialog.open || !viewport) return
    const inset=viewport.scale===1?Math.max(0,window.innerHeight-viewport.height-viewport.offsetTop):0
    dialog.style.setProperty('--dialog-height', Math.floor(viewport.height*0.94)+'px')
    dialog.style.setProperty('--dialog-bottom', Math.round(inset)+'px')
  }
  window.visualViewport?.addEventListener('resize', fitKeyboard)
  window.visualViewport?.addEventListener('scroll', fitKeyboard)
  function updateEntry() {
    const hasSource = selectedFile || currentScore() || skip.checked
    input.disabled = creating || !hasSource
    analyze.disabled = input.disabled || !input.value.trim()
    register.closest('label').hidden = analyze.disabled
  }
  function displayAttachment() {
    const existing = currentScore()
    const name = selectedFile?.name || existing?.name
    el('setlist-remove').hidden = !selectedFile || Boolean(existing)
    el('setlist-skip-option').hidden = Boolean(name)
    updateEntry()
    el('setlist-current').textContent = name || ''
    el('setlist-attached').hidden = el('setlist-replace').hidden = !name
    el('setlist-add').hidden = !!name
  }
  function selectFile(file) {
    selectedFile = file
    if (file) skip.checked = false
    upload.value = ''
    el('setlist-drop-error').hidden = true
    displayAttachment()
  }
  el('setlist-remove').onclick = () => {
    selectFile(null)
    clearReview()
    el('setlist-choose').focus()
  }
  skip.onchange = () => {
    el('setlist-drop-error').hidden = true
    clearReview()
  }
  const invalid = () => { el('setlist-drop-error').hidden = false }
  mountScoreDrop(dialog, dialog, {select:selectFile, invalid, enabled:() => !creating && !fields.hidden})
  el('setlist-choose').onclick = () => upload.click()
  upload.onchange = () => {
    if (isScorePDF(upload.files[0])) selectFile(upload.files[0])
    else if (upload.files.length) invalid()
  }
  function openDialog() {
    if (creating) return
    const pdf = currentScore()?.pdf
    if (pdf !== sourceDocument) {
      selectedFile = loadedFile = null
      skip.checked = false
    }
    sourceDocument = pdf
    displayAttachment()
    el('setlist-drop-error').hidden = true
    register.checked=!!account.user || !!currentScore()?.registered
    register.disabled=!!currentScore()?.registered
    dialog.showModal()
    fitKeyboard()
    if (matchMedia('(pointer: coarse)').matches) el('setlist-close').focus({preventScroll:true})
    else if (input.disabled) el('setlist-choose').focus()
    else input.focus()
  }
  function stage(text, page, total) {
    el('setlist-stage').textContent = text
    if (total) { meter.max = total; meter.value = page }
    else meter.removeAttribute('value')
    fields.hidden = true
    progress.hidden = false
    dialog.scrollTop = 0
  }

  const show = text => { message.textContent = text }
  function clearReview() {
    controller?.abort()
    fields.classList.remove('reviewing')
    reviewToggle.setAttribute('aria-expanded','false')
    draft = null
    rows.replaceChildren()
    suppliedRows.replaceChildren()
    supplied.hidden = true
    supplied.open = false
    el('setlist-count').textContent = ''
    submit.hidden = true
    analyze.hidden = false
    updateEntry()
    show('')
  }
  function refresh() {
    if (!draft) { submit.disabled = true; return }
    const total = draft.songs.length, done = draft.songs.filter(song => song.video).length
    submit.disabled = creating || done !== total
    el('setlist-count').textContent = L(`${total}곡 중 ${done}곡 연결됨`,`${done} of ${total} references connected`,`${total}曲中${done}曲を接続済み`)
  }
  el('welcome-setlist').onclick = el('connect-setlist').onclick = openDialog
  el('setlist-close').onclick = () => { operation?.abort(); dialog.close() }
  dialog.addEventListener('cancel', event => {
    if (el('setlist-close').disabled) event.preventDefault()
    else operation?.abort()
  })
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
    row.value = index + 1
    const target = song.video ? suppliedRows : rows
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
    function sync(changed = false) {
      song.url = field.value.trim()
      song.video = parseYouTube(song.url)
      listen.hidden = !song.video
      if (song.video) listen.href = 'https://www.youtube.com/watch?v=' + song.video
      field.setAttribute('aria-invalid', String(!!song.url && !song.video))
      for (const button of choices.querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.value === song.video))
      refresh()
      if (changed) show(submit.disabled
        ? L('남은 곡의 영상 제목을 눌러 선택하세요.','Select a video for the remaining songs.','残りの曲の動画を選んでください。')
        : L('모든 곡이 연결됐어요. MPDF 만들기를 누르세요.','All references are connected. Click Create MPDF.','全曲の動画を選択しました。「MPDFを作成」を押してください。'))
    }
    field.oninput = () => sync(true)
    sync()
    const links = document.createElement('div')
    links.className = 'setlist-links'
    links.append(listen, direct)
    row.append(field, links, choices, feedback)
    target.append(row)
    return {song, choices, feedback, choose(id) {
      field.value = 'https://youtu.be/' + id
      sync(true)
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
    if (analyze.disabled) return
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
    supplied.hidden = !suppliedRows.children.length
    if (!pending.length) { await create(); return }
    fields.classList.add('reviewing')
    fields.querySelector('.setlist-content').scrollTop=0
    show(L('링크가 없는 곡은 아래 영상 제목을 눌러 선택하세요.','Choose a video title below for each missing link.','リンクのない曲は、下の動画タイトルを押して選んでください。'))
    controller = new AbortController()
    const {signal} = controller, requests = new Map()
    async function worker() {
      while (pending.length && !signal.aborted) await fetchChoices(pending.shift(), signal, requests)
    }
    await Promise.all(Array.from({length:Math.min(3, pending.length)}, worker))
  }
  async function create() {
    if (creating || !draft?.songs.every(song => song.video)) return
    if (register.checked && !account.user) {
      show(L('앱에서 사용할 제작자 계정으로 로그인한 뒤 만들기를 누르세요.','Sign in with your app account, then choose Create MPDF.','アプリのアカウントでログインした後、MPDFを作成してください。'))
      offerSignIn()
      return
    }
    creating = true
    operation = new AbortController()
    const {signal} = operation
    const {title,songs} = draft
    const sourceFile = selectedFile
    input.disabled = upload.disabled = true
    rows.inert = true
    refresh()
    stage(L('콘티 MPDF 만드는 중…','Creating your setlist MPDF…','セットリストMPDFを作成中…'))
    try {
      for (const song of songs.filter(s=>s.fromLink)) {
        signal.throwIfAborted()
        stage(L('유튜브 영상 제목 확인 중','Reading video title','動画タイトルを確認中')+' · '+song.name)
        try {
          const endpoint = new URL('https://www.youtube.com/oembed')
          endpoint.search = new URLSearchParams({url:'https://www.youtube.com/watch?v='+song.video, format:'json'})
          const response = await fetch(endpoint, {signal:AbortSignal.any([signal,AbortSignal.timeout(5000)])})
          if (response.ok) song.name = (await response.json()).title?.slice(0,200) || song.name
        } catch { signal.throwIfAborted() }
      }
      if (!currentScore() && !sourceFile) {
        const name = title || L('콘티','Setlist','セットリスト')
        stage(L('연습할 곡 목록 만드는 중…','Building the song list…','曲目表を作成中…'))
        const file = await makeSetlistFile(name,songs,safeTitle(name))
        signal.throwIfAborted()
        el('setlist-close').disabled = true
        stage(L('편집용 원본과 공유본 저장 중…','Saving editable and sharing copies…','編集用原本と共有用コピーを保存中…'))
        await openFile(file, {createdSetlist:true,registerCreator:register.checked})
      } else {
        stage(L('악보 PDF 여는 중…','Opening the score PDF…','楽譜PDFを読み込み中…'))
        if (sourceFile && loadedFile !== sourceFile) {
          loadedFile = null
          await openFile(sourceFile)
          loadedFile = sourceFile
        }
        signal.throwIfAborted()
        const score = currentScore()
        if (!score?.editable) throw new Error(L('편집 가능한 원본 악보 PDF를 선택해 주세요.','Choose an editable original score PDF.','編集可能な元の楽譜PDFを選んでください。'))
        const positions = await findPositions(score.pdf,songs,score.buttons,signal,(n,total,phase)=>{
          const labels = {
            text:L('악보에서 곡 제목 찾는 중','Locating score titles','楽譜の曲名を検索中'),
            headers:L('스캔 악보의 제목 읽는 중','Reading scanned titles','スキャンした曲名を認識中'),
            full:L('스캔 악보 본문 확인 중','Reading scanned pages','スキャンした本文を認識中'),
            positions:L('재생 버튼 위치 찾는 중','Positioning play buttons','再生ボタンの位置を確認中')
          }
          if (phase === 'ocr-setup') stage(L('스캔 악보 인식 준비 중…','Preparing to read the scanned score…','スキャン楽譜の認識を準備中…'))
          else stage(labels[phase]+' · '+n+' / '+total,n,total)
        })
        for (const [i,places] of positions.entries()) {
          signal.throwIfAborted()
          if (!places.length) {
            const previous = positions[i-1]?.at(-1)?.page || 0
            places.push(await pickScorePosition(score.pdf,songs[i],Math.min(previous+1,score.pdf.numPages),signal))
          }
        }
        signal.throwIfAborted()
        el('setlist-close').disabled = true
        stage(L('레퍼런스를 연결하고 편집용 원본과 공유본 저장 중…','Connecting references and saving both copies…','参考動画を接続して原本と共有用コピーを保存中…'))
        await applyScore(score.pdf,title,songs,positions,register.checked)
      }
      dialog.close()
    } catch (e) {
      if (e.name==='AbortError') show(L('위치 선택을 취소했습니다.','Placement cancelled.','位置指定をキャンセルしました。'))
      else show(e.message || String(e))
    } finally {
      creating = false
      operation = null
      fields.hidden = false
      progress.hidden = true
      rows.inert = upload.disabled = el('setlist-close').disabled = false
      updateEntry()
      refresh()
      if (dialog.open) message.scrollIntoView({block:'nearest'})
    }
  }
  submit.onclick = create
  return async function startFromHome(readDraft) {
    openDialog()
    stage(L('홈에서 입력한 콘티와 악보 여는 중…','Opening your setlist and score…','曲順と楽譜を読み込み中…'))
    el('setlist-close').disabled = true
    let saved
    try { saved = await readDraft } catch { saved = null }
    el('setlist-close').disabled = false
    fields.hidden = false
    progress.hidden = true
    if (!saved) {
      show(L('홈 입력을 불러오지 못했어요. 악보 선택부터 다시 시작해 주세요.','Could not load the home draft. Start by choosing a score option.','入力内容を読み込めませんでした。楽譜の選択からやり直してください。'))
      return
    }
    input.value = saved.text
    skip.checked = !saved.score
    selectFile(saved.score)
    if (dialog.open) await analyze.onclick()
  }
}
