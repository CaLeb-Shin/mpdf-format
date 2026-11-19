// All boxes are in the displayed crop box, normalized from its upper left.
const normalized = text => text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
const clamp = v => Math.min(.95, Math.max(.05, v))

function textLines(page, items) {
  const view = page.getViewport({scale:1})
  const runs = []
  for (const item of items) {
    if (!item.str?.trim()) continue
    const [a,b,,,x,y] = item.transform
    const size = Math.hypot(a,b)
    if (!size) continue
    const dx = a / size, dy = b / size
    const points = [0,item.width].flatMap(w => [-.18,.86].map(h =>
      view.convertToViewportPoint(x + dx*w - dy*h*item.height, y + dy*w + dx*h*item.height)))
    runs.push({text:item.str, left:Math.min(...points.map(p=>p[0])) / view.width,
      right:Math.max(...points.map(p=>p[0])) / view.width, top:Math.min(...points.map(p=>p[1])) / view.height,
      bottom:Math.max(...points.map(p=>p[1])) / view.height})
  }
  runs.sort((a,b)=>a.bottom-b.bottom)
  const groups = []
  for (const run of runs) {
    const group = groups.at(-1)
    if (group && Math.abs(group[0].bottom-run.bottom) < Math.max(.002, (run.bottom-run.top)*.4)) group.push(run)
    else groups.push([run])
  }
  const lines = []
  for (const group of groups) {
    let current
    for (const run of group.sort((a,b)=>a.left-b.left)) {
      if (current && run.left-current.right < Math.max(.018, (run.bottom-run.top)*1.15)) {
        current.text += ' ' + run.text
        current.right = Math.max(current.right,run.right)
        current.top = Math.min(current.top,run.top)
        current.bottom = Math.max(current.bottom,run.bottom)
      } else { current = {...run}; lines.push(current) }
    }
  }
  return lines
}

function affinity(line, song) {
  const name = normalized(song.name)
  const text = normalized(line.text.replace(/^\s*\d{1,3}[.)、]\s*/, ''))
  if (!name || !text) return 0
  if (name === text) return 1
  if (text.includes(name) && name.length >= 3 && text.length <= name.length + 15) return .86
  // Allow a short OCR substitution or a missing ending in a long heading.
  if (name.length >= 6 && Math.abs(text.length-name.length)<=2) {
    let prev = Array.from({length:name.length+1}, (_,i)=>i)
    for (const ch of text) {
      const next = [prev[0]+1]
      for (let j=0;j<name.length;j++) next.push(Math.min(next[j]+1,prev[j+1]+1,prev[j]+Number(name[j]!==ch)))
      prev = next
    }
    if (prev[name.length] <= Math.min(2,Math.floor(name.length/(line.priority != null && line.top<.26 ? 5 : 6)))) return .85
  }
  if (song.fromLink && text.length >= 4 && name.includes(text)) return .82
  if (song.name.includes('+') && normalized(song.name.split('+')[0]) === text) return .85
  return 0
}

export function locateTitles(songs, pages) {
  const used = new Set()
  return songs.map(song => {
    const matches = []
    for (const [i, lines] of pages.entries()) {
      for (const line of lines) {
        const similarity = affinity(line, song)
        if (!similarity || used.has(line)) continue
        const score = similarity + Math.min(.18,(line.bottom-line.top)*4) + (line.top < .35 ? .08 : 0)
        matches.push({page:i+1,line,score})
      }
    }
    matches.sort((a,b)=>b.score-a.score)
    const first = matches[0]
    if (!first) return []
    const similar = matches.filter(m=>first.score-m.score < .025)
    if (similar.some(m=>m!==first && (m.page===first.page || m.line.top>.26 || first.line.top>.26))) return []
    // A score can repeat its heading on following pages or in another arrangement.
    const headings = [first]
    for (const m of matches.slice(1)) {
      if (first.line.top < .26 && m.line.top < .26 && first.score-m.score<.11 &&
          !headings.some(h=>h.page===m.page) && !songs.some(other=>other!==song && normalized(other.name)===normalized(song.name))) headings.push(m)
    }
    headings.forEach(m=>used.add(m.line))
    return headings.sort((a,b)=>a.page-b.page)

  })
}

export async function scoreCanvas(pdf, pageNumber, maxWidth) {
  const page = await pdf.getPage(pageNumber)
  const box = page.getViewport({scale:1})
  const view = page.getViewport({scale:Math.min(maxWidth/box.width, 2400/box.height)})
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(view.width)
  canvas.height = Math.ceil(view.height)
  await page.render({canvasContext:canvas.getContext('2d',{willReadFrequently:true}),viewport:view}).promise
  return canvas
}

// Isolate prominent headings before asking OCR to read a page of staff notation.
function headerRegions(canvas) {
  const w=canvas.width, h=canvas.height, bottom=Math.ceil(h*.27)
  const pixels=canvas.getContext('2d').getImageData(0,0,w,bottom).data
  const bands=[]
  let band
  for (let y=1;y<bottom;y++) {
    let count=0
    for (let x=Math.floor(w*.16);x<w*.84;x+=2) if(pixels[(y*w+x)*4]<150) count++
    if(count<3) continue
    if(!band || y-band.end>3) {band={start:y,end:y};bands.push(band)}
    band.end=y
  }
  const regions=[]
  for (const {start,end} of bands) {
    const height=end-start+1
    if(height<h*.009 || height>h*.077) continue
    let span
    const spans=[]
    for(let x=0;x<w;x++){
      let ink=false
      for(let y=start;y<=end&&!ink;y++) ink=pixels[(y*w+x)*4]<150
      if(!ink) continue
      if(!span || x-span.end>w*.038){span={start:x,end:x};spans.push(span)}
      span.end=x
    }
    for(const span of spans){
      const width=span.end-span.start+1, center=(span.start+width/2)/w
      if(width<w*.07 || width>w*.91 || Math.abs(center-.5)>.28) continue
      regions.push({left:span.start/w,right:(span.end+1)/w,top:start/h,bottom:(end+1)/h,
        priority:height/h - Math.abs(center-.5)*.06-start/h*.045})
    }
  }
  return regions.sort((a,b)=>b.priority-a.priority).slice(0,3)
}
async function readHeaders(worker,canvas) {
  const lines=[]
  await worker.setParameters({tessedit_pageseg_mode:'7'})
  for(const box of headerRegions(canvas)){
    const crop=document.createElement('canvas')
    const left=Math.floor(box.left*canvas.width),top=Math.floor(box.top*canvas.height)
    const w=Math.ceil(box.right*canvas.width)-left,h=Math.ceil(box.bottom*canvas.height)-top
    crop.width=w+24;crop.height=h+24
    const ctx=crop.getContext('2d')
    ctx.fillStyle='white';ctx.fillRect(0,0,crop.width,crop.height)
    ctx.drawImage(canvas,left,top,w,h,12,12,w,h)
    const {data}=await worker.recognize(crop)
    lines.push({...box,text:data.text.trim()})
  }
  return lines
}

async function recognizeMissing(pdf, pages, songs, signal, progress) {
  const {default:Tesseract} = await import('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.esm.min.js')
  signal.throwIfAborted()
  const names = songs.map(s=>s.name).join(' ')
  const langs = []
  if (/\p{Script=Hangul}/u.test(names)) langs.unshift('kor')
  if (/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(names)) langs.unshift('jpn')
  if (!langs.length || /[a-z]/i.test(names)) langs.push('eng')
  const worker = await Tesseract.createWorker(langs, 1, {
    workerPath:'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
    corePath:'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1'
  })
  try {
    for (const headerOnly of [true,false]) {
      if (!headerOnly && locateTitles(songs,pages).every(m=>m.length)) break
      for (let n=1; n<=pdf.numPages; n++) {
        signal.throwIfAborted()
        progress(n, pdf.numPages, true)
        const canvas = await scoreCanvas(pdf,n,1550)
        if (headerOnly) {
          const headers = await readHeaders(worker,canvas)
          pages[n-1].push(...headers.filter(line=>!pages[n-1].some(l=>normalized(l.text)===normalized(line.text) && Math.abs(l.top-line.top)<.025 && Math.abs(l.left-line.left)<.04)))
          canvas.width = canvas.height = 1
          continue
        }
        await worker.setParameters({tessedit_pageseg_mode:'11'})
        const {data} = await worker.recognize(canvas)
        for (const {text,bbox} of data.lines) {
          if (!text.trim()) continue
          const box = {text,left:bbox.x0/canvas.width,right:bbox.x1/canvas.width,
            top:bbox.y0/canvas.height,bottom:bbox.y1/canvas.height}
          if (!pages[n-1].some(line => normalized(line.text) === normalized(text) && Math.abs(line.top-box.top)<.025 && Math.abs(line.left-box.left)<.04)) pages[n-1].push(box)
        }
        canvas.width = canvas.height = 1
      }
    }
  } finally { await worker.terminate() }
}

function freePosition(canvas, line, occupied) {
  const w = canvas.width, h = canvas.height, cy = (line.top+line.bottom)/2
  const pixels = canvas.getContext('2d').getImageData(0,0,w,h).data
  for (const offset of [0,-.018,.018]) {
    for (const x of [line.right+.044,line.left-.044,line.right+.072,line.left-.072]) {
      if (x < .05 || x > .95) continue
      const y = clamp(cy+offset)
      if (occupied.some(b=>Math.abs(x-b.x)<.072 && Math.abs(y-b.y)*h < .094*w)) continue
      let ink = 0, count = 0
      for (let py=Math.max(0,Math.floor(y*h-w*.046)); py<Math.min(h,y*h+w*.046); py+=2) {
        for (let px=Math.floor((x-.034)*w); px<(x+.034)*w; px+=2) {
          if (pixels[(py*w+px)*4] < 175) ink++
          count++
        }
      }
      if (ink/count < .013) return {x,y}
    }
  }
  return null
}

export async function findPositions(pdf, songs, existing, signal, progress) {
  const pages = []
  for (let n=1; n<=pdf.numPages; n++) {
    signal.throwIfAborted()
    progress(n,pdf.numPages,false)
    const page = await pdf.getPage(n)
    pages.push(textLines(page, (await page.getTextContent()).items))
  }
  let matches = locateTitles(songs,pages)
  if (matches.some(m=>!m.length)) {
    progress(1,pdf.numPages,true)
    try { await recognizeMissing(pdf,pages,songs,signal,progress) }
    catch (error) { if (signal.aborted) throw error; console.warn('Score OCR unavailable', error.message) }
    matches = locateTitles(songs,pages)
  }
  const positions = songs.map(()=>[])
  for (const page of new Set(matches.flat().map(m=>m.page))) {
    signal.throwIfAborted()
    const canvas = await scoreCanvas(pdf,page,720)
    const occupied = existing.filter(b=>b.page===page)
    for (const [index, headings] of matches.entries()) {
      const match = headings.find(m=>m.page===page)
      if (!match) continue
      const point = freePosition(canvas,match.line,occupied)
      if (point) {positions[index].push({page,...point}); occupied.push(point)}
    }
    canvas.width = canvas.height = 1
  }
  return positions
}
