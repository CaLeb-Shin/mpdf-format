import {parseYouTube, createMpdf} from './mpdf-browser.js'

const numberPrefix = /^\s*(?:\d{1,3}\s*[.)、:]|[-•])\s*/
const urlPattern = /https?:\/\/[^\s<>]+/gi

export function parseSetlist(input) {
  const lines = input.replace(/&#x20;|&nbsp;/gi, ' ').replace(/\\:/g, ':')
    .split(/\r?\n/).map(line => line.trim().replace(/\\+$/, '').trim()).filter(Boolean)
  // A batch of bare video links can also be paired with printed titles.
  const linkId = line => parseYouTube(line.replace(numberPrefix, ''))
  const firstIsLink = /^(?:\d{1,3}[.)]\s*)?https?:\/\//i.test(lines[0] || '') && linkId(lines[0])
  const links = firstIsLink ? lines : (!numberPrefix.test(lines[0] || '') && lines.length>2 ? lines.slice(1) : [])
  if (links.length && links.every(line => /^https?:\/\//i.test(line.replace(numberPrefix,'')) && linkId(line))) {
    const title = links===lines ? '' : lines[0]
    if (links.length>60 || title.length>200) throw new Error('size')
    return {title,songs:links.map((line,i)=>({name:'YouTube '+(i+1),note:'',url:line.replace(numberPrefix,''),video:linkId(line),fromLink:true}))}
  }
  const numbered = lines.findIndex(line => numberPrefix.test(line))
  // Without numbering, every non-link line is a song unless a blank line separates the heading.
  const hasHeading = numbered > 0 || (numbered < 0 && /^\s*[^\n]+\n\s*\n/.test(input.trim()) && !/^https?:/i.test(lines[0]))
  const title = hasHeading ? lines.shift() : ''
  const songs = []
  for (const line of lines) {
    const urls = [...line.matchAll(urlPattern)].map(match => match[0])
    const label = line.replace(urlPattern, '').replace(numberPrefix, '').trim()
    if (label) {
      const memo = label.match(/\s*[（(]([^()（）]+)[）)]\s*$/)
      const name = memo ? label.slice(0, memo.index).trim() : label
      songs.push({name: name || label, note: name && memo ? memo[1] : '', url: '', video: null})
    }
    for (const url of urls) {
      const song = songs.at(-1)
      if (!song || song.url) throw new Error('ambiguous-link')
      song.url = url
      song.video = parseYouTube(url)
    }
  }
  if (!songs.length || songs.length > 60 || songs.some(s => s.name.length > 200 || s.note.length > 400) || title.length > 200) throw new Error('size')
  return {title, songs}
}

const width = 595, height = 842
function linesOf(context, value, maxWidth) {
  const lines = []
  let line = ''
  for (const char of value) {
    if (line && context.measureText(line + char).width > maxWidth) {
      lines.push(line.trimEnd())
      line = ''
    }
    line += char
  }
  if (line.trim()) lines.push(line.trim())
  return lines
}

export async function makeSetlistFile(title, songs, filename) {
  const pdf = await globalThis.PDFLib.PDFDocument.create()
  pdf.setTitle(title)
  // SEETogether decodes the version field while MPDF readers use mpdf.
  const manifest = {mpdf:'1.0', version:'1.0', title, tracks:[], cues:[], buttons:[], options:{autoplay:false, followPage:true, loop:false}}
  const canvas = document.createElement('canvas')
  canvas.width = width * 2
  canvas.height = height * 2
  const ctx = canvas.getContext('2d')
  ctx.scale(2, 2)
  const font = (weight, size) => { ctx.font = weight + ' ' + size + 'px system-ui, sans-serif' }
  let y, firstOnPage, pageHasTrack
  function startPage() {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.fillStyle = '#995019'
    font(650, 13)
    ctx.fillText('MPDF', 40, 49)
    ctx.fillStyle = '#202921'
    font(700, 25)
    y = 92
    for (const line of linesOf(ctx, title, width - 80)) {
      ctx.fillText(line, 40, y)
      y += 32
    }
    y += 14
    firstOnPage = true
    pageHasTrack = false
  }
  async function finishPage() {
    font(500, 12)
    ctx.fillStyle = '#626d63'
    ctx.fillText(String(pdf.getPageCount() + 1), 40, height - 28)
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
    const image = await pdf.embedPng(await blob.arrayBuffer())
    pdf.addPage([width, height]).drawImage(image, {x:0, y:0, width, height})
  }
  startPage()
  for (const [index, song] of songs.entries()) {
    font(650, 19)
    const name = linesOf(ctx, song.name, 390)
    font(400, 14)
    const note = linesOf(ctx, song.note, 390)
    const rowHeight = Math.max(76, 25 * name.length + 20 * note.length + 27)
    if (!firstOnPage && y + rowHeight > height - 54) {
      await finishPage()
      startPage()
    }
    const page = pdf.getPageCount() + 1, id = 't' + (index + 1)
    if (song.video) {
      if (!parseYouTube(song.video)) throw new Error('Invalid YouTube reference')
      manifest.tracks.push({id, title:song.name, src:'youtube:' + song.video})
      if (!pageHasTrack) manifest.cues.push({page, track:id, at:0})
      manifest.buttons.push({id:crypto.randomUUID(), page, track:id, x:0.89, y:(y + rowHeight / 2) / height})
      pageHasTrack = true
    }
    firstOnPage = false
    ctx.fillStyle = '#d6ded6'
    ctx.fillRect(40, y, width - 80, 1)
    ctx.fillStyle = '#805029'
    font(600, 14)
    ctx.fillText(String(index + 1).padStart(2, '0'), 40, y + 31)
    ctx.fillStyle = '#202921'
    font(650, 19)
    let baseline = y + 32
    for (const line of name) { ctx.fillText(line, 80, baseline); baseline += 25 }
    ctx.fillStyle = '#59665c'
    font(400, 14)
    for (const line of note) { ctx.fillText(line, 80, baseline); baseline += 20 }
    y += rowHeight
  }
  await finishPage()
  const score = await pdf.save()
  const bytes = manifest.tracks.length ? await createMpdf(score, manifest, {}) : score
  return new File([bytes], filename + '.pdf', {type:'application/pdf'})
}
